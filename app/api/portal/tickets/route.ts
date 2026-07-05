import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'
import { notify } from '@/lib/notify'

/** Client portal help desk: list & create own tickets. */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()

  // tickets on any customer owned by this user, or created by them
  const { data: myCustomers } = await supabase.from('customers').select('id').eq('user_id', user.id)
  const customerIds = (myCustomers || []).map(c => c.id)

  let tickets: any[] = []
  if (customerIds.length) {
    const { data } = await supabase.from('support_tickets')
      .select('*, assignee:employees(id,name)')
      .in('customer_id', customerIds).order('created_at', { ascending: false })
    tickets = data || []
  }
  const { data: created } = await supabase.from('support_tickets')
    .select('*, assignee:employees(id,name)')
    .eq('created_by', user.id).order('created_at', { ascending: false })
  for (const t of created || []) {
    if (!tickets.find(x => x.id === t.id)) tickets.push(t)
  }
  tickets.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  return Response.json({ success: true, data: toApi(tickets) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  if (!body.title) return Response.json({ success: false, message: 'Title required' }, { status: 400 })

  const { data: myCustomer } = await supabase.from('customers').select('id').eq('user_id', user.id).limit(1).single()

  const { count } = await supabase.from('support_tickets').select('*', { count: 'exact', head: true })
  const ticketNumber = `TKT-${String((count || 0) + 1).padStart(4, '0')}`

  const { data, error } = await supabase.from('support_tickets').insert({
    ticket_number: ticketNumber,
    title: body.title,
    description: body.description || null,
    customer_id: myCustomer?.id || null,
    status: 'open',
    priority: ['low', 'medium', 'high', 'urgent'].includes(body.priority) ? body.priority : 'medium',
    department: ['general', 'design', 'development', 'marketing', 'finance', 'accounts'].includes(body.department) ? body.department : 'general',
    created_by: user.id,
    is_demo: !!user.isDemo,
  }).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  await logActivity({ entityType: 'ticket', entityId: data.id, action: 'created', user })

  // alert the help-desk managers
  const { data: managers } = await supabase.from('users')
    .select('id, is_demo').in('role', ['admin', 'manager']).eq('is_active', true)
  await notify(
    (managers || []).filter(m => !!m.is_demo === !!user.isDemo).map(m => m.id),
    'ticket_reply', `تذكرة جديدة ${ticketNumber} من ${user.name || user.email}`,
    { body: body.title, entityType: 'ticket', entityId: data.id, link: '/app/support-tickets', isDemo: !!user.isDemo })

  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
