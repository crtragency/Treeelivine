import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import bcrypt from 'bcryptjs'

const SYSTEM_ROLES = ['admin', 'manager', 'team', 'finance', 'viewer']

/** Create a login account for an employee. Returns { userId } or { error }. */
async function createLoginAccount(actor: any, email: string, name: string, password: string, systemRole: string) {
  const role = SYSTEM_ROLES.includes(systemRole) ? systemRole : 'team'
  if (role === 'admin' && actor.role !== 'admin') {
    return { error: 'Only admins can grant the admin role' }
  }
  const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).single()
  if (existing) return { error: 'Email already has an account' }
  const hash = await bcrypt.hash(password, 10)
  const { data: account, error } = await supabase.from('users').insert({
    email: email.toLowerCase(), password: hash, name, role, is_active: true,
  }).select('id').single()
  if (error || !account) return { error: error?.message || 'Failed to create account' }
  return { userId: account.id }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'team.read')) return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const internalRole = searchParams.get('internalRole')

  let query = supabase.from('employees').select('*, account:users(id,role,is_active)').order('name')
  query = query.eq('is_demo', !!user.isDemo)
  if (internalRole) query = query.eq('internal_role', internalRole)

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  let result = data || []
  if (search) {
    const s = search.toLowerCase()
    result = result.filter(e => e.name?.toLowerCase().includes(s) || e.email?.toLowerCase().includes(s))
  }

  return Response.json({ success: true, data: toApi(result) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'team.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()

  // optional: create a login account for this employee
  let userId = body.userId || body.user_id || null
  if (body.password) {
    if (!body.email) return Response.json({ success: false, message: 'Email is required to create a login account' }, { status: 400 })
    if (String(body.password).length < 6) return Response.json({ success: false, message: 'Password must be at least 6 characters' }, { status: 400 })
    const acc = await createLoginAccount(user, body.email, body.name, body.password, body.systemRole)
    if ('error' in acc) return Response.json({ success: false, message: acc.error }, { status: 409 })
    userId = acc.userId
  }

  const { data, error } = await supabase.from('employees').insert({
    name: body.name,
    email: body.email,
    phone: body.phone,
    internal_role: body.internalRole || body.internal_role,
    salary: body.salary,
    user_id: userId,
  }).select().single()

  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
