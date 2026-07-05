import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

/** True when this client user owns the entity the attachment hangs off. */
async function clientOwnsAttachment(userId: string, att: any): Promise<boolean> {
  if (!att.client_visible) return false
  const { data: customer } = await supabase.from('customers').select('id').eq('user_id', userId).single()
  if (!customer) return false
  if (att.entity_type === 'customer') return att.entity_id === customer.id
  if (att.entity_type === 'project') {
    const { data: p } = await supabase.from('projects').select('customer_id').eq('id', att.entity_id).single()
    return p?.customer_id === customer.id
  }
  if (att.entity_type === 'contract') {
    const { data: c } = await supabase.from('contracts').select('customer_id').eq('id', att.entity_id).single()
    return c?.customer_id === customer.id
  }
  if (att.entity_type === 'invoice') {
    const { data: i } = await supabase.from('invoices').select('customer_id').eq('id', att.entity_id).single()
    return i?.customer_id === customer.id
  }
  return false
}

/** Download — streams the file through the API so auth is always enforced. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()

  const { data: att } = await supabase.from('attachments').select('*').eq('id', params.id).single()
  if (!att) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  if (user.role === 'client') {
    if (!(await clientOwnsAttachment(user.id, att))) return forbiddenResponse()
  } else if (!hasPermission(user, 'files.read')) {
    return forbiddenResponse()
  }

  const { data: blob, error } = await supabase.storage.from(att.bucket || 'attachments').download(att.path)
  if (error || !blob) return Response.json({ success: false, message: 'File missing from storage' }, { status: 404 })

  return new Response(await blob.arrayBuffer(), {
    headers: {
      'Content-Type': att.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(att.file_name)}`,
    },
  })
}

/** Update DAM metadata: tags, folder, client visibility. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (!hasPermission(user, 'files.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  const updates: any = {}
  if (body.tags !== undefined) updates.tags = Array.isArray(body.tags) ? body.tags.map((s: string) => String(s).trim()).filter(Boolean) : []
  if (body.folderId !== undefined) updates.folder_id = body.folderId || null
  if (body.clientVisible !== undefined) updates.client_visible = !!body.clientVisible
  if (!Object.keys(updates).length) return Response.json({ success: false, message: 'Nothing to update' }, { status: 400 })

  const { data, error } = await supabase.from('attachments').update(updates).eq('id', params.id).select().single()
  if (error || !data) return Response.json({ success: false, message: error?.message || 'Not found' }, { status: error ? 500 : 404 })
  return Response.json({ success: true, data: toApi(data) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (!hasPermission(user, 'files.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { data: att } = await supabase.from('attachments').select('*').eq('id', params.id).single()
  if (!att) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  await supabase.storage.from(att.bucket || 'attachments').remove([att.path])
  const { error } = await supabase.from('attachments').delete().eq('id', params.id)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true })
}
