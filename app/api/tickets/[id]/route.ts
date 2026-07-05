import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  const { data } = await supabase
    .from('support_tickets')
    .select('*, customer:customers(id,name,company,user_id), assignee:employees(id,name)')
    .eq('id', params.id).single()
  if (!data) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  if (user.role === 'client' && (data as any).customer?.user_id !== user.id && (data as any).created_by !== user.id) {
    return forbiddenResponse()
  }
  return Response.json({ success: true, data: toApi(data) })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { title, description, customerId, assignedTo, status, priority, department } = await req.json()
  const resolvedAt = status === 'resolved' ? new Date().toISOString() : null

  const { data, error } = await supabase
    .from('support_tickets')
    .update({
      title,
      description: description || null,
      customer_id: customerId || null,
      assigned_to: assignedTo || null,
      status: status || 'open',
      priority: priority || 'medium',
      ...(department ? { department } : {}),
      ...(resolvedAt ? { resolved_at: resolvedAt } : {}),
    })
    .eq('id', params.id).select().single()

  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()
  await supabase.from('support_tickets').delete().eq('id', params.id)
  return Response.json({ success: true })
}
