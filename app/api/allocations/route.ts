import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'resources.read')) return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')
  const projectId = searchParams.get('projectId')

  let query = supabase.from('allocations')
    .select('*, employee:employees(id,name), project:projects(id,name)')
    .eq('is_demo', !!user.isDemo)
    .order('start_date', { ascending: false })
  if (employeeId) query = query.eq('employee_id', employeeId)
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'resources.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  if (!body.employeeId || !body.projectId || !body.startDate) {
    return Response.json({ success: false, message: 'employeeId, projectId and startDate are required' }, { status: 400 })
  }
  const percent = Number(body.percent) || 50
  if (percent <= 0 || percent > 100) {
    return Response.json({ success: false, message: 'Percent must be between 1 and 100' }, { status: 400 })
  }

  const { data, error } = await supabase.from('allocations').insert({
    employee_id: body.employeeId,
    project_id: body.projectId,
    percent,
    start_date: body.startDate,
    end_date: body.endDate || null,
    notes: body.notes || null,
    is_demo: !!user.isDemo,
  }).select('*, employee:employees(id,name), project:projects(id,name)').single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
