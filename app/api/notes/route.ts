import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return Response.json({ success: false, message: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')
  if (!entityType || !entityId) return Response.json({ success: false, message: 'entityType and entityId required' }, { status: 400 })

  const { data, error } = await supabase.from('notes').select('*')
    .eq('entity_type', entityType).eq('entity_id', entityId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return Response.json({ success: false, message: 'Forbidden' }, { status: 403 })
  if (user.isDemo) return demoReadOnlyResponse()

  const { entityType, entityId, body } = await req.json()
  if (!entityType || !entityId || !body?.trim()) {
    return Response.json({ success: false, message: 'entityType, entityId and body required' }, { status: 400 })
  }

  const { data, error } = await supabase.from('notes').insert({
    entity_type: entityType,
    entity_id: entityId,
    body: body.trim(),
    author_id: user.id,
    author_name: user.name || user.email,
  }).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  await logActivity({ entityType, entityId, action: 'note_added', user })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
