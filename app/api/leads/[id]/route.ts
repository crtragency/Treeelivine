import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'leads.read')) return forbiddenResponse()

  const { data } = await supabase.from('leads')
    .select('*, assignee:employees(id,name,email), customer:customers(id,name)')
    .eq('id', params.id).single()
  if (!data) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  return Response.json({ success: true, data: toApi(data) })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'leads.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  const updates: any = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.company !== undefined) updates.company = body.company
  if (body.email !== undefined) updates.email = body.email
  if (body.phone !== undefined) updates.phone = body.phone
  if (body.whatsapp !== undefined) updates.whatsapp = body.whatsapp
  if (body.source !== undefined) updates.source = body.source
  if (body.score !== undefined) updates.score = body.score
  if (body.expectedValue !== undefined) updates.expected_value = body.expectedValue
  if (body.currency !== undefined) updates.currency = body.currency
  if (body.assignedTo !== undefined) updates.assigned_to = body.assignedTo || null
  if (body.nextReminderAt !== undefined) updates.next_reminder_at = body.nextReminderAt || null
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.lostReason !== undefined) updates.lost_reason = body.lostReason
  if (body.stage !== undefined) {
    updates.stage = body.stage
    if (body.stage === 'won') updates.won_at = new Date().toISOString()
    if (body.stage === 'lost') updates.lost_at = new Date().toISOString()
  }

  const { data, error } = await supabase.from('leads').update(updates).eq('id', params.id)
    .select('*, assignee:employees(id,name)').single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  if (!data) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  await logActivity({ entityType: 'lead', entityId: params.id, action: 'updated', user })
  return Response.json({ success: true, data: toApi(data) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'leads.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { error } = await supabase.from('leads').delete().eq('id', params.id)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true })
}
