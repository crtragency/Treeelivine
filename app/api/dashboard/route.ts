import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { syncRecurringSalaryExpenses } from '@/lib/salary-sync'

function rangeStart(range: string): Date | null {
  const now = new Date()
  switch (range) {
    case 'today': { const d = new Date(now); d.setHours(0, 0, 0, 0); return d }
    case '7d': return new Date(now.getTime() - 7 * 86400000)
    case '30d': return new Date(now.getTime() - 30 * 86400000)
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1)
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    default: return null
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()

  await syncRecurringSalaryExpenses()

  const { searchParams } = new URL(req.url)
  const start = rangeStart(searchParams.get('range') || '30d')

  const isDemo = !!user.isDemo
  const [
    { data: customers },
    { data: projects },
    { data: tasks },
    { data: invoices },
    { data: expenses },
  ] = await Promise.all([
    supabase.from('customers').select('id, name, status, created_at').eq('is_demo', isDemo),
    supabase.from('projects').select('id, name, status, task_progress_percent, due_date, updated_at, customer_id, customer:customers(id,name)').eq('is_demo', isDemo),
    supabase.from('tasks').select('id, title, status, due_date, project_id, updated_at, assignee:employees(id,name)').eq('is_demo', isDemo),
    supabase.from('invoices').select('id, invoice_number, status, amount, paid_amount, issue_date, created_at, updated_at, customer:customers(id,name)').eq('is_demo', isDemo),
    supabase.from('expenses').select('id, amount, date, is_recurring_salary').eq('is_demo', isDemo),
  ])

  const now = new Date()
  const inRange = (d: string | null | undefined) => !start || (d ? new Date(d) >= start : false)

  const openStatuses = (s: string) => !['completed', 'cancelled'].includes(s)

  const activeCustomers = customers?.filter(c => c.status === 'active').length ?? 0
  const activeProjects = projects?.filter(p => ['active', 'in_progress'].includes(p.status)).length ?? 0
  const openTasks = tasks?.filter(t => openStatuses(t.status)).length ?? 0
  const overdueTasksList = tasks?.filter(t => t.due_date && new Date(t.due_date) < now && openStatuses(t.status)) ?? []

  const rangeInvoices = invoices?.filter(i => inRange(i.issue_date || i.created_at)) ?? []
  const collected = rangeInvoices.reduce((s, i) => s + (Number(i.paid_amount) || 0), 0)
  const unpaidAmt = invoices?.filter(i => i.status !== 'paid').reduce((s, i) => s + (Number(i.amount) - Number(i.paid_amount || 0)), 0) ?? 0
  const unpaidInvoices = invoices?.filter(i => i.status !== 'paid').length ?? 0
  const overdueInvoices = invoices?.filter(i => i.status === 'overdue').length ?? 0
  const nonSalaryExpenses = expenses?.filter(e => !e.is_recurring_salary) ?? []
  const totalExpenses = nonSalaryExpenses.filter(e => inRange(e.date)).reduce((s, e) => s + (Number(e.amount) || 0), 0)

  // Monthly revenue vs expenses — last 12 calendar months, real data
  const monthly: { key: string; revenue: number; expenses: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthly.push({ key: d.toISOString().slice(0, 7), revenue: 0, expenses: 0 })
  }
  const monthIndex = new Map(monthly.map((m, i) => [m.key, i]))
  for (const inv of invoices || []) {
    const key = (inv.issue_date || inv.created_at || '').slice(0, 7)
    const idx = monthIndex.get(key)
    if (idx !== undefined) monthly[idx].revenue += Number(inv.paid_amount) || 0
  }
  for (const e of nonSalaryExpenses) {
    const key = (e.date || '').slice(0, 7)
    const idx = monthIndex.get(key)
    if (idx !== undefined) monthly[idx].expenses += Number(e.amount) || 0
  }

  // Projects needing attention: overdue tasks, or on hold / past due date
  const overdueByProject = new Map<string, number>()
  for (const t of overdueTasksList) {
    if (t.project_id) overdueByProject.set(t.project_id, (overdueByProject.get(t.project_id) || 0) + 1)
  }
  const projectsAttention = (projects || [])
    .map(p => ({
      id: p.id,
      name: p.name,
      customer: (p as any).customer?.name || null,
      status: p.status,
      overdue: overdueByProject.get(p.id) || 0,
      progress: Number(p.task_progress_percent) || 0,
      pastDue: !!(p.due_date && new Date(p.due_date) < now && !['completed', 'cancelled'].includes(p.status)),
    }))
    .filter(p => p.overdue > 0 || p.pastDue || p.status === 'on_hold')
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, 5)

  // Recent activity: latest touched tasks + invoices + customers
  type Act = { type: string; title: string; status: string; at: string }
  const activity: Act[] = []
  for (const t of tasks || []) activity.push({ type: 'task', title: t.title, status: t.status, at: t.updated_at })
  for (const i of invoices || []) activity.push({ type: 'invoice', title: i.invoice_number || '—', status: i.status, at: i.updated_at })
  for (const c of customers || []) activity.push({ type: 'customer', title: c.name, status: c.status, at: c.created_at })
  activity.sort((a, b) => (b.at || '').localeCompare(a.at || ''))

  // CRM pipeline counts
  const pipeline: Record<string, number> = {}
  for (const c of customers || []) pipeline[c.status] = (pipeline[c.status] || 0) + 1

  return Response.json({
    success: true,
    data: {
      activeCustomers,
      totalCustomers: customers?.length ?? 0,
      activeProjects,
      openTasks,
      overdueTasks: overdueTasksList.length,
      collected,
      unpaidAmt,
      unpaidInvoices,
      overdueInvoices,
      totalExpenses,
      net: collected - totalExpenses,
      monthly,
      projectsAttention,
      activity: activity.slice(0, 7),
      pipeline,
    },
  })
}
