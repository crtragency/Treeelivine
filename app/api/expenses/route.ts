import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { syncRecurringSalaryExpenses } from '@/lib/salary-sync'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'finance.read')) return forbiddenResponse()

  await syncRecurringSalaryExpenses()

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const month = searchParams.get('month')
  const employeeId = searchParams.get('employeeId')

  let query = supabase.from('expenses')
    .select('*, employee:employees(id,name,email,internal_role)')
    .order('date', { ascending: false })

  query = query.eq('is_demo', !!user.isDemo)
  if (category) query = query.eq('category', category)
  if (employeeId) query = query.eq('employee_id', employeeId)
  if (month) {
    const [y, m] = month.split('-').map(Number)
    const start = new Date(y, m - 1, 1).toISOString()
    const end = new Date(y, m, 1).toISOString()
    query = query.gte('date', start).lt('date', end)
  }

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'finance.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  if (!body.amount || !body.category) {
    return Response.json({ success: false, message: 'Amount and category are required' }, { status: 400 })
  }

  const { data, error } = await supabase.from('expenses').insert({
    description: body.description,
    category: body.category,
    amount: body.amount,
    date: body.date || new Date().toISOString(),
    employee_id: body.employeeId || body.employee_id || null,
    project_id: body.projectId || body.project_id || null,
    is_recurring_salary: body.isRecurringSalary || body.is_recurring_salary || false,
    salary_next_due_date: body.salaryNextDueDate || body.salary_next_due_date || null,
  }).select().single()

  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
