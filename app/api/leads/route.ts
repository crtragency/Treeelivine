import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'leads.read')) return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const stage = searchParams.get('stage')
  const assigned = searchParams.get('assignedTo')
  const source = searchParams.get('source')
  const search = searchParams.get('search')

  let query = supabase.from('leads')
    .select('*, assignee:employees(id,name)')
    .eq('is_demo', !!user.isDemo)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  if (stage) query = query.eq('stage', stage)
  if (assigned) query = query.eq('assigned_to', assigned)
  if (source) query = query.eq('source', source)
  if (search) query = query.ilike('name', `%${search}%`)

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'leads.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  if (!body.name) return Response.json({ success: false, message: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase.from('leads').insert({
    name: body.name,
    company: body.company || null,
    email: body.email || null,
    phone: body.phone || null,
    whatsapp: body.whatsapp || null,
    source: body.source || 'other',
    stage: body.stage || 'new',
    position: Date.now(),
    score: body.score ?? 0,
    expected_value: body.expectedValue ?? 0,
    currency: body.currency || 'SAR',
    assigned_to: body.assignedTo || null,
    next_reminder_at: body.nextReminderAt || null,
    notes: body.notes || null,
  }).select('*, assignee:employees(id,name)').single()

  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  await logActivity({ entityType: 'lead', entityId: data.id, action: 'created', user })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
