'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type Tab = 'invoices' | 'expenses'

export default function FinancePage() {
  const { t, settings, hasPermission } = useApp()
  const cur = settings?.defaultCurrency || 'SAR'
  const [tab, setTab] = useState<Tab>('invoices')
  const [invoices, setInvoices] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  async function fetchAll() {
    setLoading(true)
    const [inv, exp, cu, em] = await Promise.all([
      fetch('/api/invoices').then(r => r.json()),
      fetch('/api/expenses').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
    ])
    if (inv.success) setInvoices(inv.data)
    if (exp.success) setExpenses(exp.data)
    if (cu.success) setCustomers(cu.data)
    if (em.success) setEmployees(em.data)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  function openCreate() { setForm(tab === 'invoices' ? { status: 'unpaid', currency: cur, items: [] } : { category: 'other', date: new Date().toISOString().substring(0, 10) }); setEditing(null); setModalOpen(true) }
  function openEdit(item: any) { setForm({ ...item, customerId: item.customerId?._id || item.customerId }); setEditing(item); setModalOpen(true) }

  async function handleSave() {
    setSaving(true)
    const base = tab === 'invoices' ? '/api/invoices' : '/api/expenses'
    const url = editing ? `${base}/${editing._id}` : base
    const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (data.success) { setModalOpen(false); fetchAll() }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const base = tab === 'invoices' ? '/api/invoices' : '/api/expenses'
    await fetch(`${base}/${deleteTarget._id}`, { method: 'DELETE' })
    setDeleteTarget(null); setDeleting(false); fetchAll()
  }

  const EXPENSE_CATEGORIES = ['salary', 'rent', 'software', 'marketing', 'equipment', 'other']

  return (
    <div style={{ padding: '1.5rem', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, flex: 1 }}>{t.finance || 'Finance'}</h2>
        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--surface2)', borderRadius: 8, padding: '0.25rem' }}>
          {(['invoices', 'expenses'] as Tab[]).map(tb => (
            <button key={tb} className="btn" onClick={() => setTab(tb)} style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', background: tab === tb ? 'var(--accent)' : 'transparent', color: tab === tb ? '#fff' : 'var(--text)', border: 'none' }}>
              {(t as any)[tb] || tb}
            </button>
          ))}
        </div>
        {hasPermission('finance.write') && <button className="btn btn-primary" onClick={openCreate}>+ {t.add}</button>}
      </div>

      {loading ? <LoadingSpinner /> : tab === 'invoices' ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                {[t.invoiceNumber, t.customer, t.amount, t.status, t.dueDate, t.actions].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'start', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv._id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{inv.invoiceNumber}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>{inv.customer?.name || inv.customerId?.name || '-'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{inv.currency} {(inv.amount ?? inv.amountBase ?? 0).toLocaleString()}</td>
                  <td style={{ padding: '0.75rem 1rem' }}><StatusBadge status={inv.status} /></td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '-'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <Link href={`/app/finance/invoices/${inv._id}/pdf`} className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>PDF</Link>
                      {hasPermission('finance.write') && <button className="btn btn-secondary" onClick={() => openEdit(inv)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>{t.edit}</button>}
                      {hasPermission('finance.write') && <button className="btn btn-danger" onClick={() => setDeleteTarget(inv)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>{t.delete}</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t.noInvoicesTable}</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
                {['Description', 'Category', 'Amount', 'Date', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'start', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp._id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.75rem 1rem' }}>{exp.description || '-'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}><StatusBadge status={exp.category} /></td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{cur} {(exp.amount || 0).toLocaleString()}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{exp.date ? new Date(exp.date).toLocaleDateString() : '-'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {hasPermission('finance.write') && <button className="btn btn-secondary" onClick={() => openEdit(exp)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>Edit</button>}
                      {hasPermission('finance.write') && <button className="btn btn-danger" onClick={() => setDeleteTarget(exp)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>Del</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No expenses</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? (tab === 'invoices' ? t.editInvoice : t.editExpense) : (tab === 'invoices' ? t.addInvoice : t.addExpense)} width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {tab === 'invoices' ? (
            <>
              <div><label className="label">{t.customer} *</label>
                <select className="input" value={form.customerId || ''} onChange={e => setForm((p: any) => ({ ...p, customerId: e.target.value }))}>
                  <option value="">{t.selectCustomer}</option>
                  {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div><label className="label">{t.status}</label>
                  <select className="input" value={form.status || 'unpaid'} onChange={e => setForm((p: any) => ({ ...p, status: e.target.value }))}>
                    {['draft', 'unpaid', 'paid', 'overdue'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="label">{t.dueDate}</label><input className="input" type="date" value={form.dueDate ? form.dueDate.substring(0, 10) : ''} onChange={e => setForm((p: any) => ({ ...p, dueDate: e.target.value }))} /></div>
              </div>
              <div><label className="label">{t.notes}</label><textarea className="input" value={form.notes || ''} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            </>
          ) : (
            <>
              <div><label className="label">{t.description}</label><input className="input" value={form.description || ''} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div><label className="label">{t.amount} *</label><input className="input" type="number" value={form.amount || ''} onChange={e => setForm((p: any) => ({ ...p, amount: Number(e.target.value) }))} /></div>
                <div><label className="label">{t.date}</label><input className="input" type="date" value={form.date ? form.date.substring(0, 10) : ''} onChange={e => setForm((p: any) => ({ ...p, date: e.target.value }))} /></div>
              </div>
              <div><label className="label">{t.category} *</label>
                <select className="input" value={form.category || 'other'} onChange={e => setForm((p: any) => ({ ...p, category: e.target.value }))}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="label">{t.employee}</label>
                <select className="input" value={form.employeeId || ''} onChange={e => setForm((p: any) => ({ ...p, employeeId: e.target.value }))}>
                  <option value="">{t.none}</option>
                  {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                </select>
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t.saving : t.save}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={tab === 'invoices' ? t.deleteInvoice : t.deleteExpense} message={tab === 'invoices' ? t.deleteInvoiceMsg : t.deleteExpenseMsg} loading={deleting} />
    </div>
  )
}
