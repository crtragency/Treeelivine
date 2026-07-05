import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

/** Client rates a resolved ticket (CSAT), once. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { rating, note } = await req.json()
  const r = Number(rating)
  if (!r || r < 1 || r > 5) return Response.json({ success: false, message: 'Rating must be 1–5' }, { status: 400 })

  const { data: ticket } = await supabase.from('support_tickets')
    .select('id, status, satisfaction_rating, created_by, customer:customers(id,user_id)')
    .eq('id', params.id).single()
  if (!ticket) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  const owns = (ticket as any).customer?.user_id === user.id || ticket.created_by === user.id
  if (user.role === 'client' && !owns) return forbiddenResponse()
  if (!['resolved', 'closed'].includes(ticket.status)) {
    return Response.json({ success: false, message: 'Ticket is not resolved yet' }, { status: 409 })
  }
  if (ticket.satisfaction_rating) {
    return Response.json({ success: false, message: 'Already rated' }, { status: 409 })
  }

  const { data, error } = await supabase.from('support_tickets').update({
    satisfaction_rating: r,
    satisfaction_note: note || null,
  }).eq('id', params.id).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  await logActivity({ entityType: 'ticket', entityId: params.id, action: 'rated', detail: { rating: r }, user })
  return Response.json({ success: true, data: toApi(data) })
}
