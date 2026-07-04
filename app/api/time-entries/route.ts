import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

import { employeeForUser } from '@/lib/time'

const canSeeAll = (user: any) => user.role === 'admin' || hasPermission(user, 'time.reports')

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (!hasPermission(user, 'time.read')) return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const projectId = searchParams.get('projectId')
  const employeeId = searchParams.get('employeeId')

  let query = supabase.from('time_entries')
    .select('*, employee:employees(id,name), project:projects(id,name), task:tasks(id,title)')
    .eq('is_demo', !!user.isDemo)
    .order('started_at', { ascending: false })
    .limit(200)

  if (from) query = query.gte('started_at', from)
  if (to) query = query.lt('started_at', to)
  if (projectId) query = query.eq('project_id', projectId)

  if (canSeeAll(user)) {
    if (employeeId) query = query.eq('employee_id', employeeId)
  } else {
    const emp = await employeeForUser(user.id)
    if (!emp) return Response.json({ success: true, data: [], employee: null })
    query = query.eq('employee_id', emp.id)
  }

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

/** Manual entry. */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (!hasPermission(user, 'time.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  let employeeId = body.employeeId
  if (!employeeId || !canSeeAll(user)) {
    const emp = await employeeForUser(user.id)
    if (!emp) return Response.json({ success: false, message: 'No employee record linked to your account' }, { status: 400 })
    employeeId = emp.id
  }
  if (!body.startedAt || !body.endedAt) {
    return Response.json({ success: false, message: 'startedAt and endedAt required' }, { status: 400 })
  }
  const started = new Date(body.startedAt)
  const ended = new Date(body.endedAt)
  const duration = Math.round((ended.getTime() - started.getTime()) / 1000)
  if (duration <= 0) return Response.json({ success: false, message: 'End must be after start' }, { status: 400 })

  const { data, error } = await supabase.from('time_entries').insert({
    employee_id: employeeId,
    project_id: body.projectId || null,
    task_id: body.taskId || null,
    description: body.description || null,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    duration_seconds: duration,
    billable: body.billable !== false,
    source: 'manual',
  }).select('*, employee:employees(id,name), project:projects(id,name)').single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
