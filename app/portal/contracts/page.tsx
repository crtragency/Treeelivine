'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function PortalContractsPage() {
  const { lang } = useApp()
  const isAr = lang === 'ar'
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal').then(r => r.json())
      .then(d => { if (d.success) setContracts(d.data.contracts || []) })
      .finally(() => setLoading(false))
  }, [])

  const dstr = (d?: string) => d ? new Date(d).toLocaleDateString(isAr ? 'ar-u-ca-gregory' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
  const fmt = (n: number) => (n || 0).toLocaleString('en-US')

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>{isAr ? 'عقودي' : 'Contracts'}</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="t-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{isAr ? 'العنوان' : 'Title'}</th>
              <th>{isAr ? 'الحالة' : 'Status'}</th>
              <th style={{ textAlign: 'end' }}>{isAr ? 'القيمة' : 'Value'}</th>
              <th>{isAr ? 'من' : 'From'}</th>
              <th>{isAr ? 'إلى' : 'To'}</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map(c => (
              <tr key={c._id}>
                <td className="td-name ltr-num">{c.contractNumber}</td>
                <td>{c.title}</td>
                <td><StatusBadge status={c.status} /></td>
                <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.currency} {fmt(c.value)}</td>
                <td style={{ color: 'var(--fg-3)' }}>{dstr(c.startDate)}</td>
                <td style={{ color: 'var(--fg-3)' }}>{dstr(c.endDate)}</td>
              </tr>
            ))}
            {!contracts.length && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>{isAr ? 'لا توجد عقود' : 'No contracts'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
