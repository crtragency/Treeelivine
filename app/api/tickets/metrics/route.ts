import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

const mins = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()

  const [{ data: tickets, error }, { data: policies }] = await Promise.all([
    supabase.from('support_tickets')
      .select('id, status, priority, created_at, first_response_at, resolved_at, satisfaction_rating')
      .eq('is_demo', !!user.isDemo),
    supabase.from('sla_policies').select('*'),
  ])
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  const policyMap = new Map((policies || []).map(p => [p.priority, p]))
  const all = tickets || []

  const responded = all.filter(t => t.first_response_at)
  const avgFirstResponseMinutes = responded.length
    ? Math.round(responded.reduce((s, t) => s + mins(t.created_at, t.first_response_at), 0) / responded.length)
    : null

  const resolved = all.filter(t => t.resolved_at)
  const avgResolutionMinutes = resolved.length
    ? Math.round(resolved.reduce((s, t) => s + mins(t.created_at, t.resolved_at), 0) / resolved.length)
    : null

  // SLA compliance: responded within policy (among responded) + resolved within policy (among resolved)
  let slaMet = 0, slaTotal = 0
  for (const t of responded) {
    const p = policyMap.get(t.priority || 'medium')
    if (!p) continue
    slaTotal++
    if (mins(t.created_at, t.first_response_at) <= p.first_response_minutes) slaMet++
  }
  for (const t of resolved) {
    const p = policyMap.get(t.priority || 'medium')
    if (!p) continue
    slaTotal++
    if (mins(t.created_at, t.resolved_at) <= p.resolution_minutes) slaMet++
  }
  const slaCompliance = slaTotal ? Math.round((slaMet / slaTotal) * 100) : null

  const rated = all.filter(t => t.satisfaction_rating)
  const avgCsat = rated.length
    ? Math.round((rated.reduce((s, t) => s + t.satisfaction_rating, 0) / rated.length) * 10) / 10
    : null

  return Response.json({
    success: true,
    data: {
      total: all.length,
      open: all.filter(t => !['resolved', 'closed'].includes(t.status)).length,
      avgFirstResponseMinutes,
      avgResolutionMinutes,
      slaCompliance,
      avgCsat,
      ratedCount: rated.length,
      policies: (policies || []).reduce((acc: any, p) => { acc[p.priority] = { firstResponseMinutes: p.first_response_minutes, resolutionMinutes: p.resolution_minutes }; return acc }, {}),
    },
  })
}
