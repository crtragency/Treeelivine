'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function InvoicePDFPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const { settings } = useApp()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/invoices/${invoiceId}`)
      .then(r => r.json())
      .then(d => { if (d.success) setInvoice(d.data) })
      .finally(() => setLoading(false))
  }, [invoiceId])

  if (loading) return <LoadingSpinner />
  if (!invoice) return <p style={{ padding: '2rem', color: 'var(--text-muted)' }}>Invoice not found</p>

  const customer = invoice.customer || invoice.customerId
  const subtotal = (invoice.items || []).reduce((s: number, i: any) => s + Number(i.qty ?? i.quantity ?? 1) * Number(i.price ?? i.unitPrice ?? 0), 0)

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/app/finance" className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>← Back</Link>
        <button className="btn btn-primary" onClick={() => window.print()} style={{ fontSize: '0.85rem' }}>🖨️ Print / Save PDF</button>
      </div>

      <div id="invoice-print" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '2.5rem', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{settings?.companyName || 'Treeelivine'}</h1>
            {settings?.companyAddress && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{settings.companyAddress}</p>}
          </div>
          <div style={{ textAlign: 'end' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>INVOICE</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{invoice.invoiceNumber}</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bill To</p>
            <p style={{ fontWeight: 600 }}>{customer?.name}</p>
            {customer?.company && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{customer.company}</p>}
            {customer?.email && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{customer.email}</p>}
            {customer?.phone && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{customer.phone}</p>}
          </div>
          <div style={{ textAlign: 'end' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Details</p>
            {invoice.issueDate && <p style={{ fontSize: '0.875rem' }}>Issue: {new Date(invoice.issueDate).toLocaleDateString()}</p>}
            {invoice.dueDate && <p style={{ fontSize: '0.875rem' }}>Due: {new Date(invoice.dueDate).toLocaleDateString()}</p>}
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem', fontWeight: 600, color: invoice.status === 'paid' ? 'var(--success)' : invoice.status === 'overdue' ? 'var(--danger)' : 'var(--warning)' }}>{invoice.status?.toUpperCase()}</p>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', borderBottom: '2px solid var(--border)' }}>
              {['Description', 'Qty', 'Unit Price', 'Total'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: h === 'Description' ? 'start' : 'end', fontSize: '0.8rem', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.75rem 1rem' }}>{item.description}</td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'end' }}>{item.qty ?? item.quantity ?? 1}</td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'end' }}>{invoice.currency} {Number(item.price ?? item.unitPrice ?? 0).toLocaleString()}</td>
                <td style={{ padding: '0.75rem 1rem', textAlign: 'end', fontWeight: 500 }}>{invoice.currency} {(Number(item.qty ?? item.quantity ?? 1) * Number(item.price ?? item.unitPrice ?? 0)).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 250 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Subtotal</span>
              <span style={{ fontSize: '0.875rem' }}>{invoice.currency} {subtotal.toLocaleString()}</span>
            </div>
            {invoice.taxRate > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Tax ({invoice.taxRate}%)</span>
                <span style={{ fontSize: '0.875rem' }}>{invoice.currency} {(invoice.taxAmount || 0).toLocaleString()}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0' }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--accent)' }}>{invoice.currency} {(invoice.amount || subtotal).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--surface2)', borderRadius: 8 }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>Notes</p>
            <p style={{ fontSize: '0.875rem' }}>{invoice.notes}</p>
          </div>
        )}
      </div>

      <style>{`@media print { nav, .btn, a[href] { display: none !important; } #invoice-print { border: none !important; box-shadow: none; } }`}</style>
    </div>
  )
}
