import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()

  const { data, error } = await supabase.from('sla_policies').select('*')
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

/** Update SLA targets: body = [{ priority, firstResponseMinutes, resolutionMinutes }] */
export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'helpdesk.manage')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  const rows = Array.isArray(body) ? body : []
  for (const row of rows) {
    if (!['low', 'medium', 'high', 'urgent'].includes(row.priority)) continue
    await supabase.from('sla_policies').update({
      first_response_minutes: Math.max(1, Number(row.firstResponseMinutes) || 60),
      resolution_minutes: Math.max(1, Number(row.resolutionMinutes) || 1440),
    }).eq('priority', row.priority)
  }
  const { data } = await supabase.from('sla_policies').select('*')
  return Response.json({ success: true, data: toApi(data || []) })
}
