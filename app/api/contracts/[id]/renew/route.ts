import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

/** Clone the contract into a new active term and mark the old one renewed. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'contracts.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json().catch(() => ({}))

  const { data: old } = await supabase.from('contracts').select('*').eq('id', params.id).single()
  if (!old) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  if (['renewed', 'cancelled'].includes(old.status)) {
    return Response.json({ success: false, message: 'Contract cannot be renewed' }, { status: 409 })
  }

  // New term: defaults to same duration starting where the old one ends
  const oldStart = old.start_date ? new Date(old.start_date) : new Date()
  const oldEnd = old.end_date ? new Date(old.end_date) : null
  const durationMs = oldEnd ? oldEnd.getTime() - oldStart.getTime() : 365 * 86400000
  const newStart = body.startDate ? new Date(body.startDate) : (oldEnd && oldEnd > new Date() ? oldEnd : new Date())
  const newEnd = body.endDate ? new Date(body.endDate) : new Date(newStart.getTime() + durationMs)

  const { count } = await supabase.from('contracts').select('*', { count: 'exact', head: true })
  const contractNumber = `CT-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`

  const { data, error } = await supabase.from('contracts').insert({
    contract_number: contractNumber,
    title: old.title,
    customer_id: old.customer_id,
    project_id: old.project_id,
    status: 'active',
    value: body.value ?? old.value,
    currency: old.currency,
    start_date: newStart.toISOString(),
    end_date: newEnd.toISOString(),
    body: old.body,
    template_id: old.template_id,
    auto_renew: old.auto_renew,
    renewal_reminder_days: old.renewal_reminder_days,
    renewed_from_id: old.id,
    is_demo: old.is_demo,
  }).select('*, customer:customers(id,name,company)').single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  await supabase.from('contracts').update({ status: 'renewed' }).eq('id', old.id)
  await logActivity({ entityType: 'contract', entityId: old.id, action: 'renewed', detail: { newContract: contractNumber }, user })
  await logActivity({ entityType: 'contract', entityId: data.id, action: 'created', detail: { renewedFrom: old.contract_number }, user })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
