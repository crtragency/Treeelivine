'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import TicketThread from '@/components/entity/TicketThread'

const TICKET_STATUSES = ['open', 'in_progress', 'waiting_client', 'escalated', 'resolved', 'closed']
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent']
const TICKET_DEPARTMENTS = ['general', 'design', 'development', 'marketing', 'finance', 'accounts']

const IC = ({ d, size = 16 }: { d: string | string[]; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
  </svg>
)

function KpiPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem 1.25rem' }}>
      <p style={{ fontSize: '0.72rem', color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500, marginBottom: '0.3rem' }}>{label}</p>
      <p className="ltr-num" style={{ fontSize: '1.5rem', fontWeight: 700, color: color || 'var(--fg-1)' }}>{value}</p>
    </div>
  )
}

function fmtMins(m: number | null, isAr: boolean) {
  if (m === null || m === undefined) return '—'
  if (m < 60) return isAr ? `${m} د` : `${m}m`
  if (m < 1440) return isAr ? `${Math.round(m / 60)} س` : `${Math.round(m / 60)}h`
  return isAr ? `${Math.round(m / 1440)} يوم` : `${Math.round(m / 1440)}d`
}

/** SLA countdown chip for an open ticket. */
function SlaChip({ ticket, policies, isAr }: { ticket: any; policies: any; isAr: boolean }) {
  if (!policies || ['resolved', 'closed'].includes(ticket.status)) return null
  const p = policies[ticket.priority || 'medium']
  if (!p) return null
  const target = ticket.firstResponseAt
    ? new Date(ticket.createdAt).getTime() + p.resolutionMinutes * 60000
    : new Date(ticket.createdAt).getTime() + p.firstResponseMinutes * 60000
  const leftMin = Math.round((target - Date.now()) / 60000)
  const breached = leftMin < 0
  return (
    <span className={`pill ${breached ? 'pill-blocked' : 'pill-pending'}`} style={breached && isAr ? undefined : { fontFamily: 'var(--font-mono)' }}>
      {breached ? (isAr ? 'تجاوز SLA' : 'SLA breached') : `SLA ${fmtMins(leftMin, isAr)}`}
    </span>
  )
}

