'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const IC = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)
const Icons = {
  Folder:   () => <IC d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
  Active:   () => <IC d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM9 12l2 2 4-4" />,
  Invoice:  () => <IC d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />,
  Money:    () => <IC d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  Mail:     () => <IC d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6" />,
  Building: () => <IC d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />,
  Phone:    () => <IC d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.13 6.13l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.02z" />,
  Coins:    () => <IC d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20" />,
  Arrow:    () => <IC d="M5 12h14M12 5l7 7-7 7" size={16} />,
}

function KpiTile({ title, value, sub, icon, bg }: { title: string; value: string | number; sub?: string; icon: React.ReactNode; bg: string }) {
  return (
    <div style={{ background: bg, borderRadius: 14, padding: '1.25rem 1.5rem', color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -8, right: -8, opacity: 0.12, transform: 'scale(2.8)' }}>{icon}</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <p style={{ fontSize: '1.9rem', fontWeight: 800, lineHeight: 1, marginBottom: sub ? '0.3rem' : 0 }}>{value}</p>
      {sub && <p style={{ fontSize: '0.78rem', opacity: 0.8, marginTop: '0.3rem' }}>{sub}</p>}
    </div>
  )
}

function FinCard({ label, value, color, cur }: { label: string; value: number; color: string; cur: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem' }}>
      <p style={{ fontSize: '0.75rem', color: 'var(--fg-4)', marginBottom: '0.35rem', fontWeight: 500 }}>{label}</p>
      <p style={{ fontSize: '1.3rem', fontWeight: 700, color }}>{cur} {value.toLocaleString()}</p>
    </div>
  )
}

export default function PortalDashboard() {
  const { t, settings } = useApp()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal')
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  if (!data) return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--fg-1)', marginBottom: '0.5rem' }}>
        {t.welcomePortal || 'Welcome to your Client Portal'}
      </h2>
      <p style={{ color: 'var(--fg-4)', fontSize: '0.875rem', maxWidth: 400, margin: '0 auto' }}>
        Your account is being set up. Please contact your account manager to get access to your projects and invoices.
      </p>
    </div>
  )

  const cur = (data.invoices || []).find((i: any) => i.currency)?.currency || settings?.defaultCurrency || 'SAR'
  const totalProjects  = data.projects?.length || 0
  const activeProjects = (data.projects || []).filter((p: any) => p.status === 'active').length
  const totalInvoices  = data.invoices?.length || 0
  const paidCount  = (data.invoices || []).filter((i: any) => i.status === 'paid').length
  const paidAmt    = (data.invoices || []).filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + (i.amount ?? i.amountBase ?? 0), 0)
  const unpaidAmt  = (data.invoices || []).filter((i: any) => i.status !== 'paid').reduce((s: number, i: any) => s + (i.amount ?? i.amountBase ?? 0), 0)
  const c = data.customer || {}

  return (
    <div>

      {/* Company Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #3d5226 0%, #4f6831 50%, #6b8a45 100%)',
        borderRadius: 16, padding: '1.75rem 2rem', marginBottom: '1.5rem', color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 800 }}>
            {(c.company || c.name || 'C').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{c.company || c.name}</h2>
            <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.2)', padding: '0.2rem 0.65rem', borderRadius: 20, fontWeight: 600, textTransform: 'capitalize' }}>
              {c.status || 'active'}
            </span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.65rem' }}>
          {c.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '0.65rem 0.875rem' }}>
              <Icons.Mail />
              <div>
                <p style={{ fontSize: '0.65rem', opacity: 0.7, marginBottom: 1 }}>Email</p>
                <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.email}</p>
              </div>
            </div>
          )}
          {c.company && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '0.65rem 0.875rem' }}>
              <Icons.Building />
              <div>
                <p style={{ fontSize: '0.65rem', opacity: 0.7, marginBottom: 1 }}>Company</p>
                <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.company}</p>
              </div>
            </div>
          )}
          {c.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '0.65rem 0.875rem' }}>
              <Icons.Phone />
              <div>
                <p style={{ fontSize: '0.65rem', opacity: 0.7, marginBottom: 1 }}>Phone</p>
                <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.phone}</p>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '0.65rem 0.875rem' }}>
            <Icons.Coins />
            <div>
              <p style={{ fontSize: '0.65rem', opacity: 0.7, marginBottom: 1 }}>Currency</p>
              <p style={{ fontSize: '0.82rem', fontWeight: 600 }}>{cur}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <KpiTile title="Total Projects"   value={totalProjects}   sub={`${activeProjects} active`} icon={<Icons.Folder />}  bg="#2563eb" />
        <KpiTile title="Active Projects"  value={activeProjects}                                    icon={<Icons.Active />}  bg="#7c3aed" />
        <KpiTile title="Total Invoices"   value={totalInvoices}   sub={`${paidCount} paid`}         icon={<Icons.Invoice />} bg="#059669" />
        <KpiTile title="Outstanding"      value={`${cur} ${unpaidAmt.toLocaleString()}`}            icon={<Icons.Money />}   bg="#d97706" />
      </div>

      {/* Financial Overview */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--fg-1)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Financial Overview
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.875rem' }}>
          <FinCard label="Total Invoiced" value={paidAmt + unpaidAmt} color="#4f6831" cur={cur} />
          <FinCard label="Total Paid"     value={paidAmt}             color="#059669" cur={cur} />
          <FinCard label="Outstanding"    value={unpaidAmt}           color="#dc2626" cur={cur} />
        </div>
      </div>

      {/* Projects + Invoices */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--fg-1)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: '#2563eb' }}><Icons.Folder /></span> Recent Projects
            </h3>
            <Link href="/portal/projects" style={{ fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
              View all <Icons.Arrow />
            </Link>
          </div>
          {(data.projects || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--fg-4)' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>No projects yet</p>
              <p style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Projects will appear here once created by your account manager</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(data.projects || []).slice(0, 5).map((p: any) => (
                <div key={p._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.75rem', background: 'var(--surface2)', borderRadius: 9 }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--fg-1)' }}>{p.name}</p>
                    {p.updatedAt && <p style={{ fontSize: '0.72rem', color: 'var(--fg-4)', marginTop: 2 }}>Updated {new Date(p.updatedAt).toLocaleDateString()}</p>}
                  </div>
                  <StatusBadge status={p.status || 'planning'} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--fg-1)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: '#059669' }}><Icons.Invoice /></span> Recent Invoices
            </h3>
            <Link href="/portal/invoices" style={{ fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
              View all <Icons.Arrow />
            </Link>
          </div>
          {(data.invoices || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--fg-4)' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>No invoices yet</p>
              <p style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>Invoices from your account manager will appear here</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(data.invoices || []).slice(0, 5).map((inv: any) => (
                <div key={inv._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.65rem 0.75rem', background: 'var(--surface2)', borderRadius: 9 }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--fg-1)' }}>{inv.invoiceNumber}</p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--fg-4)', marginTop: 2 }}>{inv.currency} {(inv.amount ?? inv.amountBase ?? 0).toLocaleString()}</p>
                  </div>
                  <StatusBadge status={inv.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
