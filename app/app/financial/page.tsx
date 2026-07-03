'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const EXPENSE_CATEGORIES = ['salary', 'rent', 'software', 'marketing', 'equipment', 'utilities', 'travel', 'other']

const IC = ({ d, size = 18 }: { d: string | string[]; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
  </svg>
)

function OverviewCard({ label, value, icon, color, sub }: { label: string; value: string; icon: React.ReactNode; color: string; sub?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '18', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ fontSize: '0.72rem', color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: '0.3rem' }}>{label}</p>
        <p style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--fg-1)' }}>{value}</p>
        {sub && <p style={{ fontSize: '0.72rem', color: 'var(--fg-4)', marginTop: 2 }}>{sub}</p>}
      </div>
    </div>
  )
}

export default function FinancialPage() {
  const { t, hasPermission, settings } = useApp()
  const cur = settings?.defaultCurrency || 'SAR'

  const [invoices,  setInvoices]  = useState<any[]>([])
  const [expenses,  setExpenses]  = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting,  setDeleting]  = useState(false)
  const [form,      setForm]      = useState<any>({})
  const [saving,    setSaving]    = useState(false)

  async function fetchAll() {
    setLoading(true)
    const [invRes, expRes, emRes] = await Promise.all([
      fetch('/api/invoices').then(r => r.json()),
      fetch('/api/expenses').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
    ])
    if (invRes.success) setInvoices(invRes.data)
    if (expRes.success) setExpenses(expRes.data)
    if (emRes.success)  setEmployees(emRes.data)
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [])

  function openCreate() { setForm({ category: 'other', date: new Date().toISOString().substring(0, 10) }); setEditing(null); setModalOpen(true) }
  function openEdit(e: any)  { setForm({ ...e, employeeId: e.employeeId?._id || e.employeeId }); setEditing(e); setModalOpen(true) }

  async function handleSave() {
    setSaving(true)
    const url    = editing ? `/api/expenses/${editing._id}` : '/api/expenses'
    const method = editing ? 'PUT' : 'POST'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data   = await res.json()
    if (data.success) { setModalOpen(false); fetchAll() }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/expenses/${deleteTarget._id}`, { method: 'DELETE' })
    setDeleteTarget(null); setDeleting(false); fetchAll()
  }

  const totalRevenue  = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount ?? i.amountBase ?? 0), 0)
  const totalPending  = invoices.filter(i => ['unpaid', 'partial'].includes(i.status)).reduce((s, i) => s + (i.amount ?? i.amountBase ?? 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const netProfit     = totalRevenue - totalExpenses

  const catTotals = EXPENSE_CATEGORIES.map(cat => ({
    cat,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  const filtered = filterCat ? expenses.filter(e => e.category === filterCat) : expenses

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1>{t.financialTitle}</h1>
          <p className="sub">{t.financialSubtitle}</p>
        </div>
        {hasPermission('finance.write') && (
          <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <IC d="M12 5v14M5 12h14" /> {t.logExpense}
          </button>
        )}
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* Overview cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
            <OverviewCard label={t.totalRevenue}   value={`${cur} ${totalRevenue.toLocaleString()}`}  icon={<IC d="M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6" />}    color="#4f6831" sub={t.collectedInvoices} />
            <OverviewCard label={t.pendingRevenue} value={`${cur} ${totalPending.toLocaleString()}`}  icon={<IC d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />} color="#d97706" sub={t.unpaidInvoices} />
            <OverviewCard label={t.totalExpenses}  value={`${cur} ${totalExpenses.toLocaleString()}`} icon={<IC d="M2 16.1A5 5 0 015.9 20M2 12.05A9 9 0 019.95 20M2 8V6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2h-6" />} color="#ef4444" />
            <OverviewCard label={t.netProfit}      value={`${cur} ${netProfit.toLocaleString()}`}     icon={<IC d="M22 7l-8.5 8.5-5-5L2 17M16 7h6v6" />}      color={netProfit >= 0 ? '#059669' : '#dc2626'} sub={totalRevenue > 0 ? `${((netProfit / totalRevenue) * 100).toFixed(1)}% ${t.marginPct}` : undefined} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.25rem', marginBottom: '1.5rem' }}>
            {/* Expense breakdown */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--fg-1)', marginBottom: '1rem' }}>{t.expensesByCategory}</h3>
              {catTotals.length === 0 ? (
                <p style={{ color: 'var(--fg-4)', fontSize: '0.875rem' }}>{t.noExpensesYet}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {catTotals.map(({ cat, total }) => {
                    const pct = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--fg-2)', }}>{t[`status.${cat}`] || cat}</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--fg-3)', fontWeight: 600 }}>{cur} {total.toLocaleString()} <span style={{ fontSize: '0.72rem', color: 'var(--fg-4)' }}>({pct.toFixed(0)}%)</span></span>
                        </div>
                        <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 3 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {[
                { label: t.totalInvoices,       value: String(invoices.length),                                            color: 'var(--fg-1)' },
                { label: t.paidInvoices,        value: String(invoices.filter(i => i.status === 'paid').length),           color: '#059669' },
                { label: t.overdue,             value: String(invoices.filter(i => i.status === 'overdue').length),        color: '#dc2626' },
                { label: t.totalExpenseItems,   value: String(expenses.length),                                            color: 'var(--fg-1)' },
                { label: t.salaryExpenses,      value: `${cur} ${expenses.filter(e=>e.category==='salary').reduce((s,e)=>s+(e.amount||0),0).toLocaleString()}`, color: '#7c3aed' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--fg-3)' }}>{s.label}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Expenses table */}
          <div className="card-surface table-scroll" style={{ overflow: "hidden auto" }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--fg-1)' }}>{t.expenseLog}</h3>
              <select className="input" value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: 160, fontSize: '0.8rem' }}>
                <option value="">{t.allCategories}</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{t[`status.${c}`] || c}</option>)}
              </select>
            </div>
            <table className="t-table">
              <thead>
                <tr>
                  {[t.description, t.category, t.amount, t.date, t.actions].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(exp => (
                  <tr key={exp._id}>
                    <td style={{ fontSize: '0.875rem', color: 'var(--fg-2)' }}>{exp.description || '—'}</td>
                    <td><StatusBadge status={exp.category} /></td>
                    <td style={{ fontWeight: 600, color: 'var(--fg-1)' }}>{cur} {(exp.amount || 0).toLocaleString()}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--fg-4)' }}>{exp.date ? new Date(exp.date).toLocaleDateString() : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {hasPermission('finance.write') && <button className="btn btn-secondary" onClick={() => openEdit(exp)} style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>{t.edit}</button>}
                        {hasPermission('finance.write') && <button className="btn btn-danger" onClick={() => setDeleteTarget(exp)} style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>{t.delete}</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--fg-4)' }}>
                    <p style={{ fontWeight: 500 }}>{t.noExpenses}</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t.editExpense : t.logExpense} width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><label className="label">{t.description}</label><input className="input" value={form.description || ''} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div><label className="label">{t.amount} *</label><input className="input" type="number" value={form.amount || ''} onChange={e => setForm((p: any) => ({ ...p, amount: Number(e.target.value) }))} /></div>
            <div><label className="label">{t.date}</label><input className="input" type="date" value={form.date ? form.date.substring(0, 10) : ''} onChange={e => setForm((p: any) => ({ ...p, date: e.target.value }))} /></div>
          </div>
          <div>
            <label className="label">{t.category} *</label>
            <select className="input" value={form.category || 'other'} onChange={e => setForm((p: any) => ({ ...p, category: e.target.value }))}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{t[`status.${c}`] || c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t.employeeForSalary}</label>
            <select className="input" value={form.employeeId || ''} onChange={e => setForm((p: any) => ({ ...p, employeeId: e.target.value }))}>
              <option value="">{t.none}</option>
              {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t.saving : editing ? t.saveChanges : t.logExpense}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={t.deleteExpense} message={t.deleteExpenseMsg} loading={deleting} />
    </div>
  )
}
