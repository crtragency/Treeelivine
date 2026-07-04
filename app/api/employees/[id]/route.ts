import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import bcrypt from 'bcryptjs'

const SYSTEM_ROLES = ['admin', 'manager', 'team', 'finance', 'viewer']

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'team.read')) return forbiddenResponse()

  const { data: emp } = await supabase.from('employees').select('*').eq('id', params.id).single()
  if (!emp) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  const now = new Date().toISOString()
  const [{ count: taskCount }, { count: projectCount }, { count: overdueTasks }] = await Promise.all([
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('current_assignee_id', params.id).not('status', 'in', '("completed","cancelled")'),
    supabase.from('projects').select('*', { count: 'exact', head: true })
      .contains('assigned_employee_ids', [params.id]).eq('status', 'active'),
    supabase.from('tasks').select('*', { count: 'exact', head: true })
      .eq('current_assignee_id', params.id).lt('due_date', now).not('status', 'in', '("completed","cancelled")'),
  ])

  return Response.json({ success: true, data: toApi(emp), stats: { taskCount, projectCount, overdueTasks } })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'team.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  const updates: any = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.email !== undefined) updates.email = body.email
  if (body.phone !== undefined) updates.phone = body.phone
  if (body.internalRole !== undefined) updates.internal_role = body.internalRole
  if (body.internal_role !== undefined) updates.internal_role = body.internal_role
  if (body.salary !== undefined) updates.salary = body.salary
  if (body.userId !== undefined) updates.user_id = body.userId

  // login account management (create / reset password / change system role)
  if (body.password || body.systemRole) {
    const { data: emp } = await supabase.from('employees').select('user_id, email, name').eq('id', params.id).single()
    if (!emp) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
    const role = SYSTEM_ROLES.includes(body.systemRole) ? body.systemRole : undefined
    if (role === 'admin' && user.role !== 'admin') {
      return Response.json({ success: false, message: 'Only admins can grant the admin role' }, { status: 403 })
    }
    if (body.password && String(body.password).length < 6) {
      return Response.json({ success: false, message: 'Password must be at least 6 characters' }, { status: 400 })
    }
    if (emp.user_id) {
      const accUpdates: any = {}
      if (body.password) accUpdates.password = await bcrypt.hash(body.password, 10)
      if (role) accUpdates.role = role
      if (Object.keys(accUpdates).length) {
        const { error: uerr } = await supabase.from('users').update(accUpdates).eq('id', emp.user_id)
        if (uerr) return Response.json({ success: false, message: uerr.message }, { status: 500 })
      }
    } else if (body.password) {
      const email = (body.email || emp.email || '').toLowerCase()
      if (!email) return Response.json({ success: false, message: 'Email is required to create a login account' }, { status: 400 })
      const { data: existing } = await supabase.from('users').select('id').eq('email', email).single()
      if (existing) return Response.json({ success: false, message: 'Email already has an account' }, { status: 409 })
      const hash = await bcrypt.hash(body.password, 10)
      const { data: account, error: cerr } = await supabase.from('users').insert({
        email, password: hash, name: body.name || emp.name, role: role || 'team', is_active: true,
      }).select('id').single()
      if (cerr || !account) return Response.json({ success: false, message: cerr?.message || 'Failed to create account' }, { status: 500 })
      updates.user_id = account.id
    }
  }

  // account-only edits leave employee fields untouched
  if (!Object.keys(updates).length) {
    const { data: current } = await supabase.from('employees').select('*').eq('id', params.id).single()
    if (!current) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
    return Response.json({ success: true, data: toApi(current) })
  }

  const { data, error } = await supabase.from('employees').update(updates).eq('id', params.id).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  if (!data) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  return Response.json({ success: true, data: toApi(data) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'team.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { error } = await supabase.from('employees').delete().eq('id', params.id)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true })
}
