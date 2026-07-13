'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import StatusBadge from '@/components/ui/StatusBadge'
import Link from 'next/link'

const IC = ({ d, size = 15 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const Icons = {
  Plus: () => <IC d="M12 5v14M5 12h14" size={14} />,
  Folder: () => <IC d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" size={14} />,
  Invoice: () => <IC d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8" size={14} />,
  User: () => <IC d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6" size={14} />,
  Receipt: () => <IC d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1zM16 8H8M16 12H8" size={14} />,
}

const DATE_RANGES = [
  { key: 'today', label: { ar: 'اليوم', en: 'Today' } },
  { key: '7d', label: { ar: '7 أيام', en: '7D' } },
  { key: '30d', label: { ar: '30 يوم', en: '30D' } },
  { key: 'month', label: { ar: 'الشهر', en: 'Month' } },
  { key: 'quarter', label: { ar: 'الربع', en: 'Quarter' } },
]

const MONTH_AR = ['ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس']
const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function Kpi({ label, value, unit, sub, subTone }: { label: string; value: string; unit?: string; sub?: string; subTone?: 'up' | 'down' }) {
  return (
    <div className="kpi" style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span className="kpi-label" style={{ marginBottom: 0 }}>{label}</span>
      <span className="kpi-value">
        <span className="ltr-num">{value}</span>
        {unit && <span className="unit" style={{ marginInlineStart: 6 }}>{unit}</span>}
      </span>
      {sub && (
        <span className={subTone ? `kpi-delta ${subTone === 'down' ? 'kpi-delta-down' : 'kpi-delta-up'}` : undefined}
          style={!subTone ? { fontSize: 'var(--fs-xs)', color: 'var(--fg-4)' } : { marginTop: 0 }}>
          {sub}
        </span>
      )}
    </div>
  )
}

/* Grouped monthly bars — revenue vs expenses, real data, hover tooltip */
function RevenueChart({ monthly, cur, lang, t }: { monthly: any[]; cur: string; lang: string; t: any }) {
  const [hover, setHover] = useState<number | null>(null)
  const names = lang === 'ar' ? MONTH_AR : MONTH_EN
  const max = Math.max(1, ...monthly.flatMap((m: any) => [m.revenue, m.expenses]))
  const fmt = (n: number) => n.toLocaleString('en-US')

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, height: 150, direction: 'ltr' }}>
        {monthly.map((m: any, i: number) => {
          const [y, mo] = m.key.split('-').map(Number)
          const label = names[mo - 1]
          const isHover = hover === i
          return (
            <div
              key={m.key}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
                cursor: 'default', borderRadius: 6, padding: '4px 2px 0',
                background: isHover ? 'var(--bg-hover)' : 'transparent',
              }}
            >
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2 }}>
                <div style={{
                  width: '38%', maxWidth: 14,
                  height: `${(m.revenue / max) * 100}%`, minHeight: m.revenue > 0 ? 4 : 1,
                  background: 'var(--chart-1)',
                  borderRadius: '4px 4px 0 0',
                }} />
                <div style={{
                  width: '38%', maxWidth: 14,
                  height: `${(m.expenses / max) * 100}%`, minHeight: m.expenses > 0 ? 4 : 1,
                  background: 'var(--chart-2)',
                  borderRadius: '4px 4px 0 0',
                }} />
              </div>
              <span style={{
                fontSize: 10, textAlign: 'center',
                fontFamily: lang === 'ar' ? 'var(--font-sans)' : 'var(--font-mono)',
                color: isHover ? 'var(--fg-2)' : 'var(--fg-5)', whiteSpace: 'nowrap',
              }}>{label}{mo === 1 ? ` ${String(y).slice(2)}` : ''}</span>
            </div>
          )
        })}
      </div>

      {hover !== null && (
        <div style={{
          position: 'absolute', top: -8, insetInlineStart: '50%', transform: 'translate(-50%, -100%)',
          background: 'var(--bg-surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-md)', padding: '8px 12px', pointerEvents: 'none', zIndex: 5,
          fontSize: 'var(--fs-xs)', whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 600, color: 'var(--fg-1)', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>{monthly[hover].key}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-2)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--chart-1)' }} />
            {t.revenue}: <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)' }}>{cur} {fmt(monthly[hover].revenue)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-2)', marginTop: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--chart-2)' }} />
            {t.expenses}: <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)' }}>{cur} {fmt(monthly[hover].expenses)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

const PIPELINE_STAGES = [
  { key: 'lead', ar: 'محتمل', en: 'Lead', bg: 'var(--pipeline-prospect)' },
  { key: 'prospect', ar: 'مؤهل', en: 'Prospect', bg: 'var(--pipeline-qualified)' },
  { key: 'negotiation', ar: 'تفاوض', en: 'Negotiation', bg: 'var(--pipeline-negotiation)' },
  { key: 'active', ar: 'نشط', en: 'Active', bg: 'var(--pipeline-active)' },
  { key: 'inactive', ar: 'غير نشط', en: 'Inactive', bg: 'var(--pipeline-inactive)' },
  { key: 'churned', ar: 'مفقود', en: 'Lost', bg: 'var(--pipeline-lost)' },
]

