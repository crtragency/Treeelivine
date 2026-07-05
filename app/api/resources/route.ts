import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { notify } from '@/lib/notify'
import { employeeForUser } from '@/lib/time'

/** One aggregated payload for the resource board: per-employee workload %,
 *  capacity, tracked-hours utilization, vacation state and overload flags. */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'resources.read')) return forbiddenResponse()

  const isDemo = !!user.isDemo
  const today = new Date().toISOString().slice(0, 10)
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0, 0, 0, 0)

  const [
    { data: employees },
    { data: allocations },
    { data: vacations },
    { data: weekEntries },
  ] = await Promise.all([
    supabase.from('employees').select('id, name, internal_role, capacity_hours_week, user_id').eq('is_demo', isDemo),
    supabase.from('allocations').select('*, project:projects(id,name)').eq('is_demo', isDemo),
    supabase.from('vacations').select('*').eq('is_demo', isDemo),
    supabase.from('time_entries').select('employee_id, duration_seconds').eq('is_demo', isDemo)
      .gte('started_at', weekStart.toISOString()).not('ended_at', 'is', null),
  ])

  // team members see only their own row
  let visible = employees || []
  if (user.role === 'team' && !hasPermission(user, 'resources.write')) {
    const emp = await employeeForUser(user.id)
    visible = visible.filter(e => e.id === emp?.id)
  }

  const trackedByEmp = new Map<string, number>()
  for (const e of weekEntries || []) {
    trackedByEmp.set(e.employee_id, (trackedByEmp.get(e.employee_id) || 0) + (Number(e.duration_seconds) || 0))
  }

  const activeAlloc = (allocations || []).filter(a =>
    a.start_date <= today && (!a.end_date || a.end_date >= today))
  const approvedVacs = (vacations || []).filter(v => v.status === 'approved')

  const board = visible.map(e => {
    const my = activeAlloc.filter(a => a.employee_id === e.id)
    const allocatedPercent = my.reduce((s, a) => s + (Number(a.percent) || 0), 0)
    const capacity = Number(e.capacity_hours_week) || 40
    const trackedHours = Math.round(((trackedByEmp.get(e.id) || 0) / 3600) * 10) / 10
    const onVacation = approvedVacs.some(v =>
      v.employee_id === e.id && v.start_date <= today && v.end_date >= today)
    return {
      employeeId: e.id,
      name: e.name,
      position: e.internal_role || null,
      capacityHours: capacity,
      allocatedPercent,
      trackedHours,
      utilization: capacity ? Math.round((trackedHours / capacity) * 100) : 0,
      onVacation,
      overloaded: allocatedPercent > 100,
      allocations: my.map(a => ({
        id: a.id, percent: Number(a.percent),
        project: (a as any).project ? { id: (a as any).project.id, name: (a as any).project.name } : null,
        startDate: a.start_date, endDate: a.end_date,
      })),
    }
  })

  // overload alert (deduped per employee via existing unread notification)
  const overloaded = board.filter(b => b.overloaded)
  if (overloaded.length && hasPermission(user, 'resources.write')) {
    const { data: existing } = await supabase.from('notifications')
      .select('entity_id').eq('type', 'overload').is('read_at', null)
      .in('entity_id', overloaded.map(b => b.employeeId))
    const seen = new Set((existing || []).map(n => n.entity_id))
    const { data: managers } = await supabase.from('users')
      .select('id, is_demo').in('role', ['admin', 'manager']).eq('is_active', true)
    for (const b of overloaded) {
      if (seen.has(b.employeeId)) continue
      await notify(
        (managers || []).filter(m => !!m.is_demo === isDemo).map(m => m.id),
        'overload', `تحميل زائد: ${b.name} موزّع على ${b.allocatedPercent}% من طاقته`,
        { entityType: 'employee', entityId: b.employeeId, link: '/app/resources', isDemo })
    }
  }

  const pendingVacations = (vacations || []).filter(v => v.status === 'pending').length

  return Response.json({
    success: true,
    data: {
      board,
      overloadedCount: overloaded.length,
      onVacationToday: board.filter(b => b.onVacation).length,
      pendingVacations,
      avgAllocation: board.length ? Math.round(board.reduce((s, b) => s + b.allocatedPercent, 0) / board.length) : 0,
    },
  })
}
