import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { employeeForUser } from '@/lib/time'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (!hasPermission(user, 'time.read')) return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase.from('time_entries')
    .select('duration_seconds, billable, employee_id, project_id, started_at, employee:employees(id,name), project:projects(id,name)')
    .eq('is_demo', !!user.isDemo)
    .not('ended_at', 'is', null)
  if (from) query = query.gte('started_at', from)
  if (to) query = query.lt('started_at', to)

  // without the reports permission you only see your own hours
  if (!(user.role === 'admin' || hasPermission(user, 'time.reports'))) {
    const emp = await employeeForUser(user.id)
    if (!emp) return Response.json({ success: true, data: { byEmployee: [], byProject: [], totals: { total: 0, billable: 0, nonBillable: 0 } } })
    query = query.eq('employee_id', emp.id)
  }

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  const entries = data || []
  const agg = (keyFn: (e: any) => string | null, nameFn: (e: any) => string) => {
    const map = new Map<string, { id: string; name: string; total: number; billable: number; nonBillable: number }>()
    for (const e of entries) {
      const key = keyFn(e)
      if (!key) continue
      const cur = map.get(key) || { id: key, name: nameFn(e), total: 0, billable: 0, nonBillable: 0 }
      const secs = Number(e.duration_seconds) || 0
      cur.total += secs
      if (e.billable) cur.billable += secs; else cur.nonBillable += secs
      map.set(key, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }

  const total = entries.reduce((s, e) => s + (Number(e.duration_seconds) || 0), 0)
  const billable = entries.filter(e => e.billable).reduce((s, e) => s + (Number(e.duration_seconds) || 0), 0)

  return Response.json({
    success: true,
    data: {
      byEmployee: agg(e => e.employee_id, e => e.employee?.name || '—'),
      byProject: agg(e => e.project_id, e => e.project?.name || '—'),
      totals: { total, billable, nonBillable: total - billable },
    },
  })
}
