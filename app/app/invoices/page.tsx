'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const INVOICE_STATUSES = ['draft', 'unpaid', 'partial', 'paid', 'overdue']

const IC = ({ d, size = 16 }: { d: string | string[]; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
  </svg>
)

function Stat({ label, value, color, sub }: { label: string; value: number | string; color?: string; sub?: string }) {
  return (
    <div className="kpi" style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span className="kpi-label" style={{ marginBottom: 0 }}>{label}</span>
      <span className="kpi-value ltr-num" style={color ? { color } : undefined}>{value}</span>
      {sub && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-4)' }}>{sub}</span>}
    </div>
  )
}

export default function InvoicesPage() {
  const { t, hasPermission, settings } = useApp()
  const cur = settings?.defaultCurrency || 'SAR'

  const [invoices,   setInvoices]   = useState<any[]>([])
  const [customers,  setCustomers]  = useState<any[]>([])
  const [projects,   setProjects]   = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editing,    setEditing]    = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting,   setDeleting]   = useState(false)
  const [form,       setForm]       = useState<any>({})
  const [saving,     setSaving]     = useState(false)
  const [items,      setItems]      = useState<any[]>([])

  async function fetchAll() {
    setLoading(true)
    const [invRes, cuRes, prRes] = await Promise.all([
      fetch('/api/invoices').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ])
    if (invRes.success) setInvoices(invRes.data)
    if (cuRes.success)  setCustomers(cuRes.data)
    if (prRes.success)  setProjects(prRes.data)
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [])

  function openCreate() {
    setForm({ status: 'unpaid', currency: cur, taxRate: settings?.defaultTaxRate || 15 })
    setItems([{ description: '', qty: 1, price: 0 }])
    setEditing(null); setModalOpen(true)
  }
  function openEdit(inv: any) {
    setForm({ ...inv, customerId: inv.customerId?._id || inv.customerId, projectId: inv.projectId?._id || inv.projectId })
    setItems(inv.items || [{ description: '', qty: 1, price: 0 }])
    setEditing(inv); setModalOpen(true)
  }

  function calcTotals(its: any[], taxRate: number) {
    const subtotal  = its.reduce((s, i) => s + Number(i.qty || 1) * Number(i.price || 0), 0)
    const taxAmount = subtotal * (taxRate / 100)
    return { subtotal, taxAmount, total: subtotal + taxAmount }
  }

  async function handleSave() {
    setSaving(true)
    const { subtotal, taxAmount, total } = calcTotals(items, Number(form.taxRate || 0))
    const body = { ...form, items, subtotal, taxAmount, amountBase: total, amount: total }
    const url    = editing ? `/api/invoices/${editing._id}` : '/api/invoices'
    const method = editing ? 'PUT' : 'POST'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data   = await res.json()
    if (data.success) { setModalOpen(false); fetchAll() }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/invoices/${deleteTarget._id}`, { method: 'DELETE' })
    setDeleteTarget(null); setDeleting(false); fetchAll()
  }

  function addItem()    { setItems(p => [...p, { description: '', qty: 1, price: 0 }]) }
  function removeItem(i: number) { setItems(p => p.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, field: string, val: any) {
    setItems(p => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }

  const filtered = filterStatus ? invoices.filter(i => i.status === filterStatus) : invoices
  const totalRev  = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount ?? i.amountBase ?? 0), 0)
  const totalUnpaid = invoices.filter(i => ['unpaid', 'partial', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.amount ?? i.amountBase ?? 0), 0)
  const { subtotal: modalSubtotal } = calcTotals(items, Number(form.taxRate || 0))

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1>{t['finance.invoices'] || 'Invoices'}</h1>
          <p className="sub">{t.invoicesSubtitle || 'Track and manage all client invoices'}</p>
        </div>
        {hasPermission('finance.write') && (
          <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <IC d="M12 5v14M5 12h14" /> {t.newInvoice || 'New Invoice'}
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <Stat label={t.totalInvoices || 'Total Invoices'} value={String(invoices.length)}                        color="var(--fg-1)" />
        <Stat label={t.collected || 'Collected'}      value={`${cur} ${totalRev.toLocaleString()}`}          color="#059669" sub={`${invoices.filter(i=>i.status==='paid').length} ${t.paidCount || 'paid'}`} />
        <Stat label={t.outstanding || 'Outstanding'}    value={`${cur} ${totalUnpaid.toLocaleString()}`}       color="#dc2626" sub={`${invoices.filter(i=>i.status!=='paid'&&i.status!=='draft').length} ${t.unpaidCount || 'unpaid'}`} />
        <Stat label={t.drafts || 'Drafts'}         value={String(invoices.filter(i=>i.status==='draft').length)} color="var(--fg-4)" />
      </div>

      {/* Filter tabs */}
      <div className="seg">
        {['', ...INVOICE_STATUSES].map(s => (
          <button key={s} className={filterStatus === s ? 'on' : ''} onClick={() => setFilterStatus(s)}>
            {s ? (t[`status.${s}`] || s) : (t.all || 'All')}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card-surface table-scroll" style={{ overflow: "hidden auto" }}>
          <table className="t-table">
            <thead>
              <tr>
                {[t.invoiceNumber, t.invoiceClient, t.invoiceAmount, t.invoicePaid, t.status, t.invoiceDueDate, t.invoiceActions].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv._id}>
                  <td style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--accent)' }}>{inv.invoiceNumber}</td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--fg-2)' }}>{inv.customer?.name || inv.customerId?.name || inv.customerName || '—'}</td>
                  <td style={{ fontWeight: 600, color: 'var(--fg-1)' }}>{inv.currency || cur} {(inv.amount ?? inv.amountBase ?? 0).toLocaleString()}</td>
                  <td style={{ fontSize: '0.875rem', color: '#059669', fontWeight: 500 }}>{inv.currency || cur} {(inv.paidAmount || 0).toLocaleString()}</td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--fg-4)' }}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <Link href={`/app/finance/invoices/${inv._id}/pdf`} className="btn btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>PDF</Link>
                      {hasPermission('finance.write') && (
                        <button className="btn btn-secondary" onClick={() => openEdit(inv)} style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>{t.edit || 'Edit'}</button>
                      )}
                      {hasPermission('finance.write') && (
                        <button className="btn btn-danger" onClick={() => setDeleteTarget(inv)} style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>{t.delete || 'Delete'}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--fg-4)' }}>
                  <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{t.noInvoices || 'No invoices found'}</p>
                  <p style={{ fontSize: '0.8rem' }}>{t.createFirstInvoice || 'Create your first invoice to get started'}</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? (t.editInvoice || 'Edit Invoice') : (t.newInvoice || 'New Invoice')} width={620}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="label">{t.invoiceClient || 'Client'} *</label>
              <select className="input" value={form.customerId || ''} onChange={e => setForm((p: any) => ({ ...p, customerId: e.target.value }))}>
                <option value="">{t.selectClient || 'Select client…'}</option>
                {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.project || 'Project'}</label>
              <select className="input" value={form.projectId || ''} onChange={e => setForm((p: any) => ({ ...p, projectId: e.target.value }))}>
                <option value="">{t.noneProject || 'None'}</option>
                {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="label">{t.status || 'Status'}</label>
              <select className="input" value={form.status || 'unpaid'} onChange={e => setForm((p: any) => ({ ...p, status: e.target.value }))}>
                {INVOICE_STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
              </select>
            </div>
            <div><label className="label">{t.taxRate || 'Tax Rate %'}</label><input className="input" type="number" value={form.taxRate ?? 15} onChange={e => setForm((p: any) => ({ ...p, taxRate: Number(e.target.value) }))} /></div>
            <div><label className="label">{t.invoiceDueDate || 'Due Date'}</label><input className="input" type="date" value={form.dueDate ? form.dueDate.substring(0, 10) : ''} onChange={e => setForm((p: any) => ({ ...p, dueDate: e.target.value }))} /></div>
          </div>

          {/* Line items */}
          <div>
            <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>{t.lineItems || 'Line Items'}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 90px 30px', gap: '0.4rem', alignItems: 'center' }}>
                  <input className="input" placeholder={t.description || 'Description'} value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} style={{ fontSize: '0.82rem' }} />
                  <input className="input" type="number" placeholder={t.qty || 'Qty'} value={item.qty} onChange={e => updateItem(i, 'qty', Number(e.target.value))} style={{ fontSize: '0.82rem' }} />
                  <input className="input" type="number" placeholder={t.unitPrice || 'Price'} value={item.price} onChange={e => updateItem(i, 'price', Number(e.target.value))} style={{ fontSize: '0.82rem' }} />
                  <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1rem', padding: 0 }}>×</button>
                </div>
              ))}
              <button className="btn btn-secondary" onClick={addItem} style={{ fontSize: '0.78rem', alignSelf: 'flex-start' }}>{t.addLine || '+ Add Line'}</button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.5rem', fontSize: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <span>{t.subtotalLabel || 'Subtotal:'} <strong>{cur} {modalSubtotal.toLocaleString()}</strong></span>
            <span>{t.taxLabel || 'Tax'} ({form.taxRate || 0}%): <strong>{cur} {(modalSubtotal * (Number(form.taxRate || 0) / 100)).toLocaleString()}</strong></span>
            <span style={{ fontWeight: 700 }}>{t.totalLabel || 'Total:'} {cur} {(modalSubtotal * (1 + Number(form.taxRate || 0) / 100)).toLocaleString()}</span>
          </div>

          <div><label className="label">{t.notes || 'Notes'}</label><textarea className="input" value={form.notes || ''} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t.cancel || 'Cancel'}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? (t.saving || 'Saving…') : editing ? (t.saveChanges || 'Save Changes') : (t.createInvoice || 'Create Invoice')}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={t.deleteInvoice || 'Delete Invoice'} message={`${t.deleteInvoice || 'Delete invoice'} "${deleteTarget?.invoiceNumber}"? ${t.deleteInvoiceMsg || 'This cannot be undone.'}`} loading={deleting} />
    </div>
  )
}
