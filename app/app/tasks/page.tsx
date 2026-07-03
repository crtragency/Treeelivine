'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const STATUSES = ['pending', 'in_progress', 'in_review', 'completed', 'cancelled']
const PRIORITIES = ['low', 'medium', 'high']

export default function TasksPage() {
  const { t, hasPermission } = useApp()
  const [tasks, setTasks] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [handoverModal, setHandoverModal] = useState<any>(null)
  const [newAssignee, setNewAssignee] = useState('')
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  async function fetchTasks() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    const [ta, pr, em] = await Promise.all([
      fetch(`/api/tasks?${params}`).then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
    ])
    if (ta.success) setTasks(ta.data)
    if (pr.success) setProjects(pr.data)
    if (em.success) setEmployees(em.data)
    setLoading(false)
  }

  useEffect(() => { fetchTasks() }, [filterStatus])

  function openCreate() { setForm({ status: 'pending', priority: 'medium' }); setEditing(null); setModalOpen(true) }
  function openEdit(task: any) { setForm({ ...task, projectId: task.projectId?._id || task.projectId, currentAssigneeId: task.currentAssigneeId?._id || task.currentAssigneeId }); setEditing(task); setModalOpen(true) }

  async function handleSave() {
    setSaving(true)
    const url = editing ? `/api/tasks/${editing._id}` : '/api/tasks'
    const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (data.success) { setModalOpen(false); fetchTasks() }
    setSaving(false)
  }

  async function handleStatusChange(taskId: string, status: string) {
    await fetch(`/api/tasks/${taskId}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    fetchTasks()
  }

  async function handleHandover() {
    if (!newAssignee) return
    await fetch(`/api/tasks/${handoverModal._id}/handover`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newAssigneeId: newAssignee }) })
    setHandoverModal(null); setNewAssignee(''); fetchTasks()
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/tasks/${deleteTarget._id}`, { method: 'DELETE' })
    setDeleteTarget(null); setDeleting(false); fetchTasks()
  }

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.01em', flex: 1 }}>{t['tasks.title'] || t.tasks}</h2>
        <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 160 }}>
          <option value="">{t.allStatuses}</option>
          {STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
        </select>
        {hasPermission('tasks.write') && <button className="btn btn-primary" onClick={openCreate}>+ {t.addTask}</button>}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="t-table">
            <thead>
              <tr>
                {[t.taskTitle, t.taskProject, t.taskAssignee, t.taskPriority, t.taskStatus, t.taskDue, t.taskActions].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr key={task._id}>
                  <td style={{ fontWeight: 500 }}>{task.title}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{task.project?.name || task.projectId?.name || '-'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{task.assignee?.name || task.currentAssigneeId?.name || '-'}</td>
                  <td><StatusBadge status={task.priority || 'medium'} /></td>
                  <td>
                    <select value={task.status} onChange={e => handleStatusChange(task._id, e.target.value)} style={{ fontSize: '0.8rem', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer' }}>
                      {STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
                    </select>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: task.dueDate && new Date(task.dueDate) < new Date() ? 'var(--danger)' : 'var(--text-muted)' }}>
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {hasPermission('tasks.write') && <button className="btn btn-secondary" onClick={() => openEdit(task)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>{t.edit}</button>}
                      {hasPermission('tasks.write') && <button className="btn btn-secondary" onClick={() => { setHandoverModal(task); setNewAssignee('') }} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>{t.handover}</button>}
                      {hasPermission('tasks.write') && <button className="btn btn-danger" onClick={() => setDeleteTarget(task)} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>{t.delete}</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t.noTasks}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t.editTask : t.addTask} width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><label className="label">{t.name} *</label><input className="input" value={form.title || ''} onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))} /></div>
          <div><label className="label">{t['tasks.taskProject'] || t.project}</label>
            <select className="input" value={form.projectId || ''} onChange={e => setForm((p: any) => ({ ...p, projectId: e.target.value }))}>
              <option value="">{t.noProject}</option>
              {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div><label className="label">{t.assignee}</label>
            <select className="input" value={form.currentAssigneeId || ''} onChange={e => setForm((p: any) => ({ ...p, currentAssigneeId: e.target.value }))}>
              <option value="">{t['tasks.unassigned'] || t.unassigned}</option>
              {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div><label className="label">{t.status}</label>
              <select className="input" value={form.status || 'pending'} onChange={e => setForm((p: any) => ({ ...p, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
              </select>
            </div>
            <div><label className="label">{t.priority}</label>
              <select className="input" value={form.priority || 'medium'} onChange={e => setForm((p: any) => ({ ...p, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{t[`status.${p}`] || p}</option>)}
              </select>
            </div>
            <div><label className="label">{t.dueDate}</label><input className="input" type="date" value={form.dueDate ? form.dueDate.substring(0, 10) : ''} onChange={e => setForm((p: any) => ({ ...p, dueDate: e.target.value }))} /></div>
          </div>
          <div><label className="label">{t.description}</label><textarea className="input" value={form.description || ''} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))} rows={3} /></div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '...' : t.save}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!handoverModal} onClose={() => setHandoverModal(null)} title={t.handoverTask} width={380}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t.assignTo} "{handoverModal?.title}"</p>
          <select className="input" value={newAssignee} onChange={e => setNewAssignee(e.target.value)}>
            <option value="">{t.selectEmployee}</option>
            {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setHandoverModal(null)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={handleHandover} disabled={!newAssignee}>{t.handover}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={t.deleteTask} message={`"${deleteTarget?.title}"?`} loading={deleting} />
    </div>
  )
}
