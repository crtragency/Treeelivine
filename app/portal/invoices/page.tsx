'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function PortalInvoicesPage() {
  const { t } = useApp()
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal')
      .then(r => r.json())
      .then(d => { if (d.success) setInvoices(d.data.invoices || []) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>{t.invoices || 'Invoices'}</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              {['Invoice #', 'Amount', 'Status', 'Due Date', 'Actions'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'start', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoices.map(inv => (
              <tr key={inv._id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{inv.invoiceNumber}</td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{inv.currency} {(inv.amount ?? inv.amountBase ?? 0).toLocaleString()}</td>
                <td style={{ padding: '0.75rem 1rem' }}><StatusBadge status={inv.status} /></td>
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  <Link href={`/portal/invoices/${inv._id}/pdf`} className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}>View PDF</Link>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No invoices</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
