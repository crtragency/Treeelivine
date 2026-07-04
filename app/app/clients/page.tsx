'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const STATUSES  = ['lead', 'prospect', 'active', 'inactive', 'churned']
const PRIORITIES = ['low', 'medium', 'high', 'urgent']

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

export default function ClientsPage() {
  const { t, hasPermission } = useApp()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting]   = useState(false)
  const [form, setForm]           = useState<any>({})
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function fetchCustomers() {
    setLoading(true)
    const params = new URLSearchParams()
    if (search)       params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    const res  = await fetch(`/api/customers?${params}`)
    const data = await res.json()
    if (data.success) setCustomers(data.data)
    setLoading(false)
  }

  useEffect(() => { fetchCustomers() }, [search, filterStatus])

  function openCreate() { setForm({ status: 'lead', priority: 'medium' }); setEditing(null); setError(''); setModalOpen(true) }
  function openEdit(c: any) { setForm({ ...c }); setEditing(c); setError(''); setModalOpen(true) }

  async function handleSave() {
    setSaving(true); setError('')
    const url    = editing ? `/api/customers/${editing._id}` : '/api/customers'
    const method = editing ? 'PUT' : 'POST'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data   = await res.json()
    if (!data.success) { setError(data.message || t.error); setSaving(false); return }
    setModalOpen(false); fetchCustomers()
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/customers/${deleteTarget._id}`, { method: 'DELETE' })
    setDeleteTarget(null); setDeleting(false); fetchCustomers()
  }

  const counts = {
    total:    customers.length,
    active:   customers.filter(c => c.status === 'active').length,
    leads:    customers.filter(c => c.status === 'lead' || c.status === 'prospect').length,
    highPrio: customers.filter(c => c.priority === 'high' || c.priority === 'urgent').length,
  }

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1>{t.clients}</h1>
          <p className="sub">{t.clientsSubtitle}</p>
        </div>
        {hasPermission('crm.write') && (
          <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <IC d="M12 5v14M5 12h14" /> {t.addClient}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <Stat label={t.totalClients} value={counts.total}    color="var(--fg-1)" />
        <Stat label={t.active}       value={counts.active}   color="#059669" />
        <Stat label={t.leads}        value={counts.leads}    color="#2563eb" />
        <Stat label={t.highPriority} value={counts.highPrio} color="#dc2626" />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input className="input" placeholder={t.searchClients} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
        <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 150 }}>
          <option value="">{t.allStatuses}</option>
          {STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card-surface table-scroll" style={{ overflow: "hidden auto" }}>
          <table className="t-table">
            <thead>
              <tr>
                {[t.clients, t.company, t.email, t.status, t.priority, t.actions].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0 }}>
                        {(c.name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <Link href={`/app/clients/${c._id}`} style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--fg-1)' }}>{c.name}</Link>
                        {c.notes && <p style={{ fontSize: '0.72rem', color: 'var(--fg-4)' }}>{c.notes.substring(0, 40)}</p>}
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--fg-3)', fontSize: '0.875rem' }}>{c.company || '—'}</td>
                  <td>
                    <p style={{ fontSize: '0.82rem', color: 'var(--fg-3)' }}>{c.email || '—'}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--fg-4)' }}>{c.phone || ''}</p>
                  </td>
                  <td><StatusBadge status={c.status || 'lead'} /></td>
                  <td><StatusBadge status={c.priority || 'medium'} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {hasPermission('crm.write') && (
                        <button className="btn btn-secondary" onClick={() => openEdit(c)} style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>{t.edit}</button>
                      )}
                      {hasPermission('crm.write') && (
                        <button className="btn btn-danger" onClick={() => setDeleteTarget(c)} style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>{t.delete}</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--fg-4)' }}>
                  <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{t.noClients}</p>
                  <p style={{ fontSize: '0.8rem' }}>{t.addFirstClient}</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t.editClient : t.addNewClient} width={540}>
        {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.85rem', padding: '0.5rem 0.75rem', background: 'var(--danger)11', borderRadius: 6 }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div><label className="label">{t.fullName} *</label><input className="input" value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="label">{t.company}</label><input className="input" value={form.company || ''} onChange={e => setForm((p: any) => ({ ...p, company: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div><label className="label">{t.email}</label><input className="input" type="email" value={form.email || ''} onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} /></div>
            <div><label className="label">{t.phone}</label><input className="input" value={form.phone || ''} onChange={e => setForm((p: any) => ({ ...p, phone: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="label">{t.status}</label>
              <select className="input" value={form.status || 'lead'} onChange={e => setForm((p: any) => ({ ...p, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.priority}</label>
              <select className="input" value={form.priority || 'medium'} onChange={e => setForm((p: any) => ({ ...p, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{t[`status.${p}`] || p}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">{t.notes}</label><textarea className="input" value={form.notes || ''} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))} rows={3} /></div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t.saving : editing ? t.saveChanges : t.addClient}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t.deleteClient}
        message={`"${deleteTarget?.name}" — ${t.deleteClientMsg}`}
        loading={deleting}
      />
    </div>
  )
}
