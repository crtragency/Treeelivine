import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const search   = searchParams.get('search') || ''
  const status   = searchParams.get('status') || ''
  const priority = searchParams.get('priority') || ''
  const department = searchParams.get('department') || ''

  let query = supabase
    .from('support_tickets')
    .select('*, customer:customers(id,name,company), assignee:employees(id,name)')
    .order('created_at', { ascending: false })

  query = query.eq('is_demo', !!user.isDemo)
  if (status)   query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)
  if (department) query = query.eq('department', department)
  if (search)   query = query.ilike('title', `%${search}%`)

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
  const { title, description, customerId, assignedTo, status, priority, department } = body
  if (!title) return Response.json({ success: false, message: 'Title required' }, { status: 400 })

  const { count } = await supabase.from('support_tickets').select('*', { count: 'exact', head: true })
  const ticketNumber = `TKT-${String((count || 0) + 1).padStart(4, '0')}`

  const { data, error } = await supabase.from('support_tickets').insert({
    ticket_number: ticketNumber,
    title,
    description: description || null,
    customer_id: customerId || null,
    assigned_to: assignedTo || null,
    status: status || 'open',
    priority: priority || 'medium',
    department: department || 'general',
    created_by: user.id,
  }).select().single()

  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) })
}