export default function SupportTicketsPage() {
  const { t, lang, hasPermission } = useApp()
  const isAr = lang === 'ar'
  const canManage = hasPermission('helpdesk.manage')

  const [tickets, setTickets] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [threadTicket, setThreadTicket] = useState<any>(null)
  const [escalateTo, setEscalateTo] = useState('')

  async function fetchAll() {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filterStatus) params.set('status', filterStatus)
    if (filterPriority) params.set('priority', filterPriority)
    if (filterDept) params.set('department', filterDept)
    const [tkRes, cuRes, emRes, mRes] = await Promise.all([
      fetch(`/api/tickets?${params}`).then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
      fetch('/api/tickets/metrics').then(r => r.json()),
    ])
    if (tkRes.success) setTickets(tkRes.data)
    if (cuRes.success) setCustomers(cuRes.data)
    if (emRes.success) setEmployees(emRes.data)
    if (mRes.success) setMetrics(mRes.data)
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [search, filterStatus, filterPriority, filterDept])

  function openCreate() { setForm({ status: 'open', priority: 'medium', department: 'general' }); setEditing(null); setModalOpen(true) }
  function openEdit(tk: any) {
    setForm({ ...tk, customerId: tk.customer?._id || tk.customerId, assignedTo: tk.assignee?._id || tk.assignedTo })
    setEditing(tk); setModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const url = editing ? `/api/tickets/${editing._id}` : '/api/tickets'
    const method = editing ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (data.success) { setModalOpen(false); fetchAll() }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/tickets/${deleteTarget._id}`, { method: 'DELETE' })
    setDeleteTarget(null); setDeleting(false); fetchAll()
  }

  async function handleEscalate() {
    if (!escalateTo || !threadTicket) return
    const res = await fetch(`/api/tickets/${threadTicket._id}/escalate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toEmployeeId: escalateTo }),
    }).then(r => r.json())
    if (res.success) {
      setThreadTicket((p: any) => ({ ...p, status: 'escalated' }))
      setEscalateTo('')
      fetchAll()
    } else alert(res.message)
  }

  const counts = {
    open: tickets.filter(tk => tk.status === 'open').length,
    inProgress: tickets.filter(tk => ['in_progress', 'waiting_client', 'escalated'].includes(tk.status)).length,
    resolved: tickets.filter(tk => tk.status === 'resolved' || tk.status === 'closed').length,
    urgent: tickets.filter(tk => tk.priority === 'urgent' || tk.priority === 'high').length,
  }

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1>{t['support.title']}</h1>
          <p className="sub">{t['support.subtitle']}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <IC d="M12 5v14M5 12h14" /> {t['support.newTicket']}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.875rem', marginBottom: '1rem' }}>
        <KpiPill label={t['support.open']} value={counts.open} color="#2563eb" />
        <KpiPill label={t['support.inProgress']} value={counts.inProgress} color="#d97706" />
        <KpiPill label={t['support.resolved']} value={counts.resolved} color="#059669" />
        <KpiPill label={t['support.highUrgent']} value={counts.urgent} color="#dc2626" />
      </div>

      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
          <KpiPill label={t['ticket.avgFirstResponse']} value={fmtMins(metrics.avgFirstResponseMinutes, isAr)} />
          <KpiPill label={t['ticket.avgResolution']} value={fmtMins(metrics.avgResolutionMinutes, isAr)} />
          <KpiPill label={t['ticket.slaCompliance']} value={metrics.slaCompliance === null ? '—' : `${metrics.slaCompliance}%`} color={metrics.slaCompliance !== null && metrics.slaCompliance < 80 ? '#dc2626' : '#059669'} />
          <KpiPill label={t['ticket.csat']} value={metrics.avgCsat === null ? '—' : `${metrics.avgCsat} / 5 ★`} color="#d97706" />
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input className="input" placeholder={t['support.searchTickets']} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
        <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 150 }}>
          <option value="">{t['support.allStatuses']}</option>
          {TICKET_STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
        </select>
        <select className="input" value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ width: 140 }}>
          <option value="">{t['support.allPriorities']}</option>
          {TICKET_PRIORITIES.map(p => <option key={p} value={p}>{t[`status.${p}`] || p}</option>)}
        </select>
        <select className="input" value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ width: 150 }}>
          <option value="">{t['ticket.allDepartments']}</option>
          {TICKET_DEPARTMENTS.map(d => <option key={d} value={d}>{t[`dept.${d}`] || d}</option>)}
        </select>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card-surface table-scroll" style={{ overflow: "hidden auto" }}>
          <table className="t-table">
            <thead>
              <tr>
                {[t['support.ticketNumber'], t['support.ticketTitle'], t['support.client'], t['ticket.department'], t['support.assignedTo'], t['support.priority'], t['support.status'], 'SLA', t['support.actions']].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map(tk => (
                <tr key={tk._id}>
                  <td style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.82rem' }}>{tk.ticketNumber}</td>
                  <td style={{ maxWidth: 220 }}>
                    <p style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tk.title}</p>
                    {tk.satisfactionRating && <p style={{ fontSize: '0.7rem', color: '#d97706' }}>{'★'.repeat(tk.satisfactionRating)} <span style={{ color: 'var(--fg-5)' }}>{tk.satisfactionRating}/5</span></p>}
                  </td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--fg-3)' }}>{tk.customer?.name || '—'}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--fg-3)' }}>{t[`dept.${tk.department}`] || tk.department || '—'}</td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--fg-3)' }}>{tk.assignee?.name || '—'}</td>
                  <td><StatusBadge status={tk.priority || 'medium'} /></td>
                  <td><StatusBadge status={tk.status} /></td>
                  <td><SlaChip ticket={tk} policies={metrics?.policies} isAr={isAr} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" onClick={() => { setThreadTicket(tk); setEscalateTo('') }} style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>{t['ticket.thread']}</button>
                      <button className="btn btn-secondary" onClick={() => openEdit(tk)} style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>{t.edit}</button>
                      <button className="btn btn-danger" onClick={() => setDeleteTarget(tk)} style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>{t.delete}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '3rem', textAlign: 'center', color: 'var(--fg-4)' }}>
                  <p style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{t['support.noTickets']}</p>
                  <p style={{ fontSize: '0.8rem' }}>{t['support.createFirstTicket']}</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / create modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t['support.editTicket'] : t['support.newTicket']} width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><label className="label">{t['support.titleField']}</label><input className="input" value={form.title || ''} onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))} placeholder={t['support.issueBrief']} /></div>
          <div><label className="label">{t.description}</label><textarea className="input" value={form.description || ''} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))} rows={3} placeholder={t['support.detailedDesc']} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="label">{t['support.client']}</label>
              <select className="input" value={form.customerId || ''} onChange={e => setForm((p: any) => ({ ...p, customerId: e.target.value }))}>
                <option value="">—</option>
                {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t['support.assignTo']}</label>
              <select className="input" value={form.assignedTo || ''} onChange={e => setForm((p: any) => ({ ...p, assignedTo: e.target.value }))}>
                <option value="">{t['support.unassigned']}</option>
                {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="label">{t.status}</label>
              <select className="input" value={form.status || 'open'} onChange={e => setForm((p: any) => ({ ...p, status: e.target.value }))}>
                {TICKET_STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.priority}</label>
              <select className="input" value={form.priority || 'medium'} onChange={e => setForm((p: any) => ({ ...p, priority: e.target.value }))}>
                {TICKET_PRIORITIES.map(p => <option key={p} value={p}>{t[`status.${p}`] || p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t['ticket.department']}</label>
              <select className="input" value={form.department || 'general'} onChange={e => setForm((p: any) => ({ ...p, department: e.target.value }))}>
                {TICKET_DEPARTMENTS.map(d => <option key={d} value={d}>{t[`dept.${d}`] || d}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? t['support.saving'] : editing ? t['support.saveChanges'] : t['support.createTicket']}</button>
          </div>
        </div>
      </Modal>

      {/* Conversation drawer */}
      <Modal open={!!threadTicket} onClose={() => setThreadTicket(null)} title={threadTicket ? `${threadTicket.ticketNumber} — ${threadTicket.title}` : ''} width={640}>
        {threadTicket && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={threadTicket.status} />
              <StatusBadge status={threadTicket.priority || 'medium'} />
              <SlaChip ticket={threadTicket} policies={metrics?.policies} isAr={isAr} />
              {threadTicket.satisfactionRating && <span className="pill pill-active">{'★'.repeat(threadTicket.satisfactionRating)} {threadTicket.satisfactionRating}/5</span>}
            </div>
            {threadTicket.description && (
              <p style={{ fontSize: '0.8rem', color: 'var(--fg-3)', background: 'var(--bg-surface-2, var(--bg-app))', borderRadius: 8, padding: '0.6rem 0.8rem' }}>{threadTicket.description}</p>
            )}
            <TicketThread ticketId={threadTicket._id} staff />
            {canManage && !['resolved', 'closed'].includes(threadTicket.status) && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', borderTop: '1px solid var(--border-1)', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label className="label">{t['ticket.escalateTo']}</label>
                  <select className="input" value={escalateTo} onChange={e => setEscalateTo(e.target.value)}>
                    <option value="">—</option>
                    {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                  </select>
                </div>
                <button className="btn btn-secondary" onClick={handleEscalate} disabled={!escalateTo}>🚨 {t['ticket.escalate']}</button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={t['support.deleteTicket']} message={`"${deleteTarget?.ticketNumber}" — ${t['support.cannotUndo']}`} loading={deleting} />
    </div>
  )
}
