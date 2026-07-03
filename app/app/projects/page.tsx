'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled']

export default function ProjectsPage() {
  const { t, hasPermission } = useApp()
  const [projects, setProjects] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  async function fetchProjects() {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    const [pr, cu, em] = await Promise.all([
      fetch(`/api/projects?${params}`).then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
    ])
    if (pr.success) setProjects(pr.data)
    if (cu.success) setCustomers(cu.data)
    if (em.success) setEmployees(em.data)
    setLoading(false)
  }

  useEffect(() => { fetchProjects() }, [search, filterStatus])

  function openCreate() { setForm({ status: 'planning' }); setEditing(null); setModalOpen(true) }
  function openEdit(p: any) { setForm({ ...p, customerId: p.customerId?._id || p.customerId, assignedEmployeeIds: (p.assignedEmployeeIds || []).map((e: any) => e._id || e) }); setEditing(p); setModalOpen(true) }

  async function handleSave() {
    setSaving(true)
    const url = editing ? `/api/projects/${editing._id}` : '/api/projects'
    const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (data.success) { setModalOpen(false); fetchProjects() }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/projects/${deleteTarget._id}`, { method: 'DELETE' })
    setDeleteTarget(null); setDeleting(false); fetchProjects()
  }

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.01em', flex: 1 }}>{t['projects.title'] || 'Projects'}</h2>
        <input className="input" placeholder={t.search} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 200 }} />
        <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 160 }}>
          <option value="">{t.allStatuses}</option>
          {STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
        </select>
        {hasPermission('projects.write') && <button className="btn btn-primary" onClick={openCreate}>+ {t.addProject}</button>}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {projects.map(p => (
            <div key={p._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{p.name}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.customer?.name || p.customerId?.name || '-'}</p>
                </div>
                <StatusBadge status={p.status || 'planning'} />
              </div>
              {p.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{p.description.substring(0, 100)}{p.description.length > 100 ? '...' : ''}</p>}
              {p.dueDate && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.due} {new Date(p.dueDate).toLocaleDateString()}</p>}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                <Link href={`/app/projects/${p._id}/brief`} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }}>{t.brief}</Link>
                {hasPermission('projects.write') && <button className="btn btn-secondary" onClick={() => openEdit(p)} style={{ fontSize: '0.8rem' }}>{t.edit}</button>}
                {hasPermission('projects.write') && <button className="btn btn-danger" onClick={() => setDeleteTarget(p)} style={{ fontSize: '0.8rem' }}>{t.delete}</button>}
              </div>
            </div>
          ))}
          {projects.length === 0 && <p style={{ color: 'var(--text-muted)', gridColumn: '1/-1' }}>{t.noProjects}</p>}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t.editProject : t.addProject} width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><label className="label">{t.name} *</label><input className="input" value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
          <div><label className="label">{t.customer}</label>
            <select className="input" value={form.customerId || ''} onChange={e => setForm((p: any) => ({ ...p, customerId: e.target.value }))}>
              <option value="">{t.selectCustomer}</option>
              {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">{t.description}</label><textarea className="input" value={form.description || ''} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))} rows={3} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><label className="label">{t.status}</label>
              <select className="input" value={form.status || 'planning'} onChange={e => setForm((p: any) => ({ ...p, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
              </select>
            </div>
            <div><label className="label">{t.dueDate}</label><input className="input" type="date" value={form.dueDate ? form.dueDate.substring(0, 10) : ''} onChange={e => setForm((p: any) => ({ ...p, dueDate: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t.save}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={t.deleteProject} message={`"${deleteTarget?.name}"?`} loading={deleting} />
    </div>
  )
}
