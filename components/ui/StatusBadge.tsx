'use client'
import { useApp } from '@/contexts/AppContext'

// Maps every status/priority value used across the app to a semantic pill kind
const STATUS_KIND: Record<string, string> = {
  // customers
  active: 'active', inactive: 'draft', lead: 'info', prospect: 'pending',
  negotiation: 'pending', churned: 'blocked',
  // projects / tasks
  planning: 'info', on_hold: 'pending', pending: 'pending', in_progress: 'info',
  in_review: 'pending', completed: 'completed', cancelled: 'draft',
  // briefs
  not_started: 'draft', awaiting_client: 'pending', approved: 'active', rejected: 'blocked',
  // invoices / quotations
  paid: 'active', unpaid: 'pending', partial: 'pending', overdue: 'blocked',
  draft: 'draft', sent: 'info', accepted: 'active', expired: 'draft',
  // tickets
  open: 'info', resolved: 'active', closed: 'draft',
  // priority
  urgent: 'blocked', high: 'blocked', medium: 'pending', low: 'draft',
}

export default function StatusBadge({ status, label }: { status: string; label?: string }) {
  const { t } = useApp()
  const kind = STATUS_KIND[status] || 'draft'
  const text = label || t[`status.${status}`] || t[status] || status.replace(/_/g, ' ')
  return (
    <span className={`pill pill-${kind}`}>
      <span className="dot" />
      {text}
    </span>
  )
}
