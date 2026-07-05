import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'
import { notify } from '@/lib/notify'

async function loadTicket(id: string) {
  const { data } = await supabase.from('support_tickets')
    .select('*, customer:customers(id,name,user_id), assignee:employees(id,name,user_id)')
    .eq('id', id).single()
  return data as any
}

function clientOwnsTicket(user: any, ticket: any) {
  return ticket.customer?.user_id === user.id || ticket.created_by === user.id
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()

  const ticket = await loadTicket(params.id)
  if (!ticket) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  if (user.role === 'client' && !clientOwnsTicket(user, ticket)) return forbiddenResponse()

  let query = supabase.from('ticket_messages')
    .select('*').eq('ticket_id', params.id).order('created_at', { ascending: true })
  if (user.role === 'client') query = query.eq('internal', false)

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const ticket = await loadTicket(params.id)
  if (!ticket) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  const isClient = user.role === 'client'
  if (isClient && !clientOwnsTicket(user, ticket)) return forbiddenResponse()

  const body = await req.json()
  if (!body.body?.trim()) return Response.json({ success: false, message: 'Message body required' }, { status: 400 })
  const internal = !isClient && !!body.internal

  const { data, error } = await supabase.from('ticket_messages').insert({
    ticket_id: params.id,
    author_id: user.id,
    author_name: user.name || user.email,
    body: body.body.trim(),
    internal,
    is_demo: !!user.isDemo,
  }).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  // side effects run in parallel — the sender shouldn't wait on fan-out
  const jobs: Promise<unknown>[] = []

  // first public staff reply stamps first_response_at (feeds FRT / SLA metrics)
  const updates: any = {}
  if (!isClient && !internal && !ticket.first_response_at) updates.first_response_at = new Date().toISOString()
  if (isClient && ticket.status === 'waiting_client') updates.status = 'in_progress'
  if (Object.keys(updates).length) {
    jobs.push(supabase.from('support_tickets').update(updates).eq('id', params.id) as unknown as Promise<unknown>)
  }

  jobs.push(logActivity({ entityType: 'ticket', entityId: params.id, action: internal ? 'internal_note' : 'replied', user }))

  // fan out the reply notification to the other side of the conversation
  if (!internal) {
    const title = `${ticket.ticket_number || ''} — رد جديد على التذكرة`.trim()
    if (isClient) {
      jobs.push((async () => {
        const targets: (string | null)[] = [ticket.assignee?.user_id]
        if (ticket.escalated_to) {
          const { data: esc } = await supabase.from('employees').select('user_id').eq('id', ticket.escalated_to).single()
          targets.push(esc?.user_id || null)
        }
        await notify(targets, 'ticket_reply', title,
          { body: body.body.slice(0, 120), entityType: 'ticket', entityId: params.id, link: '/app/support-tickets', isDemo: !!user.isDemo, excludeUserId: user.id })
      })())
    } else {
      jobs.push(notify([ticket.customer?.user_id, ticket.created_by], 'ticket_reply', title,
        { body: body.body.slice(0, 120), entityType: 'ticket', entityId: params.id, link: '/portal/support', isDemo: !!user.isDemo, excludeUserId: user.id }))
    }
  }

  await Promise.all(jobs)
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
