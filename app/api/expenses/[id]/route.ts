import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'finance.read')) return forbiddenResponse()

  const { data } = await supabase.from('expenses')
    .select('*, employee:employees(id,name,email)')
    .eq('id', params.id).single()
  if (!data) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  return Response.json({ success: true, data: toApi(data) })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'finance.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  const updates: any = {}
  if (body.description !== undefined) updates.description = body.description
  if (body.category !== undefined) updates.category = body.category
  if (body.amount !== undefined) updates.amount = body.amount
  if (body.date !== undefined) updates.date = body.date
  if (body.employeeId !== undefined) updates.employee_id = body.employeeId
  if (body.employee_id !== undefined) updates.employee_id = body.employee_id
  if (body.projectId !== undefined) updates.project_id = body.projectId || null
  if (body.isRecurringSalary !== undefined) updates.is_recurring_salary = body.isRecurringSalary
  if (body.salaryNextDueDate !== undefined) updates.salary_next_due_date = body.salaryNextDueDate

  const { data, error } = await supabase.from('expenses').update(updates).eq('id', params.id).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  if (!data) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  return Response.json({ success: true, data: toApi(data) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'finance.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { error } = await supabase.from('expenses').delete().eq('id', params.id)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true })
}
