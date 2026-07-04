import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

// Weighted forecast: probability a lead in this stage eventually closes
const STAGE_WEIGHT: Record<string, number> = {
  new: 0.1, contacted: 0.2, meeting_scheduled: 0.4, proposal_sent: 0.6, negotiation: 0.8,
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'leads.read')) return forbiddenResponse()

  const { data: leads, error } = await supabase.from('leads')
    .select('id, stage, expected_value, won_at, lost_at')
    .eq('is_demo', !!user.isDemo)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  const all = leads || []
  const won = all.filter(l => l.stage === 'won')
  const lost = all.filter(l => l.stage === 'lost')
  const open = all.filter(l => !['won', 'lost'].includes(l.stage))
  const closed = won.length + lost.length

  const byStage: Record<string, { count: number; value: number }> = {}
  for (const l of all) {
    byStage[l.stage] = byStage[l.stage] || { count: 0, value: 0 }
    byStage[l.stage].count++
    byStage[l.stage].value += Number(l.expected_value) || 0
  }

  return Response.json({
    success: true,
    data: {
      totalLeads: all.length,
      openLeads: open.length,
      wonDeals: won.length,
      lostDeals: lost.length,
      conversionRate: closed > 0 ? Math.round((won.length / closed) * 100) : 0,
      wonValue: won.reduce((s, l) => s + (Number(l.expected_value) || 0), 0),
      pipelineValue: open.reduce((s, l) => s + (Number(l.expected_value) || 0), 0),
      forecast: Math.round(open.reduce((s, l) => s + (Number(l.expected_value) || 0) * (STAGE_WEIGHT[l.stage] ?? 0.3), 0)),
      byStage,
    },
  })
}
