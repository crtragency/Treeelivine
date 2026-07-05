import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { notify } from '@/lib/notify'
import { employeeForUser } from '@/lib/time'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const status = searchParams.get('status')

  let query = supabase.from('vacations')
    .select('*, employee:employees(id,name)')
    .eq('is_demo', !!user.isDemo)
    .order('start_date', { ascending: false })

  // without resources.read, staff only see their own requests
  if (!hasPermission(user, 'resources.read')) {
    const emp = await employeeForUser(user.id)
    if (!emp) return Response.json({ success: true, data: [] })
    query = query.eq('employee_id', emp.id)
  } else if (employeeId) {
    query = query.eq('employee_id', employeeId)
  }
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  if (!body.startDate || !body.endDate) {
    return Response.json({ success: false, message: 'startDate and endDate are required' }, { status: 400 })
  }
  if (body.endDate < body.startDate) {
    return Response.json({ success: false, message: 'endDate must be after startDate' }, { status: 400 })
  }

  // staff without resources.write can only request for themselves
  let employeeId = body.employeeId
  const canManage = hasPermission(user, 'resources.write')
  if (!canManage || !employeeId) {
    const emp = await employeeForUser(user.id)
    if (!canManage && employeeId && emp?.id !== employeeId) return forbiddenResponse()
    if (!employeeId) employeeId = emp?.id
  }
  if (!employeeId) return Response.json({ success: false, message: 'No employee profile linked to your account' }, { status: 400 })

  const { data, error } = await supabase.from('vacations').insert({
    employee_id: employeeId,
    type: ['vacation', 'sick', 'unpaid', 'other'].includes(body.type) ? body.type : 'vacation',
    start_date: body.startDate,
    end_date: body.endDate,
    status: canManage && body.status === 'approved' ? 'approved' : 'pending',
    notes: body.notes || null,
    approved_by: canManage && body.status === 'approved' ? user.id : null,
    is_demo: !!user.isDemo,
  }).select('*, employee:employees(id,name)').single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  // pending requests ping the managers
  if (data.status === 'pending') {
    const { data: managers } = await supabase.from('users')
      .select('id, is_demo').in('role', ['admin', 'manager']).eq('is_active', true)
    await notify(
      (managers || []).filter(m => !!m.is_demo === !!user.isDemo).map(m => m.id),
      'vacation_request',
      `طلب إجازة جديد من ${(data as any).employee?.name || user.name || user.email}`,
      { entityType: 'vacation', entityId: data.id, link: '/app/resources', isDemo: !!user.isDemo, excludeUserId: user.id })
  }

  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
