'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'

/** Public contract-signing page — reached via the unguessable share link, no login. */
export default function PublicContractPage() {
  const { token } = useParams<{ token: string }>()
  const { lang } = useApp()
  const isAr = lang === 'ar'
  const [contract, setContract] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/c/${token}`)
    const data = await res.json()
    if (data.success) { setContract(data.data); setCompany(data.data.company) }
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  async function sign() {
    if (!name.trim()) { setMsg(isAr ? 'اكتب اسمك أولاً' : 'Please enter your name first'); return }
    if (!agree) { setMsg(isAr ? 'يجب الموافقة على بنود العقد' : 'You must agree to the contract terms'); return }
    setBusy(true); setMsg('')
    const res = await fetch(`/api/c/${token}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    })
    const data = await res.json()
    if (data.success) load()
    else setMsg(data.message)
    setBusy(false)
  }

  const fmt = (n: number) => (n || 0).toLocaleString('en-US')
  const dstr = (d?: string) => d ? new Date(d).toLocaleDateString(isAr ? 'ar-u-ca-gregory' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

  if (loading) return <div className="loading-page"><div className="spinner" /></div>
  if (!contract) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)', color: 'var(--fg-4)' }}>
      {isAr ? 'العقد غير موجود' : 'Contract not found'}
    </div>
  )

  const signed = ['signed', 'active'].includes(contract.status)
  const closed = ['expired', 'cancelled', 'renewed'].includes(contract.status)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', padding: 'clamp(16px, 4vw, 48px) 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div className="q-actions" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => window.print()}>🖨 {isAr ? 'تحميل PDF' : 'Download PDF'}</button>
        </div>

        <div id="contract-print" className="card-surface" style={{ padding: 'clamp(24px, 5vw, 48px)' }}>
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
              <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--fg-1)' }}>{isAr ? 'عقد' : 'CONTRACT'}</div>
              <div className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-sm)', color: 'var(--fg-4)' }}>{contract.contractNumber}</div>
            </div>
          </div>

          <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: 'var(--fg-1)', marginBottom: 'var(--space-4)' }}>{contract.title}</h1>

          {/* Meta grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16, marginBottom: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--bg-surface-2)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div className="label">{isAr ? 'الطرف الثاني' : 'Client'}</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--fg-1)' }}>{contract.customer?.name || '—'}</div>
              {contract.customer?.company && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-4)' }}>{contract.customer.company}</div>}
            </div>
            <div>
              <div className="label">{isAr ? 'قيمة العقد' : 'Value'}</div>
              <div className="ltr-num" style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)' }}>{contract.currency} {fmt(contract.value)}</div>
            </div>
            <div>
              <div className="label">{isAr ? 'تاريخ البداية' : 'Start date'}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-2)' }}>{dstr(contract.startDate)}</div>
            </div>
            <div>
              <div className="label">{isAr ? 'تاريخ النهاية' : 'End date'}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-2)' }}>{dstr(contract.endDate)}</div>
            </div>
          </div>

          {/* Contract body */}
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-2)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
            {contract.body || (isAr ? 'لا توجد بنود مكتوبة لهذا العقد.' : 'No written terms for this contract.')}
          </div>

          {/* Signature block */}
          {signed && contract.signedByName && (
            <div style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-4)', borderTop: '1px dashed var(--border-2)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div className="label">{isAr ? 'وُقّع بواسطة' : 'Signed by'}</div>
                <div style={{ fontSize: 'var(--fs-base)', fontWeight: 700, color: 'var(--fg-1)', fontStyle: 'italic' }}>{contract.signedByName}</div>
              </div>
              <div style={{ textAlign: 'end' }}>
                <div className="label">{isAr ? 'التاريخ' : 'Date'}</div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-2)' }}>{dstr(contract.signedAt)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Sign area (hidden on print) */}
        <div className="q-actions card-surface" style={{ padding: 'var(--space-5)' }}>
          {signed ? (
            <div style={{ textAlign: 'center', color: 'var(--success-600)', fontSize: 'var(--fs-base)', fontWeight: 600 }}>
              ✓ {contract.signedByName
                ? (isAr ? 'تم توقيع العقد' : 'Contract signed')
                : (isAr ? 'هذا العقد ساري بالفعل' : 'This contract is already in effect')}
              {contract.signedByName && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-4)', marginTop: 4, fontWeight: 400 }}>{contract.signedByName} · {dstr(contract.signedAt)}</div>}
            </div>
          ) : closed ? (
            <div style={{ textAlign: 'center', color: 'var(--danger-600)', fontSize: 'var(--fs-sm)' }}>
              {isAr ? 'هذا العقد لم يعد متاحًا للتوقيع' : 'This contract is no longer open for signing'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label className="label">{isAr ? 'الاسم الكامل' : 'Full name'}</label>
                  <input className="input" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label className="label">{isAr ? 'البريد الإلكتروني (اختياري)' : 'Email (optional)'}</label>
                  <input className="input" type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-sm)', color: 'var(--fg-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
                {isAr ? 'أقر بأنني قرأت بنود العقد وأوافق عليها' : 'I have read and agree to the contract terms'}
              </label>
              <button className="btn btn-primary" onClick={sign} disabled={busy} style={{ alignSelf: 'flex-start' }}>
                ✍ {isAr ? 'توقيع العقد' : 'Sign contract'}
              </button>
            </div>
          )}
          {msg && <p style={{ marginTop: 8, fontSize: 'var(--fs-xs)', color: 'var(--danger-500)', textAlign: 'center' }}>{msg}</p>}
        </div>
      </div>

      <style>{`@media print { .q-actions { display: none !important; } #contract-print { border: none !important; box-shadow: none !important; } body { background: #fff !important; } }`}</style>
    </div>
  )
}
