import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'
import { notify } from '@/lib/notify'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (!hasPermission(user, 'helpdesk.manage')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { toEmployeeId } = await req.json()
  if (!toEmployeeId) return Response.json({ success: false, message: 'toEmployeeId is required' }, { status: 400 })

  const { data: ticket } = await supabase.from('support_tickets')
    .select('id, ticket_number, title, status').eq('id', params.id).single()
  if (!ticket) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  if (['resolved', 'closed'].includes(ticket.status)) {
    return Response.json({ success: false, message: 'Ticket already closed' }, { status: 409 })
  }

  const { data: emp } = await supabase.from('employees').select('id, name, user_id').eq('id', toEmployeeId).single()
  if (!emp) return Response.json({ success: false, message: 'Employee not found' }, { status: 404 })

  const { data, error } = await supabase.from('support_tickets').update({
    status: 'escalated',
    escalated_at: new Date().toISOString(),
    escalated_to: toEmployeeId,
  }).eq('id', params.id).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  await logActivity({ entityType: 'ticket', entityId: params.id, action: 'escalated', detail: { to: emp.name }, user })
  await notify([emp.user_id], 'ticket_escalated',
    `تم تصعيد التذكرة ${ticket.ticket_number || ''} إليك`,
    { body: ticket.title, entityType: 'ticket', entityId: params.id, link: '/app/support-tickets', isDemo: !!user.isDemo, excludeUserId: user.id })

  return Response.json({ success: true, data: toApi(data) })
}
