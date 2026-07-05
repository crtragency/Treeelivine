import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { notify } from '@/lib/notify'
import { employeeForUser } from '@/lib/time'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { data: vac } = await supabase.from('vacations')
    .select('*, employee:employees(id,name,user_id)').eq('id', params.id).single()
  if (!vac) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  const canManage = hasPermission(user, 'resources.write')
  const isOwn = (vac as any).employee?.user_id === user.id

  const body = await req.json()
  const updates: any = {}

  // approve / reject is a manager action
  if (body.status !== undefined && body.status !== vac.status) {
    if (!canManage) return forbiddenResponse()
    if (!['pending', 'approved', 'rejected'].includes(body.status)) {
      return Response.json({ success: false, message: 'Invalid status' }, { status: 400 })
    }
    updates.status = body.status
    updates.approved_by = ['approved', 'rejected'].includes(body.status) ? user.id : null
  }

  // date/type edits: owner while pending, or a manager
  if (body.startDate !== undefined || body.endDate !== undefined || body.type !== undefined || body.notes !== undefined) {
    if (!canManage && !(isOwn && vac.status === 'pending')) return forbiddenResponse()
    if (body.startDate !== undefined) updates.start_date = body.startDate
    if (body.endDate !== undefined) updates.end_date = body.endDate
    if (body.type !== undefined && ['vacation', 'sick', 'unpaid', 'other'].includes(body.type)) updates.type = body.type
    if (body.notes !== undefined) updates.notes = body.notes || null
  }

  if (!Object.keys(updates).length) return Response.json({ success: true, data: toApi(vac) })

  const { data, error } = await supabase.from('vacations').update(updates).eq('id', params.id)
    .select('*, employee:employees(id,name,user_id)').single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  if (updates.status && ['approved', 'rejected'].includes(updates.status)) {
    await notify([(data as any).employee?.user_id], 'vacation_request',
      updates.status === 'approved' ? 'تمت الموافقة على طلب الإجازة' : 'تم رفض طلب الإجازة',
      { entityType: 'vacation', entityId: params.id, link: '/app/resources', isDemo: !!user.isDemo, excludeUserId: user.id })
  }
  return Response.json({ success: true, data: toApi(data) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  if (!hasPermission(user, 'resources.write')) {
    // owners may withdraw their own pending request
    const { data: vac } = await supabase.from('vacations').select('employee_id, status').eq('id', params.id).single()
    if (!vac) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
    const emp = await employeeForUser(user.id)
    if (!emp || emp.id !== vac.employee_id || vac.status !== 'pending') return forbiddenResponse()
  }

  const { error } = await supabase.from('vacations').delete().eq('id', params.id)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true })
}
