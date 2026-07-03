'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired']

const IC = ({ d, size = 16 }: { d: string | string[]; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
  </svg>
)

export default function QuotationsPage() {
  const { t, hasPermission, settings } = useApp()
  const cur = settings?.defaultCurrency || 'SAR'

  const [quotes,     setQuotes]     = useState<any[]>([])
  const [customers,  setCustomers]  = useState<any[]>([])
  const [projects,   setProjects]   = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editing,    setEditing]    = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting,   setDeleting]   = useState(false)
  const [form,       setForm]       = useState<any>({})
  const [items,      setItems]      = useState<any[]>([])
  const [saving,     setSaving]     = useState(false)

  async function fetchAll() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    const [qRes, cuRes, prRes] = await Promise.all([
      fetch(`/api/quotations?${params}`).then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ])
    if (qRes.success)  setQuotes(qRes.data)
    if (cuRes.success) setCustomers(cuRes.data)
    if (prRes.success) setProjects(prRes.data)
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [filterStatus])

  function openCreate() {
    setForm({ status: 'draft', currency: cur, taxRate: settings?.defaultTaxRate || 15 })
    setItems([{ description: '', qty: 1, price: 0 }])
    setEditing(null); setModalOpen(true)
  }
  function openEdit(q: any) {
    setForm({ ...q, customerId: q.customer?._id || q.customerId, projectId: q.project?._id || q.projectId, taxRate: q.taxRate })
    setItems(q.items?.length ? q.items : [{ description: '', qty: 1, price: 0 }])
    setEditing(q); setModalOpen(true)
  }

  function calcTotals() {
    const subtotal  = items.reduce((s, i) => s + Number(i.qty || 1) * Number(i.price || 0), 0)
    const taxAmount = subtotal * (Number(form.taxRate || 0) / 100)
    return { subtotal, taxAmount, total: subtotal + taxAmount }
  }

  async function handleSave() {
    setSaving(true)
    const { subtotal, taxAmount, total } = calcTotals()
    const body = { ...form, items, subtotal, taxAmount, total }
    const url    = editing ? `/api/quotations/${editing._id}` : '/api/quotations'
    const method = editing ? 'PUT' : 'POST'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data   = await res.json()
    if (data.success) { setModalOpen(false); fetchAll() }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/quotations/${deleteTarget._id}`, { method: 'DELETE' })
    setDeleteTarget(null); setDeleting(false); fetchAll()
  }

  function addItem()    { setItems(p => [...p, { description: '', qty: 1, price: 0 }]) }
  function removeItem(i: number) { setItems(p => p.filter((_, idx) => idx !== i)) }
  function updateItem(i: number, field: string, val: any) {
    setItems(p => p.map((item, idx) => idx === i ? { ...item, [field]: val } : item))
  }

  const { subtotal: modalSub, taxAmount: modalTax, total: modalTotal } = calcTotals()

  const counts = {
    draft:    quotes.filter(q => q.status === 'draft').length,
    sent:     quotes.filter(q => q.status === 'sent').length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    totalVal: quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + (q.total || 0), 0),
  }

  const statusColor: Record<string, string> = {
    draft: '#6b7280', sent: '#2563eb', accepted: '#059669', rejected: '#dc2626', expired: '#d97706'
  }

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1>{t['quotations.title'] || 'Quotations'}</h1>
          <p className="sub">{t['quotations.subtitle'] || 'Create and track client quotations'}</p>
        </div>
        {hasPermission('finance.write') && (
          <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <IC d="M12 5v14M5 12h14" /> {t.newQuotation || 'New Quotation'}
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {[
          { label: t.totalQuotes,    value: String(quotes.length),                       color: 'var(--fg-1)' },
          { label: t.draft,          value: String(counts.draft),                         color: '#6b7280' },
          { label: t.sent,           value: String(counts.sent),                          color: '#2563eb' },
          { label: t.accepted,       value: String(counts.accepted),                      color: '#059669' },
          { label: t.acceptedValue,  value: `${cur} ${counts.totalVal.toLocaleString()}`, color: '#059669' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem 1.25rem' }}>
            <p style={{ fontSize: '0.72rem', color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: '0.3rem' }}>{s.label}</p>
            <p style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="seg">
        {['', ...QUOTE_STATUSES].map(s => (
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
                {[t.quoteNumber, t.client, t.amount, t.taxCol, t.total, t.status, t.validUntil, t.actions].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotes.map(q => (
                <tr key={q._id}>
                  <td style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.875rem' }}>{q.quoteNumber}</td>
                  <td>
                    <p style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--fg-1)' }}>{q.customer?.name || '—'}</p>
                    {q.project && <p style={{ fontSize: '0.72rem', color: 'var(--fg-4)' }}>{q.project?.name}</p>}
                  </td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--fg-3)' }}>{q.currency} {(q.subtotal || 0).toLocaleString()}</td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--fg-4)' }}>{(q.taxRate || 0)}%</td>
                  <td style={{ fontWeight: 700, color: 'var(--fg-1)' }}>{q.currency} {(q.total || 0).toLocaleString()}</td>
                  <td>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: statusColor[q.status] || 'var(--fg-4)', background: (statusColor[q.status] || '#6b7280') + '15', padding: '0.2rem 0.65rem', borderRadius: 20 }}>
                      {t[`status.${q.status || 'draft'}`] || q.status || 'draft'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--fg-4)' }}>{q.validUntil ? new Date(q.validUntil).toLocaleDateString() : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {hasPermission('finance.write') && <button className="btn btn-secondary" onClick={() => openEdit(q)} style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>{t.edit || 'Edit'}</button>}
                      {hasPermission('finance.write') && <button className="btn btn-danger" onClick={() => setDeleteTarget(q)} style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>{t.delete || 'Delete'}</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {quotes.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--fg-4)' }}>
                  <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{t.noQuotations || 'No quotations yet'}</p>
                  <p style={{ fontSize: '0.8rem' }}>{t.createFirst || 'Create a quotation to send to a client'}</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? (t.editQuotation || 'Edit Quotation') : (t.newQuotation || 'New Quotation')} width={640}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="label">{t.client || 'Client'} *</label>
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
              <select className="input" value={form.status || 'draft'} onChange={e => setForm((p: any) => ({ ...p, status: e.target.value }))}>
                {QUOTE_STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
              </select>
            </div>
            <div><label className="label">{t.taxRate || 'Tax Rate %'}</label><input className="input" type="number" value={form.taxRate ?? 15} onChange={e => setForm((p: any) => ({ ...p, taxRate: Number(e.target.value) }))} /></div>
            <div><label className="label">{t.validUntil || 'Valid Until'}</label><input className="input" type="date" value={form.validUntil ? form.validUntil.substring(0, 10) : ''} onChange={e => setForm((p: any) => ({ ...p, validUntil: e.target.value }))} /></div>
          </div>

          <div>
            <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>{t.lineItems || 'Line Items'}</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {items.map((item, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 100px 28px', gap: '0.4rem', alignItems: 'center' }}>
                  <input className="input" placeholder={t.description || 'Description'} value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} style={{ fontSize: '0.82rem' }} />
                  <input className="input" type="number" placeholder={t.qty || 'Qty'} value={item.qty} onChange={e => updateItem(i, 'qty', Number(e.target.value))} style={{ fontSize: '0.82rem' }} />
                  <input className="input" type="number" placeholder={t.unitPrice || 'Unit Price'} value={item.price} onChange={e => updateItem(i, 'price', Number(e.target.value))} style={{ fontSize: '0.82rem' }} />
                  <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '1.1rem', padding: 0, lineHeight: 1 }}>×</button>
                </div>
              ))}
              <button className="btn btn-secondary" onClick={addItem} style={{ fontSize: '0.78rem', alignSelf: 'flex-start' }}>{t.addLine || '+ Add Line'}</button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.5rem', fontSize: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            <span>{t.subtotalLabel || 'Subtotal:'} <strong>{cur} {modalSub.toLocaleString()}</strong></span>
            <span>{t.taxLabel || 'Tax'} ({form.taxRate || 0}%): <strong>{cur} {modalTax.toLocaleString()}</strong></span>
            <span style={{ fontWeight: 700 }}>{t.totalLabel || 'Total:'} {cur} {modalTotal.toLocaleString()}</span>
          </div>

          <div><label className="label">{t.notes || 'Notes'}</label><textarea className="input" value={form.notes || ''} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))} rows={2} /></div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t.cancel || 'Cancel'}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? (t.saving || 'Saving…') : editing ? (t.saveChanges || 'Save Changes') : (t.createQuotation || 'Create Quotation')}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={t.deleteQuotation || 'Delete Quotation'} message={`${t.deleteQuotation || 'Delete quotation'} "${deleteTarget?.quoteNumber}"?`} loading={deleting} />
    </div>
  )
}
