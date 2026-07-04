import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { employeeForUser } from '@/lib/time'

/** Current running timer for the signed-in user. */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()

  const emp = await employeeForUser(user.id)
  if (!emp) return Response.json({ success: true, data: null, employee: null })

  const { data } = await supabase.from('time_entries')
    .select('*, project:projects(id,name), task:tasks(id,title)')
    .eq('employee_id', emp.id).is('ended_at', null).maybeSingle()
  return Response.json({ success: true, data: data ? toApi(data) : null, employee: toApi(emp) })
}

/** Start a timer. */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (!hasPermission(user, 'time.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const emp = await employeeForUser(user.id)
  if (!emp) return Response.json({ success: false, message: 'No employee record linked to your account' }, { status: 400 })

  const body = await req.json().catch(() => ({}))

  const { data, error } = await supabase.from('time_entries').insert({
    employee_id: emp.id,
    project_id: body.projectId || null,
    task_id: body.taskId || null,
    description: body.description || null,
    billable: body.billable !== false,
    source: 'timer',
  }).select('*, project:projects(id,name), task:tasks(id,title)').single()

  if (error) {
    if ((error as any).code === '23505' || /idx_time_entries_running|duplicate/i.test(error.message)) {
      return Response.json({ success: false, message: 'A timer is already running' }, { status: 409 })
    }
    return Response.json({ success: false, message: error.message }, { status: 500 })
  }
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}

/** Stop the running timer. */
export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (!hasPermission(user, 'time.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const emp = await employeeForUser(user.id)
  if (!emp) return Response.json({ success: false, message: 'No employee record linked to your account' }, { status: 400 })

  const { data: running } = await supabase.from('time_entries')
    .select('id, started_at').eq('employee_id', emp.id).is('ended_at', null).maybeSingle()
  if (!running) return Response.json({ success: false, message: 'No running timer' }, { status: 404 })

  const ended = new Date()
  const duration = Math.max(1, Math.round((ended.getTime() - new Date(running.started_at).getTime()) / 1000))

  const { data, error } = await supabase.from('time_entries')
    .update({ ended_at: ended.toISOString(), duration_seconds: duration })
    .eq('id', running.id)
    .select('*, project:projects(id,name), task:tasks(id,title)').single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) })
}
