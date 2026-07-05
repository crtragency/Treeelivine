import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()

  const { data } = await supabase.from('contracts')
    .select('*, customer:customers(id,name,company,user_id), project:projects(id,name)')
    .eq('id', params.id).single()
  if (!data) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  if (user.role === 'client') {
    if ((data as any).customer?.user_id !== user.id) return forbiddenResponse()
  } else if (!hasPermission(user, 'contracts.read')) {
    return forbiddenResponse()
  }
  return Response.json({ success: true, data: toApi(data) })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'contracts.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  const updates: any = {}
  if (body.title !== undefined) updates.title = body.title
  if (body.customerId !== undefined) updates.customer_id = body.customerId || null
  if (body.projectId !== undefined) updates.project_id = body.projectId || null
  if (body.value !== undefined) updates.value = body.value
  if (body.currency !== undefined) updates.currency = body.currency
  if (body.startDate !== undefined) updates.start_date = body.startDate || null
  if (body.endDate !== undefined) updates.end_date = body.endDate || null
  if (body.body !== undefined) updates.body = body.body
  if (body.templateId !== undefined) updates.template_id = body.templateId || null
  if (body.autoRenew !== undefined) updates.auto_renew = !!body.autoRenew
  if (body.renewalReminderDays !== undefined) updates.renewal_reminder_days = body.renewalReminderDays
  if (body.status !== undefined) {
    updates.status = body.status
    if (body.status === 'signed') {
      updates.signed_at = new Date().toISOString()
      if (body.signedByName) updates.signed_by_name = body.signedByName
    }
  }

  const { data, error } = await supabase.from('contracts').update(updates).eq('id', params.id)
    .select('*, customer:customers(id,name,company)').single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  if (!data) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  if (body.status !== undefined) {
    await logActivity({ entityType: 'contract', entityId: params.id, action: 'status_changed', detail: { to: body.status }, user })
  }
  return Response.json({ success: true, data: toApi(data) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'contracts.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { error } = await supabase.from('contracts').delete().eq('id', params.id)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true })
}
