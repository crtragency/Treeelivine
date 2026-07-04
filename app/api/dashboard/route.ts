import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse } from '@/lib/auth'
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

  const canFinance = hasPermission(user, 'finance.read')
  const canCrm = hasPermission(user, 'crm.read')
  const isTeamScope = user.role === 'team'

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
    supabase.from('tasks').select('id, title, status, due_date, project_id, current_assignee_id, updated_at, assignee:employees(id,name)').eq('is_demo', isDemo),
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
  let scopedProjects = projects || []
  if (isTeamScope) {
    const { data: empRow } = await supabase.from('employees').select('id').eq('user_id', user.id).single()
    if (empRow) scopedProjects = scopedProjects.filter(p =>
      Array.isArray((p as any).assigned_employee_ids) && (p as any).assigned_employee_ids.includes(empRow.id))
    else scopedProjects = []
  }
  const projectsAttention = (scopedProjects || [])
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
  if (canFinance) for (const i of invoices || []) activity.push({ type: 'invoice', title: i.invoice_number || '—', status: i.status, at: i.updated_at })
  if (canCrm) for (const c of customers || []) activity.push({ type: 'customer', title: c.name, status: c.status, at: c.created_at })
  activity.sort((a, b) => (b.at || '').localeCompare(a.at || ''))

  // CRM pipeline counts
  const pipeline: Record<string, number> = {}
  for (const c of customers || []) pipeline[c.status] = (pipeline[c.status] || 0) + 1

  // Personal scope for team members: their own tasks / projects / hours
  let my: any = null
  if (isTeamScope) {
    const { data: emp } = await supabase.from('employees').select('id, name').eq('user_id', user.id).single()
    if (emp) {
      const myOpen = (tasks || []).filter(t2 => t2.current_assignee_id === emp.id && openStatuses(t2.status))
      const myOverdue = myOpen.filter(t2 => t2.due_date && new Date(t2.due_date) < now)
      const myProjects = (projects || []).filter(p =>
        Array.isArray((p as any).assigned_employee_ids) && (p as any).assigned_employee_ids.includes(emp.id))
      const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0, 0, 0, 0)
      const { data: weekEntries } = await supabase.from('time_entries')
        .select('duration_seconds').eq('employee_id', emp.id).gte('started_at', weekStart.toISOString()).not('ended_at', 'is', null)
      my = {
        openTasks: myOpen.length,
        overdueTasks: myOverdue.length,
        activeProjects: myProjects.filter(p => ['active', 'in_progress'].includes(p.status)).length,
        weekSeconds: (weekEntries || []).reduce((s2, e) => s2 + (Number(e.duration_seconds) || 0), 0),
        tasks: myOpen
          .sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999'))
          .slice(0, 7)
          .map(t2 => ({
            id: t2.id, title: t2.title, status: t2.status, dueDate: t2.due_date,
            project: (projects || []).find(p => p.id === t2.project_id)?.name || null,
          })),
      }
    } else {
      my = { openTasks: 0, overdueTasks: 0, activeProjects: 0, weekSeconds: 0, tasks: [] }
    }
  }

  return Response.json({
    success: true,
    data: {
      scope: isTeamScope ? 'personal' : 'full',
      activeCustomers,
      totalCustomers: customers?.length ?? 0,
      activeProjects,
      openTasks,
      overdueTasks: overdueTasksList.length,
      // finance figures only for roles that may see money
      collected: canFinance ? collected : null,
      unpaidAmt: canFinance ? unpaidAmt : null,
      unpaidInvoices: canFinance ? unpaidInvoices : null,
      overdueInvoices: canFinance ? overdueInvoices : null,
      totalExpenses: canFinance ? totalExpenses : null,
      net: canFinance ? collected - totalExpenses : null,
      monthly: canFinance ? monthly : null,
      projectsAttention,
      activity: activity.slice(0, 7),
      pipeline: canCrm ? pipeline : null,
      my,
    },
  })
}
