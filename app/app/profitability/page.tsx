'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const MONTH_AR = ['ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس']
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/* Grouped monthly bars — revenue vs total cost, same visual system as the dashboard chart */
function TrendChart({ monthly, lang, labels }: { monthly: any[]; lang: string; labels: { revenue: string; cost: string } }) {
  const [hover, setHover] = useState<number | null>(null)
  const names = lang === 'ar' ? MONTH_AR : MONTH_EN
  const max = Math.max(1, ...monthly.flatMap((m: any) => [m.revenue, m.cost]))
  const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, height: 150, direction: 'ltr' }}>
        {monthly.map((m: any, i: number) => {
          const [y, mo] = m.key.split('-').map(Number)
          const isHover = hover === i
          return (
            <div key={m.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, cursor: 'default', borderRadius: 6, padding: '4px 2px 0', background: isHover ? 'var(--bg-hover)' : 'transparent' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2 }}>
                <div style={{ width: '38%', maxWidth: 14, height: `${(m.revenue / max) * 100}%`, minHeight: m.revenue > 0 ? 4 : 1, background: 'var(--chart-1)', borderRadius: '4px 4px 0 0' }} />
                <div style={{ width: '38%', maxWidth: 14, height: `${(m.cost / max) * 100}%`, minHeight: m.cost > 0 ? 4 : 1, background: 'var(--chart-2)', borderRadius: '4px 4px 0 0' }} />
              </div>
              <span style={{ fontSize: 10, textAlign: 'center', fontFamily: lang === 'ar' ? 'var(--font-sans)' : 'var(--font-mono)', color: isHover ? 'var(--fg-2)' : 'var(--fg-5)', whiteSpace: 'nowrap' }}>
                {names[mo - 1]}{mo === 1 ? ` ${String(y).slice(2)}` : ''}
              </span>
            </div>
          )
        })}
      </div>
      {hover !== null && (
        <div style={{ position: 'absolute', top: -8, insetInlineStart: '50%', transform: 'translate(-50%, -100%)', background: 'var(--bg-surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', padding: '8px 12px', pointerEvents: 'none', zIndex: 5, fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap' }}>
          <div style={{ fontWeight: 600, color: 'var(--fg-1)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>{monthly[hover].key}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-2)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--chart-1)' }} />
            {labels.revenue}: <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)' }}>{fmt(monthly[hover].revenue)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-2)', marginTop: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--chart-2)' }} />
            {labels.cost}: <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)' }}>{fmt(monthly[hover].cost)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProfitabilityPage() {
  const { t, lang, settings } = useApp()
  const isAr = lang === 'ar'
  const cur = settings?.currency || 'SAR'
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  async function fetchData() {
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const res = await fetch(`/api/profitability?${params}`).then(r => r.json())
    if (res.success) setData(res.data)
    setLoading(false)
  }
  useEffect(() => { fetchData() }, [from, to])

  const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('en-US')
  const marginColor = (m: number | null) =>
    m === null ? 'var(--fg-4)' : m < 0 ? 'var(--danger-600, #dc2626)' : m < 20 ? 'var(--warning-600, #d97706)' : 'var(--success-600, #059669)'

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1>{t['profit.title']}</h1>
          <p className="sub">{t['profit.subtitle']}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 150 }} />
          <span style={{ color: 'var(--fg-4)' }}>←</span>
          <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 150 }} />
        </div>
      </div>

      {loading || !data ? <LoadingSpinner /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
            <div className="kpi"><div className="kpi-label">{t.revenue}</div><div className="kpi-value ltr-num">{cur} {fmt(data.revenue)}</div></div>
            <div className="kpi"><div className="kpi-label">{t['profit.directCosts']}</div><div className="kpi-value ltr-num">{cur} {fmt(data.expenses)}</div></div>
            <div className="kpi"><div className="kpi-label">{t['profit.laborCost']}</div><div className="kpi-value ltr-num">{cur} {fmt(data.labor)}</div><span style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-4)' }} className="ltr-num">{fmt(data.hours)} {isAr ? 'ساعة' : 'h'}</span></div>
            <div className="kpi"><div className="kpi-label">{t['profit.netTotal']}</div><div className="kpi-value ltr-num" style={{ color: data.profit < 0 ? 'var(--danger-600, #dc2626)' : undefined }}>{cur} {fmt(data.profit)}</div></div>
            <div className="kpi"><div className="kpi-label">{t['profit.margin']}</div><div className="kpi-value ltr-num" style={{ color: marginColor(data.margin) }}>{data.margin === null ? '—' : `${data.margin}%`}</div></div>
          </div>

          <div className="card-surface" style={{ padding: '1.15rem 1.25rem', marginBottom: '1.5rem' }}>
            <div className="card-head" style={{ padding: 0, marginBottom: '1rem', border: 'none' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>{t['profit.trend']}</h3>
              <div style={{ display: 'flex', gap: 14, fontSize: 'var(--fs-xs)', color: 'var(--fg-3)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--chart-1)' }} /> {t.revenue}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--chart-2)' }} /> {t['profit.totalCost']}</span>
                {data.forecastNet !== null && (
                  <span>{t['profit.forecast']}: <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)' }}>{cur} {fmt(data.forecastNet)}</span></span>
                )}
              </div>
            </div>
            <TrendChart monthly={data.monthly} lang={lang} labels={{ revenue: t.revenue, cost: t['profit.totalCost'] }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: '1rem' }}>
            <div className="card-surface" style={{ overflow: 'hidden' }}>
              <div className="card-head"><h3>{t['profit.byProject']}</h3></div>
              <div className="table-scroll" style={{ overflowX: 'auto' }}>
                <table className="t-table">
                  <thead><tr>{[t['profit.project'], t.revenue, t['profit.totalCost'], t['profit.profitCol'], '%'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {data.projects.map((p: any) => (
                      <tr key={p.id}>
                        <td style={{ maxWidth: 180 }}>
                          <p style={{ fontWeight: 500, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                          {p.customer && <p style={{ fontSize: '0.7rem', color: 'var(--fg-4)' }}>{p.customer}</p>}
                        </td>
                        <td className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{fmt(p.revenue)}</td>
                        <td className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{fmt(p.cost)}</td>
                        <td className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 600, color: p.profit < 0 ? 'var(--danger-600, #dc2626)' : undefined }}>{fmt(p.profit)}</td>
                        <td className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: marginColor(p.margin) }}>{p.margin === null ? '—' : `${p.margin}%`}</td>
                      </tr>
                    ))}
                    {data.projects.length === 0 && <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--fg-4)' }}>{t['profit.emptyTable']}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card-surface" style={{ overflow: 'hidden' }}>
              <div className="card-head"><h3>{t['profit.byClient']}</h3></div>
              <div className="table-scroll" style={{ overflowX: 'auto' }}>
                <table className="t-table">
                  <thead><tr>{[t['profit.client'], t.revenue, t['profit.totalCost'], t['profit.profitCol'], '%'].map(h => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>
                    {data.clients.map((c: any) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500, fontSize: '0.85rem' }}>{c.name}</td>
                        <td className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{fmt(c.revenue)}</td>
                        <td className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>{fmt(c.cost)}</td>
                        <td className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 600, color: c.profit < 0 ? 'var(--danger-600, #dc2626)' : undefined }}>{fmt(c.profit)}</td>
                        <td className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: marginColor(c.margin) }}>{c.margin === null ? '—' : `${c.margin}%`}</td>
                      </tr>
                    ))}
                    {data.clients.length === 0 && <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--fg-4)' }}>{t['profit.emptyTable']}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
