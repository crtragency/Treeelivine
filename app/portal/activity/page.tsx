'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { activityLabel } from '@/components/entity/ActivityTimeline'

const TYPE_LABEL: Record<string, { ar: string; en: string }> = {
  project: { ar: 'مشروع', en: 'Project' },
  invoice: { ar: 'فاتورة', en: 'Invoice' },
  quotation: { ar: 'عرض سعر', en: 'Quotation' },
  contract: { ar: 'عقد', en: 'Contract' },
  customer: { ar: 'الحساب', en: 'Account' },
}

export default function PortalActivityPage() {
  const { lang } = useApp()
  const isAr = lang === 'ar'
  const [activity, setActivity] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal').then(r => r.json())
      .then(d => { if (d.success) setActivity(d.data.activity || []) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>{isAr ? 'آخر النشاط' : 'Activity'}</h2>
      <div className="card">
        {activity.length === 0 ? (
          <p style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>{isAr ? 'لا يوجد نشاط بعد' : 'No activity yet'}</p>
        ) : activity.map((a, i) => (
          <div key={a._id} style={{
            display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 0',
            borderBottom: i < activity.length - 1 ? '1px solid var(--border-1)' : 'none',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)', marginTop: 7, flexShrink: 0, opacity: 0.7 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-1)' }}>
                <span style={{ fontWeight: 600 }}>{(TYPE_LABEL[a.entityType] ? (isAr ? TYPE_LABEL[a.entityType].ar : TYPE_LABEL[a.entityType].en) : a.entityType)}</span>
                {' · '}{activityLabel(a.action, isAr)}
                {a.detail?.to && <span style={{ marginInlineStart: 8, display: 'inline-block', verticalAlign: 'middle' }}><StatusBadge status={a.detail.to} /></span>}
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-4)', marginTop: 2 }}>
                {new Date(a.createdAt).toLocaleString(isAr ? 'ar-u-ca-gregory' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
