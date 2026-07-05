import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'contracts.read')) return forbiddenResponse()

  const { data, error } = await supabase.from('contract_templates')
    .select('*').eq('is_demo', !!user.isDemo).order('created_at', { ascending: false })
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'contracts.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  if (!body.name) return Response.json({ success: false, message: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase.from('contract_templates').insert({
    name: body.name,
    body: body.body || null,
    default_duration_months: body.defaultDurationMonths ?? 12,
    default_value: body.defaultValue ?? 0,
    created_by: user.id,
  }).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
