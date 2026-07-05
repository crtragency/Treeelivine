import { supabase } from './supabase'
import { notify } from './notify'
import { logActivity } from './activity'

let lastSweep = 0

/** Contract lifecycle sweep — runs opportunistically on dashboard load
 *  (same pattern as syncRecurringSalaryExpenses). Marks past-end-date
 *  contracts expired and raises one contract_expiring notification per
 *  contract entering its renewal-reminder window. Never throws. */
export async function checkContractExpiry() {
  if (Date.now() - lastSweep < 10 * 60 * 1000) return
  lastSweep = Date.now()
  try {
    const now = new Date()

    // 1. expire finished terms
    const { data: expired } = await supabase.from('contracts')
      .update({ status: 'expired' })
      .in('status', ['active', 'signed'])
      .lt('end_date', now.toISOString())
      .select('id, contract_number, is_demo')
    for (const c of expired || []) {
      await logActivity({ entityType: 'contract', entityId: c.id, action: 'expired' })
    }

    // 2. reminder window → notify admins/managers (once per contract)
    const { data: active } = await supabase.from('contracts')
      .select('id, title, contract_number, end_date, renewal_reminder_days, is_demo')
      .in('status', ['active', 'signed'])
      .not('end_date', 'is', null)
    const dueSoon = (active || []).filter(c => {
      const days = Number(c.renewal_reminder_days) || 30
      const end = new Date(c.end_date)
      return end > now && end.getTime() - now.getTime() <= days * 86400000
    })
    if (!dueSoon.length) return

    const { data: existing } = await supabase.from('notifications')
      .select('entity_id').eq('type', 'contract_expiring')
      .in('entity_id', dueSoon.map(c => c.id))
    const alreadyNotified = new Set((existing || []).map(n => n.entity_id))

    const { data: managers } = await supabase.from('users')
      .select('id, is_demo').in('role', ['admin', 'manager']).eq('is_active', true)

    for (const c of dueSoon) {
      if (alreadyNotified.has(c.id)) continue
      const targets = (managers || []).filter(u => !!u.is_demo === !!c.is_demo).map(u => u.id)
      const daysLeft = Math.ceil((new Date(c.end_date).getTime() - now.getTime()) / 86400000)
      await notify(targets, 'contract_expiring',
        `العقد ${c.contract_number || c.title} ينتهي خلال ${daysLeft} يوم`,
        { entityType: 'contract', entityId: c.id, link: '/app/contracts', isDemo: !!c.is_demo })
    }
  } catch (e) {
    console.error('checkContractExpiry failed:', e)
  }
}