export default function DashboardPage() {
  const { t, settings, user, lang, hasPermission } = useApp()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('30d')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/dashboard?range=${range}`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data) })
      .finally(() => setLoading(false))
  }, [range])

  const cur = settings?.defaultCurrency || 'SAR'
  const isAr = lang === 'ar'
  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || ''
  const hr = new Date().getHours()
  const greeting = hr < 12 ? t.greetingMorning : hr < 17 ? t.greetingAfternoon : t.greetingEvening
  const locale = isAr ? 'ar-u-ca-gregory' : 'en-US'
  const todayStr = new Date().toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const fmt = (n: number) => (n || 0).toLocaleString('en-US')

  const actLabel = (type: string) =>
    type === 'invoice' ? t.invoiceActivity : type === 'task' ? t.taskActivity : t.customerActivity

  const quickActionsCard = (hasPermission('finance.write') || hasPermission('crm.write') || hasPermission('projects.write')) ? (
    <div className="card-surface">
      <div className="card-head"><h3>{t.quickActions}</h3></div>
      <div style={{ padding: 'var(--space-3) var(--space-4) var(--space-4)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {hasPermission('finance.write') && <Link href="/app/invoices" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}><Icons.Invoice /> {t.newInvoice}</Link>}
        {hasPermission('crm.write') && <Link href="/app/clients" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}><Icons.User /> {t.addCustomer}</Link>}
        {hasPermission('projects.write') && <Link href="/app/projects" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}><Icons.Folder /> {t.newProject}</Link>}
        {hasPermission('finance.write') && <Link href="/app/financial" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}><Icons.Receipt /> {t.logExpense}</Link>}
      </div>
    </div>
  ) : null

  return (
    <div className="page-content">

      {/* ── Page head ─────────────────────────────────────── */}
      <div className="page-head">
        <div>
          <h1>{greeting}، {firstName}</h1>
          <div className="sub">{todayStr} — {t.greetingSubtitle}</div>
        </div>
        <div className="actions">
          <div className="seg">
            {DATE_RANGES.map(r => (
              <button key={r.key} className={range === r.key ? 'on' : ''} onClick={() => setRange(r.key)}>
                {isAr ? r.label.ar : r.label.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? <LoadingSpinner /> : data ? (
        <>
          {/* ── KPI row (shaped by role) ─────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {data.scope === 'personal' && data.my ? (
              <>
                <Kpi label={t.myOpenTasks} value={fmt(data.my.openTasks)} sub={`${fmt(data.my.overdueTasks)} ${t.overdueTasks}`} subTone={data.my.overdueTasks > 0 ? 'down' : 'up'} />
                <Kpi label={t.myProjects} value={fmt(data.my.activeProjects)} />
                <Kpi label={t.myWeekHours} value={`${Math.floor(data.my.weekSeconds / 3600)}:${String(Math.floor((data.my.weekSeconds % 3600) / 60)).padStart(2, '0')}`} />
                <Kpi label={t.overdueTasks} value={fmt(data.overdueTasks)} sub={`${fmt(data.openTasks)} ${t.openTasks}`} subTone={data.overdueTasks > 0 ? 'down' : 'up'} />
              </>
            ) : (
              <>
                <Kpi label={t.activeCustomers} value={fmt(data.activeCustomers)} sub={`${fmt(data.totalCustomers)} ${t.customers}`} />
                {data.collected !== null && (
                  <Kpi label={t.collected} value={fmt(data.collected)} unit={cur} sub={`${t.net}: ${cur} ${fmt(data.net)}`} subTone={data.net >= 0 ? 'up' : 'down'} />
                )}
                {data.unpaidAmt !== null && (
                  <Kpi label={t.unpaidInvoices} value={fmt(data.unpaidAmt)} unit={cur} sub={`${fmt(data.unpaidInvoices)} ${t.invoiceActivity}`} subTone={data.unpaidInvoices > 0 ? 'down' : 'up'} />
                )}
                <Kpi label={t.overdueTasks} value={fmt(data.overdueTasks)} sub={`${fmt(data.openTasks)} ${t.openTasks}`} subTone={data.overdueTasks > 0 ? 'down' : 'up'} />
              </>
            )}
          </div>

          {/* ── My tasks (team members) ─────────────────────── */}
          {data.scope === 'personal' && data.my?.tasks?.length > 0 && (
            <div className="card-surface">
              <div className="card-head">
                <h3>{t.myTasksTitle}</h3>
                <Link href="/app/tasks" className="btn btn-ghost btn-sm">{t.viewAll}</Link>
              </div>
              <div className="table-scroll">
                <table className="t-table">
                  <thead>
                    <tr><th>{t.taskActivity}</th><th>{t.project}</th><th>{t.status}</th><th style={{ textAlign: 'end' }}>{t.dueDate}</th></tr>
                  </thead>
                  <tbody>
                    {data.my.tasks.map((tk: any) => (
                      <tr key={tk.id}>
                        <td className="td-name">{tk.title}</td>
                        <td>{tk.project || '—'}</td>
                        <td><StatusBadge status={tk.status} /></td>
                        <td style={{ textAlign: 'end', fontFamily: 'var(--font-mono)', fontSize: 12, color: tk.dueDate && new Date(tk.dueDate) < new Date() ? 'var(--danger-600)' : 'var(--fg-3)' }}>
                          {tk.dueDate ? new Date(tk.dueDate).toLocaleDateString(locale, { month: 'short', day: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Projects + chart (left) · activity + actions (right) ── */}
          <div className="dash-bottom-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>

            {/* LEFT: projects attention + revenue chart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

            <div className="card-surface">
              <div className="card-head">
                <h3>{t.projectsAttention}</h3>
                <Link href="/app/projects" className="btn btn-ghost btn-sm">{t.viewAll}</Link>
              </div>
              {data.projectsAttention?.length ? (
                <div className="table-scroll">
                  <table className="t-table">
                    <thead>
                      <tr>
                        <th>{t.project}</th>
                        <th>{t.customer}</th>
                        <th>{t.status}</th>
                        <th style={{ textAlign: 'end' }}>{t.overdueCol}</th>
                        <th style={{ textAlign: 'end' }}>{t.progressCol}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.projectsAttention.map((p: any) => (
                        <tr key={p.id}>
                          <td className="td-name">
                            <Link href={`/app/projects/${p.id}/brief`} style={{ color: 'inherit' }}>{p.name}</Link>
                          </td>
                          <td>{p.customer || '—'}</td>
                          <td><StatusBadge status={p.status} label={t[p.status]} /></td>
                          <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)', color: p.overdue > 0 ? 'var(--danger-600)' : 'var(--fg-4)' }}>{p.overdue}</td>
                          <td style={{ textAlign: 'end' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <span className="progress" style={{ width: 72 }}><i style={{ width: `${p.progress}%` }} /></span>
                              <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', minWidth: 30 }}>{p.progress}%</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--fg-4)', fontSize: 'var(--fs-sm)' }}>
                  {t.nothingAttention}
                </div>
              )}
            </div>

            {data.monthly ? (
            <div className="card-surface">
              <div className="card-head">
                <div>
                  <h3>{t.revenueVsExpenses}</h3>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-4)', marginTop: 2 }}>{t.monthlyOverview} — {new Date().getFullYear()}</div>
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 'var(--fs-xs)', color: 'var(--fg-3)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--chart-1)' }} /> {t.revenue}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--chart-2)' }} /> {t.expenses}
                  </span>
                </div>
              </div>
              <div style={{ padding: 'var(--space-5) var(--space-4) var(--space-4)' }}>
                <RevenueChart monthly={data.monthly || []} cur={cur} lang={lang} t={t} />
              </div>
            </div>
            ) : quickActionsCard}

            </div>{/* end LEFT */}

            {/* RIGHT: recent activity + quick actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div className="card-surface">
              <div className="card-head"><h3>{t.recentActivity}</h3></div>
              <div style={{ padding: '4px var(--space-4) var(--space-3)' }}>
                {data.activity?.length ? data.activity.map((a: any, i: number) => (
                  <div key={i} style={{
                    padding: '10px 0', display: 'flex', gap: 10, alignItems: 'flex-start',
                    borderBottom: i < data.activity.length - 1 ? '1px solid var(--border-1)' : 'none',
                  }}>
                    <span className="av av-sm" style={{ fontSize: 9 }}>{actLabel(a.type)?.slice(0, 2)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-1)', lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 500 }}>{actLabel(a.type)}</span> · {a.title}
                      </div>
                      <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <StatusBadge status={a.status} label={t[a.status]} />
                        <span style={{ fontSize: 10.5, color: 'var(--fg-5)', fontFamily: 'var(--font-mono)' }}>
                          {a.at ? new Date(a.at).toLocaleDateString(locale, { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div style={{ padding: 'var(--space-6) 0', textAlign: 'center', color: 'var(--fg-4)', fontSize: 'var(--fs-sm)' }}>{t.noActivity}</div>
                )}
              </div>
            </div>

            {data.monthly && quickActionsCard}

            </div>{/* end RIGHT */}
          </div>

          {/* ── CRM pipeline strip ──────────────────────────── */}
          {data.pipeline && (
          <div className="card-surface">
            <div className="card-head">
              <h3>{t.pipelineTitle}</h3>
              <Link href="/app/clients" className="btn btn-ghost btn-sm">{t.viewAll}</Link>
            </div>
            <div style={{ padding: 'var(--space-4)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
              {PIPELINE_STAGES.map(s => (
                <div key={s.key} style={{ borderRadius: 'var(--radius-md)', padding: '10px 12px', background: s.bg, border: '1px solid var(--border-1)' }}>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-3)', fontWeight: 500 }}>{isAr ? s.ar : s.en}</div>
                  <div className="ltr-num" style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-1)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                    {data.pipeline?.[s.key] || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </>
      ) : (
        <div style={{ padding: 'var(--space-12)', textAlign: 'center', color: 'var(--fg-4)' }}>{t.noData}</div>
      )}
    </div>
  )
}
