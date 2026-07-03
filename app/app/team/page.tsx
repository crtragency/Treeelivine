'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const ROLES = ['manager', 'designer', 'developer', 'copywriter', 'account_manager', 'other']

export default function TeamPage() {
  const { t, hasPermission } = useApp()
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState<any>({})

  async function fetchEmployees() {
    setLoading(true)
    const res = await fetch('/api/employees')
    const data = await res.json()
    if (data.success) setEmployees(data.data)
    setLoading(false)
  }

  useEffect(() => { fetchEmployees() }, [])

  function openCreate() { setForm({}); setEditing(null); setModalOpen(true) }
  function openEdit(e: any) { setForm({ ...e }); setEditing(e); setModalOpen(true) }

  async function handleSave() {
    setSaving(true)
    const url = editing ? `/api/employees/${editing._id}` : '/api/employees'
    const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (data.success) { setModalOpen(false); fetchEmployees() }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/employees/${deleteTarget._id}`, { method: 'DELETE' })
    setDeleteTarget(null); setDeleting(false); fetchEmployees()
  }

  async function fetchStats(empId: string) {
    const res = await fetch(`/api/employees/${empId}`)
    const data = await res.json()
    if (data.success) setStats((p: any) => ({ ...p, [empId]: data.stats }))
  }

  useEffect(() => {
    employees.forEach(e => fetchStats(e._id))
  }, [employees.length])

  return (
    <div className="page-content">
      <div className="page-head">
        <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>{t['team.title'] || t.team}</h2>
        {hasPermission('team.write') && <button className="btn btn-primary" onClick={openCreate}>+ {t.addEmployee}</button>}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {employees.map(emp => (
            <div key={emp._id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: '1.1rem', flexShrink: 0 }}>
                  {(emp.name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p style={{ fontWeight: 600 }}>{emp.name}</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{emp.internalRole || emp.email}</p>
                </div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{emp.email}</p>
              {stats[emp._id] && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', background: 'var(--surface2)', padding: '0.2rem 0.5rem', borderRadius: 6 }}>{t['team.tasks'] || t.tasks}: {stats[emp._id].taskCount}</span>
                  <span style={{ fontSize: '0.75rem', background: 'var(--surface2)', padding: '0.2rem 0.5rem', borderRadius: 6 }}>{t['projects.title'] || t.projects}: {stats[emp._id].projectCount}</span>
                  {stats[emp._id].overdueTasks > 0 && <span style={{ fontSize: '0.75rem', background: 'var(--danger)22', color: 'var(--danger)', padding: '0.2rem 0.5rem', borderRadius: 6 }}>{t.overdue}: {stats[emp._id].overdueTasks}</span>}
                </div>
              )}
              {hasPermission('team.write') && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" onClick={() => openEdit(emp)} style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem' }}>{t.edit}</button>
                  <button className="btn btn-danger" onClick={() => setDeleteTarget(emp)} style={{ fontSize: '0.8rem' }}>{t.delete}</button>
                </div>
              )}
            </div>
          ))}
          {employees.length === 0 && <p style={{ color: 'var(--text-muted)' }}>{t.noTeamMembers}</p>}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t.editEmployee : t.addEmployee}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><label className="label">{t.name} *</label><input className="input" value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
          <div><label className="label">{t.email} *</label><input className="input" type="email" value={form.email || ''} onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} /></div>
          <div><label className="label">{t.phone}</label><input className="input" value={form.phone || ''} onChange={e => setForm((p: any) => ({ ...p, phone: e.target.value }))} /></div>
          <div><label className="label">{t.role}</label>
            <select className="input" value={form.internalRole || ''} onChange={e => setForm((p: any) => ({ ...p, internalRole: e.target.value }))}>
              <option value="">{t.selectRole}</option>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div><label className="label">{t.salary} ({t.monthly})</label><input className="input" type="number" value={form.salary || ''} onChange={e => setForm((p: any) => ({ ...p, salary: Number(e.target.value) }))} /></div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t.save}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={t.removeEmployee} message={`"${deleteTarget?.name}" ${t.removeEmpMsg}`} loading={deleting} />
    </div>
  )
}
