import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'contracts.read')) return forbiddenResponse()

  const { data: contracts, error } = await supabase.from('contracts')
    .select('id, status, value, end_date, renewed_from_id')
    .eq('is_demo', !!user.isDemo)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  const now = new Date()
  const soon = new Date(now.getTime() + 30 * 86400000)
  const all = contracts || []
  const activeLike = all.filter(c => ['active', 'signed'].includes(c.status))
  const expiringSoon = activeLike.filter(c =>
    c.end_date && new Date(c.end_date) >= now && new Date(c.end_date) <= soon).length
  // renewal rate: share of ended terms that were renewed rather than left to expire
  const renewedCount = all.filter(c => c.status === 'renewed').length
  const expiredCount = all.filter(c => c.status === 'expired').length
  const renewalRate = renewedCount + expiredCount > 0
    ? Math.round((renewedCount / (renewedCount + expiredCount)) * 100) : null

  return Response.json({
    success: true,
    data: {
      active: activeLike.length,
      expiringSoon,
      renewalRate,
      totalValue: activeLike.reduce((s, c) => s + (Number(c.value) || 0), 0),
      total: all.length,
    },
  })
}
