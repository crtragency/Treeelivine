import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

const MAX_SIZE = 15 * 1024 * 1024 // 15 MB

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (!hasPermission(user, 'files.read')) return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')
  if (!entityType || !entityId) return Response.json({ success: false, message: 'entityType and entityId required' }, { status: 400 })

  const { data, error } = await supabase.from('attachments').select('*')
    .eq('entity_type', entityType).eq('entity_id', entityId)
    .order('created_at', { ascending: false })
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (!hasPermission(user, 'files.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const form = await req.formData()
  const file = form.get('file') as File | null
  const entityType = form.get('entityType') as string
  const entityId = form.get('entityId') as string
  const clientVisible = form.get('clientVisible') === 'true'

  if (!file || !entityType || !entityId) {
    return Response.json({ success: false, message: 'file, entityType and entityId required' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ success: false, message: 'File too large (max 15MB)' }, { status: 413 })
  }

  const safeName = file.name.replace(/[^\w.\-()؀-ۿ ]/g, '_')
  const path = `${entityType}/${entityId}/${crypto.randomUUID()}-${safeName}`
  const buf = await file.arrayBuffer()

  const { error: upErr } = await supabase.storage.from('attachments').upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
  } as any)
  if (upErr) return Response.json({ success: false, message: `Upload failed: ${upErr.message}` }, { status: 500 })

  const { data, error } = await supabase.from('attachments').insert({
    entity_type: entityType,
    entity_id: entityId,
    path,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    client_visible: clientVisible,
    uploaded_by: user.id,
  }).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  await logActivity({ entityType: entityType as any, entityId, action: 'file_uploaded', detail: { fileName: file.name }, user })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
