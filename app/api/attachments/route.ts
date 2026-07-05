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
  let entityType = form.get('entityType') as string
  let entityId = form.get('entityId') as string
  const clientVisible = form.get('clientVisible') === 'true'
  // DAM extras: library uploads live under entity_type 'dam'
  const folderId = (form.get('folderId') as string) || null
  const tags = ((form.get('tags') as string) || '').split(',').map(s => s.trim()).filter(Boolean)
  const versionGroup = (form.get('versionGroup') as string) || null
  if (!entityType && (folderId || form.get('dam') === 'true' || versionGroup)) {
    entityType = 'dam'
    entityId = folderId || '00000000-0000-0000-0000-000000000000'
  }

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

  // uploading into an existing version group bumps the version number
  let version = 1
  let inheritedFolder = folderId
  if (versionGroup) {
    const { data: prev } = await supabase.from('attachments')
      .select('version, folder_id').eq('version_group', versionGroup)
      .order('version', { ascending: false }).limit(1)
    if (prev?.length) {
      version = (Number(prev[0].version) || 1) + 1
      if (!inheritedFolder) inheritedFolder = prev[0].folder_id
    }
  }

  const { data, error } = await supabase.from('attachments').insert({
    entity_type: entityType,
    entity_id: entityId,
    path,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    client_visible: clientVisible,
    uploaded_by: user.id,
    folder_id: inheritedFolder || null,
    tags,
    version,
    ...(versionGroup ? { version_group: versionGroup } : {}),
    is_demo: !!user.isDemo,
  }).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  if (entityType !== 'dam') {
    await logActivity({ entityType: entityType as any, entityId, action: 'file_uploaded', detail: { fileName: file.name }, user })
  }
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
