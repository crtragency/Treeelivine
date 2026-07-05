import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

/** Profitability dashboard — everything computed from invoices (revenue),
 *  expenses (direct costs) and time entries × employee hourly cost (labor). */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'profitability.read')) return forbiddenResponse()

  const isDemo = !!user.isDemo
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const [
    { data: invoices },
    { data: expenses },
    { data: entries },
    { data: employees },
    { data: projects },
    { data: customers },
  ] = await Promise.all([
    supabase.from('invoices').select('id, customer_id, project_id, paid_amount, amount, issue_date, created_at').eq('is_demo', isDemo),
    supabase.from('expenses').select('id, amount, date, project_id, is_recurring_salary').eq('is_demo', isDemo),
    supabase.from('time_entries').select('employee_id, project_id, duration_seconds, started_at').eq('is_demo', isDemo).not('ended_at', 'is', null),
    supabase.from('employees').select('id, salary, hourly_cost, capacity_hours_week').eq('is_demo', isDemo),
    supabase.from('projects').select('id, name, customer_id, status').eq('is_demo', isDemo),
    supabase.from('customers').select('id, name').eq('is_demo', isDemo),
  ])

  const inRange = (d?: string | null) => {
    if (!d) return false
    const day = d.slice(0, 10)
    if (from && day < from) return false
    if (to && day > to) return false
    return true
  }
  const noFilter = !from && !to

  // labor rate per employee: explicit hourly_cost, else salary / (capacity × 4.33 weeks)
  const rate = new Map<string, number>()
  for (const e of employees || []) {
    const capacity = Number(e.capacity_hours_week) || 40
    const r = Number(e.hourly_cost) || (Number(e.salary) ? Number(e.salary) / (capacity * 4.33) : 0)
    rate.set(e.id, r)
  }

  type Row = { revenue: number; expenses: number; labor: number; hours: number }
  const blank = (): Row => ({ revenue: 0, expenses: 0, labor: 0, hours: 0 })
  const byProject = new Map<string, Row>()
  const totals = blank()

  const rangedInvoices = (invoices || []).filter(i => noFilter || inRange(i.issue_date || i.created_at))
  for (const inv of rangedInvoices) {
    const rev = Number(inv.paid_amount) || 0
    totals.revenue += rev
    if (inv.project_id) {
      if (!byProject.has(inv.project_id)) byProject.set(inv.project_id, blank())
      byProject.get(inv.project_id)!.revenue += rev
    }
  }
  for (const e of (expenses || []).filter(e => !e.is_recurring_salary && (noFilter || inRange(e.date)))) {
    const amt = Number(e.amount) || 0
    totals.expenses += amt
    if (e.project_id) {
      if (!byProject.has(e.project_id)) byProject.set(e.project_id, blank())
      byProject.get(e.project_id)!.expenses += amt
    }
  }
  for (const en of (entries || []).filter(en => noFilter || inRange(en.started_at))) {
    const hours = (Number(en.duration_seconds) || 0) / 3600
    const cost = hours * (rate.get(en.employee_id) || 0)
    totals.labor += cost
    totals.hours += hours
    if (en.project_id) {
      if (!byProject.has(en.project_id)) byProject.set(en.project_id, blank())
      const row = byProject.get(en.project_id)!
      row.labor += cost
      row.hours += hours
    }
  }

  const projectMap = new Map((projects || []).map(p => [p.id, p]))
  const customerMap = new Map((customers || []).map(c => [c.id, c]))

  const round = (n: number) => Math.round(n * 100) / 100
  const projectRows = Array.from(byProject.entries()).map(([id, r]) => {
    const p = projectMap.get(id)
    const cost = r.expenses + r.labor
    const profit = r.revenue - cost
    return {
      id, name: p?.name || '—',
      customer: p?.customer_id ? (customerMap.get(p.customer_id)?.name || null) : null,
      customerId: p?.customer_id || null,
      status: p?.status || null,
      revenue: round(r.revenue), expenses: round(r.expenses), labor: round(r.labor),
      cost: round(cost), profit: round(profit),
      margin: r.revenue > 0 ? Math.round((profit / r.revenue) * 100) : null,
      hours: round(r.hours),
    }
  }).sort((a, b) => b.profit - a.profit)

  // per-client rollup (projects + unassigned invoices matched by customer)
  const byClient = new Map<string, { revenue: number; cost: number }>()
  for (const row of projectRows) {
    if (!row.customerId) continue
    if (!byClient.has(row.customerId)) byClient.set(row.customerId, { revenue: 0, cost: 0 })
    const c = byClient.get(row.customerId)!
    c.revenue += row.revenue; c.cost += row.cost
  }
  for (const inv of rangedInvoices) {
    if (inv.project_id || !inv.customer_id) continue
    if (!byClient.has(inv.customer_id)) byClient.set(inv.customer_id, { revenue: 0, cost: 0 })
    byClient.get(inv.customer_id)!.revenue += Number(inv.paid_amount) || 0
  }
  const clientRows = Array.from(byClient.entries()).map(([id, r]) => ({
    id, name: customerMap.get(id)?.name || '—',
    revenue: round(r.revenue), cost: round(r.cost), profit: round(r.revenue - r.cost),
    margin: r.revenue > 0 ? Math.round(((r.revenue - r.cost) / r.revenue) * 100) : null,
  })).sort((a, b) => b.profit - a.profit)

  // 12-month trend (ignores the from/to filter — it is the context strip)
  const now = new Date()
  const monthly: { key: string; revenue: number; cost: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthly.push({ key: d.toISOString().slice(0, 7), revenue: 0, cost: 0 })
  }
  const idx = new Map(monthly.map((m, i) => [m.key, i]))
  for (const inv of invoices || []) {
    const i = idx.get((inv.issue_date || inv.created_at || '').slice(0, 7))
    if (i !== undefined) monthly[i].revenue += Number(inv.paid_amount) || 0
  }
  for (const e of (expenses || []).filter(e => !e.is_recurring_salary)) {
    const i = idx.get((e.date || '').slice(0, 7))
    if (i !== undefined) monthly[i].cost += Number(e.amount) || 0
  }
  for (const en of entries || []) {
    const i = idx.get((en.started_at || '').slice(0, 7))
    if (i !== undefined) monthly[i].cost += ((Number(en.duration_seconds) || 0) / 3600) * (rate.get(en.employee_id) || 0)
  }
  for (const m of monthly) { m.revenue = round(m.revenue); m.cost = round(m.cost) }

  // naive forecast: average net of the last 3 completed months
  const last3 = monthly.slice(-4, -1)
  const forecastNet = last3.length ? round(last3.reduce((s, m) => s + m.revenue - m.cost, 0) / last3.length) : null

  const totalCost = totals.expenses + totals.labor
  return Response.json({
    success: true,
    data: {
      revenue: round(totals.revenue),
      expenses: round(totals.expenses),
      labor: round(totals.labor),
      cost: round(totalCost),
      profit: round(totals.revenue - totalCost),
      margin: totals.revenue > 0 ? Math.round(((totals.revenue - totalCost) / totals.revenue) * 100) : null,
      hours: round(totals.hours),
      projects: projectRows.slice(0, 20),
      clients: clientRows.slice(0, 20),
      monthly,
      forecastNet,
    },
  })
}
