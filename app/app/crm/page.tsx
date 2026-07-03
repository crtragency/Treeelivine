'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const STATUSES = ['lead', 'prospect', 'active', 'inactive', 'churned']
const PRIORITIES = ['low', 'medium', 'high']

export default function CRMPage() {
  const { t, hasPermission } = useApp()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function fetchCustomers() {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    const res = await fetch(`/api/customers?${params}`)
    const data = await res.json()
    if (data.success) setCustomers(data.data)
    setLoading(false)
  }

  useEffect(() => { fetchCustomers() }, [search, filterStatus])

  function openCreate() { setForm({}); setEditing(null); setError(''); setModalOpen(true) }
  function openEdit(c: any) { setForm({ ...c }); setEditing(c); setError(''); setModalOpen(true) }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const url = editing ? `/api/customers/${editing._id}` : '/api/customers'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!data.success) { setError(data.message || 'Error'); setSaving(false); return }
      setModalOpen(false)
      fetchCustomers()
    } catch { setError('Error') }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/customers/${deleteTarget._id}`, { method: 'DELETE' })
    setDeleteTarget(null)
    setDeleting(false)
    fetchCustomers()
  }

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.01em', flex: 1 }}>{t.crm || 'CRM'}</h2>
        <input className="input" placeholder={t.search || 'Search...'} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
        <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 140 }}>
          <option value="">{t.allStatuses || 'All Statuses'}</option>
          {STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
        </select>
        {hasPermission('crm.write') && (
          <button className="btn btn-primary" onClick={openCreate}>+ {t.addCustomer || 'Add Customer'}</button>
        )}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="t-table">
            <thead>
              <tr>
                {['Name', 'Company', 'Email', 'Phone', 'Status', 'Priority', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c._id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{c.company || '-'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{c.email || '-'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{c.phone || '-'}</td>
                  <td><StatusBadge status={c.status || 'lead'} /></td>
                  <td><StatusBadge status={c.priority || 'medium'} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {hasPermission('crm.write') && <button className="btn btn-secondary" onClick={() => openEdit(c)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>Edit</button>}
                      {hasPermission('crm.write') && <button className="btn btn-danger" onClick={() => setDeleteTarget(c)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No customers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Customer' : 'Add Customer'}>
        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><label className="label">Name *</label><input className="input" value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
          <div><label className="label">Company</label><input className="input" value={form.company || ''} onChange={e => setForm((p: any) => ({ ...p, company: e.target.value }))} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={form.email || ''} onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={e => setForm((p: any) => ({ ...p, phone: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status || 'lead'} onChange={e => setForm((p: any) => ({ ...p, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priority</label>
              <select className="input" value={form.priority || 'medium'} onChange={e => setForm((p: any) => ({ ...p, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{t[`status.${p}`] || p}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Notes</label><textarea className="input" value={form.notes || ''} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))} rows={3} /></div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : 'Save'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        loading={deleting}
      />
    </div>
  )
}
