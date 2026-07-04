import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse, demoReadOnlyResponse, forbiddenResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')
  const status = searchParams.get('status')
  const mine = searchParams.get('mine')

  let query = supabase.from('reminders').select('*')
    .eq('is_demo', !!user.isDemo)
    .order('due_at', { ascending: true })
  if (entityType) query = query.eq('entity_type', entityType)
  if (entityId) query = query.eq('entity_id', entityId)
  if (status) query = query.eq('status', status)
  if (mine === 'true') query = query.eq('assigned_to', user.id)

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  if (!body.title || !body.dueAt) return Response.json({ success: false, message: 'title and dueAt required' }, { status: 400 })

  const { data, error } = await supabase.from('reminders').insert({
    title: body.title,
    due_at: body.dueAt,
    entity_type: body.entityType || null,
    entity_id: body.entityId || null,
    assigned_to: body.assignedTo || user.id,
    created_by: user.id,
  }).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
