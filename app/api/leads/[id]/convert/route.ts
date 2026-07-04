import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

/** Convert a lead into a CRM customer (marks the lead won and links it). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'leads.write') || !hasPermission(user, 'crm.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { data: lead } = await supabase.from('leads').select('*').eq('id', params.id).single()
  if (!lead) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  if (lead.customer_id) return Response.json({ success: false, message: 'Lead already converted' }, { status: 409 })

  const { data: customer, error } = await supabase.from('customers').insert({
    name: lead.name,
    company: lead.company,
    email: lead.email,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    status: 'active',
    priority: 'medium',
    assigned_to: lead.assigned_to,
    notes: lead.notes,
  }).select().single()
  if (error || !customer) return Response.json({ success: false, message: error?.message || 'Failed to create customer' }, { status: 500 })

  const { data: updated } = await supabase.from('leads').update({
    stage: 'won',
    won_at: new Date().toISOString(),
    customer_id: customer.id,
  }).eq('id', params.id).select().single()

  await logActivity({ entityType: 'lead', entityId: params.id, action: 'converted', detail: { customerId: customer.id }, user })
  await logActivity({ entityType: 'customer', entityId: customer.id, action: 'created_from_lead', detail: { leadId: params.id }, user })

  return Response.json({ success: true, data: { lead: toApi(updated), customer: toApi(customer) } }, { status: 201 })
}
