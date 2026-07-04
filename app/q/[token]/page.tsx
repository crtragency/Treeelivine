'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

/** Public proposal page — reached via the unguessable share link, no login. */
export default function PublicQuotePage() {
  const { token } = useParams<{ token: string }>()
  const { lang, t } = useApp()
  const isAr = lang === 'ar'
  const [quote, setQuote] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/q/${token}`)
    const data = await res.json()
    if (data.success) { setQuote(data.data); setCompany(data.data.company) }
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  async function respond(action: 'accept' | 'reject') {
    if (!name.trim()) { setMsg(isAr ? 'اكتب اسمك أولاً' : 'Please enter your name first'); return }
    setBusy(true); setMsg('')
    const res = await fetch(`/api/q/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, name }),
    })
    const data = await res.json()
    if (data.success) load()
    else setMsg(data.message)
    setBusy(false)
  }

  const tq = (k: string) => t[`quoteShare.${k}`] || k
  const fmt = (n: number) => (n || 0).toLocaleString('en-US')
  const dstr = (d?: string) => d ? new Date(d).toLocaleDateString(isAr ? 'ar-u-ca-gregory' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

  if (loading) return <div className="loading-page"><div className="spinner" /></div>
  if (!quote) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', color: 'var(--fg-4)' }}>
      {isAr ? 'العرض غير موجود' : 'Proposal not found'}
    </div>
  )

  const discountAmount = quote.discountType === 'percent'
    ? (quote.subtotal || 0) * (Number(quote.discountValue) / 100)
    : quote.discountType === 'fixed' ? Number(quote.discountValue) : 0
  const responded = ['accepted', 'rejected'].includes(quote.status)
  const expired = quote.status === 'expired' || (quote.validUntil && new Date(quote.validUntil) < new Date())

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', padding: 'clamp(16px, 4vw, 48px) 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Actions bar (hidden on print) */}
        <div className="q-actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => window.print()}>🖨 {tq('downloadPdf')}</button>
        </div>

        {/* Proposal document */}
        <div id="proposal-print" className="card-surface" style={{ padding: 'clamp(24px, 5vw, 48px)' }}>
          {/* Brand header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-8)', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--brand-primary)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" width={34} height={34} style={{ objectFit: 'contain' }} />
              <div>
                <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--fg-1)' }}>{company?.name || 'Treeelivine'}</div>
                {company?.address && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-4)' }}>{company.address}</div>}
              </div>
            </div>
            <div style={{ textAlign: 'end' }}>
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--fg-1)' }}>{isAr ? 'عرض سعر' : 'PROPOSAL'}</div>
              <div className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', color: 'var(--fg-4)' }}>{quote.quoteNumber}</div>
            </div>
          </div>

          {/* Meta */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 'var(--space-6)' }}>
            <div>
              <div className="label">{tq('proposalFor')}</div>
              <div style={{ fontSize: 'var(--fs-base)', fontWeight: 600, color: 'var(--fg-1)' }}>{quote.customer?.name || '—'}</div>
              {quote.customer?.company && <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-3)' }}>{quote.customer.company}</div>}
            </div>
            <div style={{ textAlign: 'end' }}>
              {quote.validUntil && (
                <>
                  <div className="label">{tq('validUntil')}</div>
                  <div style={{ fontSize: 'var(--fs-sm)', color: expired ? 'var(--danger-600)' : 'var(--fg-2)' }}>{dstr(quote.validUntil)}</div>
                </>
              )}
            </div>
          </div>

          {/* Items */}
          <table className="t-table" style={{ marginBottom: 'var(--space-5)' }}>
            <thead>
              <tr>
                <th>{isAr ? 'الخدمة' : 'Service'}</th>
                <th style={{ textAlign: 'end' }}>{isAr ? 'الكمية' : 'Qty'}</th>
                <th style={{ textAlign: 'end' }}>{isAr ? 'السعر' : 'Price'}</th>
                <th style={{ textAlign: 'end' }}>{isAr ? 'الإجمالي' : 'Total'}</th>
              </tr>
            </thead>
            <tbody>
              {(quote.items || []).map((it: any, i: number) => (
                <tr key={i}>
                  <td className="td-name">{it.description}</td>
                  <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)' }}>{it.qty ?? 1}</td>
                  <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)' }}>{fmt(it.price)}</td>
                  <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmt((it.qty ?? 1) * (it.price || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: 260, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', color: 'var(--fg-3)' }}>
                <span>{isAr ? 'المجموع' : 'Subtotal'}</span>
                <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)' }}>{quote.currency} {fmt(quote.subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', color: 'var(--success-600)' }}>
                  <span>{tq('discount')}{quote.discountType === 'percent' ? ` (${quote.discountValue}%)` : ''}</span>
                  <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)' }}>− {quote.currency} {fmt(discountAmount)}</span>
                </div>
              )}
              {Number(quote.taxRate) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-sm)', color: 'var(--fg-3)' }}>
                  <span>{isAr ? 'الضريبة' : 'Tax'} ({quote.taxRate}%)</span>
                  <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)' }}>{quote.currency} {fmt(quote.taxAmount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border-2)', fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--fg-1)' }}>
                <span>{isAr ? 'الإجمالي' : 'Total'}</span>
                <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)', color: 'var(--brand-primary)' }}>{quote.currency} {fmt(quote.total)}</span>
              </div>
            </div>
          </div>

          {quote.notes && (
            <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)' }}>
              <div className="label" style={{ marginBottom: 4 }}>{t.notes || 'Notes'}</div>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{quote.notes}</p>
            </div>
          )}
        </div>

        {/* Response area (hidden on print) */}
        <div className="q-actions card-surface" style={{ padding: 'var(--space-5)' }}>
          {responded ? (
            <div style={{ textAlign: 'center', color: quote.status === 'accepted' ? 'var(--success-600)' : 'var(--fg-3)', fontSize: 'var(--fs-base)', fontWeight: 600 }}>
              {quote.status === 'accepted' ? `✓ ${tq('acceptedMsg')}` : tq('rejectedMsg')}
              {quote.acceptedByName && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-4)', marginTop: 4, fontWeight: 400 }}>{quote.acceptedByName} · {dstr(quote.respondedAt)}</div>}
            </div>
          ) : expired ? (
            <div style={{ textAlign: 'center', color: 'var(--danger-600)', fontSize: 'var(--fs-sm)' }}>{tq('expiredMsg')}</div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label className="label">{tq('yourName')}</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={() => respond('accept')} disabled={busy}>✓ {tq('acceptProposal')}</button>
              <button className="btn btn-secondary" onClick={() => respond('reject')} disabled={busy}>{tq('rejectProposal')}</button>
            </div>
          )}
          {msg && <p style={{ marginTop: 8, fontSize: 'var(--fs-xs)', color: 'var(--danger-500)', textAlign: 'center' }}>{msg}</p>}
        </div>
      </div>

      <style>{`@media print { .q-actions { display: none !important; } #proposal-print { border: none !important; box-shadow: none !important; } body { background: #fff !important; } }`}</style>
    </div>
  )
}
