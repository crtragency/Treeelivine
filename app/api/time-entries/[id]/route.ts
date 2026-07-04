import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { employeeForUser } from '@/lib/time'

async function canTouch(user: any, entryId: string): Promise<{ ok: boolean; status?: number; message?: string }> {
  const { data: entry } = await supabase.from('time_entries').select('employee_id').eq('id', entryId).single()
  if (!entry) return { ok: false, status: 404, message: 'Not found' }
  if (user.role === 'admin') return { ok: true }
  const emp = await employeeForUser(user.id)
  if (emp && emp.id === entry.employee_id) return { ok: true }
  return { ok: false, status: 403, message: 'Permission denied' }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client' || !hasPermission(user, 'time.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const gate = await canTouch(user, params.id)
  if (!gate.ok) return Response.json({ success: false, message: gate.message }, { status: gate.status })

  const body = await req.json()
  const updates: any = {}
  if (body.description !== undefined) updates.description = body.description
  if (body.projectId !== undefined) updates.project_id = body.projectId || null
  if (body.taskId !== undefined) updates.task_id = body.taskId || null
  if (body.billable !== undefined) updates.billable = body.billable
  if (body.startedAt !== undefined) updates.started_at = body.startedAt
  if (body.endedAt !== undefined) updates.ended_at = body.endedAt
  if (updates.started_at || updates.ended_at) {
    const { data: cur } = await supabase.from('time_entries').select('started_at, ended_at').eq('id', params.id).single()
    const s = new Date(updates.started_at || cur?.started_at)
    const e = new Date(updates.ended_at || cur?.ended_at)
    if (e && s && e > s) updates.duration_seconds = Math.round((e.getTime() - s.getTime()) / 1000)
  }

  const { data, error } = await supabase.from('time_entries').update(updates).eq('id', params.id)
    .select('*, employee:employees(id,name), project:projects(id,name)').single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client' || !hasPermission(user, 'time.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const gate = await canTouch(user, params.id)
  if (!gate.ok) return Response.json({ success: false, message: gate.message }, { status: gate.status })

  const { error } = await supabase.from('time_entries').delete().eq('id', params.id)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true })
}
