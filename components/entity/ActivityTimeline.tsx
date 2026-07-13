'use client'
import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/contexts/AppContext'

const ACTION_LABELS: Record<string, { ar: string; en: string }> = {
  created: { ar: 'تم الإنشاء', en: 'Created' },
  created_from_lead: { ar: 'أُنشئ من عميل محتمل', en: 'Created from lead' },
  updated: { ar: 'تم التعديل', en: 'Updated' },
  stage_changed: { ar: 'تغيّرت المرحلة', en: 'Stage changed' },
  status_changed: { ar: 'تغيّرت الحالة', en: 'Status changed' },
  note_added: { ar: 'أُضيفت ملاحظة', en: 'Note added' },
  file_uploaded: { ar: 'رُفع ملف', en: 'File uploaded' },
  converted: { ar: 'تحوّل إلى عميل', en: 'Converted to customer' },
  sent: { ar: 'تم الإرسال', en: 'Sent' },
  viewed: { ar: 'شاهده العميل', en: 'Viewed by client' },
  accepted: { ar: 'وافق العميل', en: 'Accepted' },
  rejected: { ar: 'رفض العميل', en: 'Rejected' },
  contract_created: { ar: 'أُنشئ عقد', en: 'Contract created' },
}

export function activityLabel(action: string, isAr: boolean) {
  const l = ACTION_LABELS[action]
  return l ? (isAr ? l.ar : l.en) : action.replace(/_/g, ' ')
}

export default function ActivityTimeline({ entityType, entityId, refreshKey = 0 }: {
  entityType: string; entityId: string; refreshKey?: number
}) {
  const { lang, t } = useApp()
  const isAr = lang === 'ar'
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch(`/api/activities?entityType=${entityType}&entityId=${entityId}`)
    const data = await res.json()
    if (data.success) setItems(data.data)
    setLoading(false)
  }, [entityType, entityId])

  useEffect(() => { load() }, [load, refreshKey])

  if (loading) return <p style={{ padding: 'var(--space-4)', color: 'var(--fg-4)', fontSize: 'var(--fs-sm)' }}>{t.loading || '...'}</p>
  if (!items.length) return <p style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--fg-4)', fontSize: 'var(--fs-sm)' }}>{isAr ? 'لا يوجد نشاط بعد' : 'No activity yet'}</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((a, i) => (
        <div key={a._id} className="act-item" style={{
          display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0',
          borderBottom: i < items.length - 1 ? '1px solid var(--border-1)' : 'none',
          animationDelay: `${Math.min(i, 8) * 0.04}s`,
        }}>
          <span className="act-dot" style={{
            width: 8, height: 8, borderRadius: '50%', background: 'var(--brand-primary)',
            marginTop: 6, flexShrink: 0, opacity: 0.7,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-1)' }}>
              {activityLabel(a.action, isAr)}
              {a.detail?.from && a.detail?.to && (
                <span style={{ color: 'var(--fg-3)' }}> — {t[`status.${a.detail.from}`] || a.detail.from} ← {t[`status.${a.detail.to}`] || a.detail.to}</span>
              )}
              {a.detail?.to && !a.detail?.from && (
                <span style={{ color: 'var(--fg-3)' }}> — {t[`status.${a.detail.to}`] || a.detail.to}</span>
              )}
              {a.detail?.fileName && <span style={{ color: 'var(--fg-3)' }}> — {a.detail.fileName}</span>}
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-4)', marginTop: 2 }}>
              {a.actorName ? `${a.actorName} · ` : ''}
              {new Date(a.createdAt).toLocaleString(isAr ? 'ar-u-ca-gregory' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
