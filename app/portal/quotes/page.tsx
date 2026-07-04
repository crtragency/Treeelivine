'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function PortalQuotationsPage() {
  const { lang } = useApp()
  const isAr = lang === 'ar'
  const [quotes, setQuotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal').then(r => r.json())
      .then(d => { if (d.success) setQuotes((d.data.quotations || []).filter((q: any) => q.status !== 'draft')) })
      .finally(() => setLoading(false))
  }, [])

  const fmt = (n: number) => (n || 0).toLocaleString('en-US')

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>{isAr ? 'عروض الأسعار' : 'Quotations'}</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="t-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{isAr ? 'الحالة' : 'Status'}</th>
              <th style={{ textAlign: 'end' }}>{isAr ? 'الإجمالي' : 'Total'}</th>
              <th>{isAr ? 'صالح حتى' : 'Valid until'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {quotes.map(q => (
              <tr key={q._id}>
                <td className="td-name ltr-num">{q.quoteNumber}</td>
                <td><StatusBadge status={q.status} /></td>
                <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{q.currency} {fmt(q.total)}</td>
                <td style={{ color: 'var(--fg-3)' }}>{q.validUntil ? new Date(q.validUntil).toLocaleDateString(isAr ? 'ar-u-ca-gregory' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                <td style={{ textAlign: 'end' }}>
                  <a href={`/q/${q.publicToken}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}>
                    {isAr ? 'عرض / قبول' : 'View / Accept'}
                  </a>
                </td>
              </tr>
            ))}
            {!quotes.length && <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>{isAr ? 'لا توجد عروض أسعار' : 'No quotations'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
