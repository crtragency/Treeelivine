import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'projects.read')) return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const status = searchParams.get('status')

  let query = supabase.from('projects')
    .select('*, customer:customers(id,name,email,company)')
    .order('updated_at', { ascending: false })

  query = query.eq('is_demo', !!user.isDemo)
  if (status) query = query.eq('status', status)
  const customerId = searchParams.get('customerId')
  if (customerId) query = query.eq('customer_id', customerId)

  if (user.role === 'team') {
    const { data: emp } = await supabase.from('employees').select('id').eq('user_id', user.id).single()
    if (emp) query = query.contains('assigned_employee_ids', [emp.id])
  }

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  let result = data || []
  if (search) {
    const s = search.toLowerCase()
    result = result.filter(p => p.name?.toLowerCase().includes(s) || p.description?.toLowerCase().includes(s))
  }

  return Response.json({ success: true, data: toApi(result) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'projects.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  if (!body.name) return Response.json({ success: false, message: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase.from('projects').insert({
    name: body.name,
    description: body.description,
    customer_id: body.customerId || body.customer_id || null,
    status: body.status || 'planning',
    brief: body.brief,
    brief_status: body.briefStatus || body.brief_status || 'not_started',
    assigned_employee_ids: body.assignedEmployeeIds || body.assigned_employee_ids || [],
    due_date: body.dueDate || body.due_date || null,
    start_date: body.startDate || body.start_date || null,
    notes: body.notes,
  }).select().single()

  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
