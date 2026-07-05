'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const CONTRACT_STATUSES = ['draft', 'pending_approval', 'sent', 'signed', 'active', 'expired', 'renewed', 'cancelled']

const IC = ({ d, size = 16 }: { d: string | string[]; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
  </svg>
)

export default function ContractsPage() {
  const { t, lang, hasPermission } = useApp()
  const isAr = lang === 'ar'
  const canWrite = hasPermission('contracts.write')

  const [tab, setTab] = useState<'contracts' | 'templates'>('contracts')
  const [contracts, setContracts] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [tplModalOpen, setTplModalOpen] = useState(false)
  const [tplEditing, setTplEditing] = useState<any>(null)
  const [tplForm, setTplForm] = useState<any>({})
  const [shareMsg, setShareMsg] = useState('')

  async function fetchAll() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    const [coRes, tpRes, cuRes, prRes, mRes] = await Promise.all([
      fetch(`/api/contracts?${params}`).then(r => r.json()),
      fetch('/api/contracts/templates').then(r => r.json()),
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/contracts/metrics').then(r => r.json()),
    ])
    if (coRes.success) setContracts(coRes.data)
    if (tpRes.success) setTemplates(tpRes.data)
    if (cuRes.success) setCustomers(cuRes.data)
    if (prRes.success) setProjects(prRes.data)
    if (mRes.success) setMetrics(mRes.data)
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [filterStatus])

  function openCreate() {
    setForm({ status: 'draft', currency: 'SAR', renewalReminderDays: 30 })
    setEditing(null); setModalOpen(true)
  }
  function openEdit(c: any) {
    setForm({
      ...c,
      customerId: c.customer?._id || c.customerId,
      projectId: c.project?._id || c.projectId,
      startDate: c.startDate ? c.startDate.slice(0, 10) : '',
      endDate: c.endDate ? c.endDate.slice(0, 10) : '',
    })
    setEditing(c); setModalOpen(true)
  }

  function applyTemplate(tplId: string) {
    const tpl = templates.find(x => x._id === tplId)
    setForm((p: any) => {
      if (!tpl) return { ...p, templateId: '' }
      const start = p.startDate ? new Date(p.startDate) : new Date()
      const end = new Date(start); end.setMonth(end.getMonth() + (tpl.defaultDurationMonths || 12))
      return {
        ...p, templateId: tplId,
        body: p.body || tpl.body,
        value: p.value || tpl.defaultValue,
        startDate: p.startDate || start.toISOString().slice(0, 10),
        endDate: p.endDate || end.toISOString().slice(0, 10),
      }
    })
  }

  async function handleSave() {
    setSaving(true)
    const url = editing ? `/api/contracts/${editing._id}` : '/api/contracts'
    const res = await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.success) { setModalOpen(false); fetchAll() }
    else alert(data.message)
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/contracts/${deleteTarget._id}`, { method: 'DELETE' })
    setDeleteTarget(null); setDeleting(false); fetchAll()
  }

  async function handleSend(c: any) {
    const res = await fetch(`/api/contracts/${c._id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const data = await res.json()
    if (data.success) {
      try { await navigator.clipboard.writeText(data.data.shareUrl) } catch {}
      setShareMsg(`${t['contract.linkCopied']}: ${data.data.shareUrl}`)
      setTimeout(() => setShareMsg(''), 6000)
      fetchAll()
    } else alert(data.message)
  }

  async function handleRenew(c: any) {
    const res = await fetch(`/api/contracts/${c._id}/renew`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const data = await res.json()
    if (data.success) fetchAll()
    else alert(data.message)
  }

  async function handleTplSave() {
    setSaving(true)
    const url = tplEditing ? `/api/contracts/templates/${tplEditing._id}` : '/api/contracts/templates'
    const res = await fetch(url, {
      method: tplEditing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tplForm),
    })
    const data = await res.json()
    if (data.success) { setTplModalOpen(false); fetchAll() }
    else alert(data.message)
    setSaving(false)
  }

  const fmt = (n: number) => (Number(n) || 0).toLocaleString('en-US')
  const dstr = (d?: string) => d ? new Date(d).toLocaleDateString(isAr ? 'ar-u-ca-gregory' : 'en-US') : '—'
  const daysLeft = (d?: string) => d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1>{t['contract.title']}</h1>
          <p className="sub">{t['contract.subtitle']}</p>
        </div>
        {canWrite && (
          tab === 'contracts'
            ? <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><IC d="M12 5v14M5 12h14" /> {t['contract.new']}</button>
            : <button className="btn btn-primary" onClick={() => { setTplForm({ defaultDurationMonths: 12, defaultValue: 0 }); setTplEditing(null); setTplModalOpen(true) }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><IC d="M12 5v14M5 12h14" /> {t['contract.newTemplate']}</button>
        )}
      </div>

      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
          <div className="kpi"><div className="kpi-label">{t['contract.activeContracts']}</div><div className="kpi-value ltr-num">{metrics.active}</div></div>
          <div className="kpi"><div className="kpi-label">{t['contract.expiringSoon']}</div><div className="kpi-value ltr-num" style={{ color: metrics.expiringSoon > 0 ? 'var(--warning-600, #d97706)' : undefined }}>{metrics.expiringSoon}</div></div>
          <div className="kpi"><div className="kpi-label">{t['contract.renewalRate']}</div><div className="kpi-value ltr-num">{metrics.renewalRate === null ? '—' : `${metrics.renewalRate}%`}</div></div>
          <div className="kpi"><div className="kpi-label">{t['contract.totalValue']}</div><div className="kpi-value ltr-num">{fmt(metrics.totalValue)}</div></div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="seg">
          <button className={tab === 'contracts' ? 'active' : ''} onClick={() => setTab('contracts')}>{t['contract.tabContracts']}</button>
          <button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>{t['contract.tabTemplates']}</button>
        </div>
        {tab === 'contracts' && (
          <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 170 }}>
            <option value="">{t['contract.allStatuses']}</option>
            {CONTRACT_STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
          </select>
        )}
      </div>

      {shareMsg && (
        <div className="card-surface" style={{ padding: '0.65rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--success-600)', wordBreak: 'break-all' }}>{shareMsg}</div>
      )}

      {loading ? <LoadingSpinner /> : tab === 'contracts' ? (
        <div className="card-surface table-scroll" style={{ overflow: 'hidden auto' }}>
          <table className="t-table">
            <thead>
              <tr>
                {[t['contract.number'], t['contract.titleField'], t['contract.client'], t['contract.value'], t['contract.period'], t.status, t['contract.actions']].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {contracts.map(c => {
                const dl = ['active', 'signed'].includes(c.status) ? daysLeft(c.endDate) : null
                return (
                  <tr key={c._id}>
                    <td className="ltr-num" style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}>{c.contractNumber}</td>
                    <td style={{ maxWidth: 220 }}>
                      <p style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</p>
                      {c.autoRenew && <p style={{ fontSize: '0.7rem', color: 'var(--fg-4)' }}>↻ {t['contract.autoRenew']}</p>}
                    </td>
                    <td style={{ fontSize: '0.875rem', color: 'var(--fg-3)' }}>{c.customer?.name || '—'}</td>
                    <td className="ltr-num" style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{c.currency} {fmt(c.value)}</td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--fg-4)' }}>
                      {dstr(c.startDate)} ← {dstr(c.endDate)}
                      {dl !== null && dl >= 0 && dl <= 30 && <span className="pill pill-pending" style={{ marginInlineStart: 6 }}>{isAr ? `${dl} يوم` : `${dl}d`}</span>}
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {canWrite && <button className="btn btn-secondary" onClick={() => openEdit(c)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}>{t.edit}</button>}
                        {canWrite && ['draft', 'pending_approval', 'sent', 'expired'].includes(c.status) && (
                          <button className="btn btn-secondary" onClick={() => handleSend(c)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}>{t['contract.send']}</button>
                        )}
                        {canWrite && ['active', 'signed', 'expired'].includes(c.status) && (
                          <button className="btn btn-secondary" onClick={() => handleRenew(c)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}>{t['contract.renew']}</button>
                        )}
                        {canWrite && <button className="btn btn-danger" onClick={() => setDeleteTarget(c)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}>{t.delete}</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {contracts.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--fg-4)' }}>
                  <p style={{ fontWeight: 500 }}>{t['contract.noContracts']}</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card-surface table-scroll" style={{ overflow: 'hidden auto' }}>
          <table className="t-table">
            <thead>
              <tr>{[t['contract.templateName'], t['contract.duration'], t['contract.defaultValue'], t['contract.actions']].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {templates.map(tp => (
                <tr key={tp._id}>
                  <td style={{ fontWeight: 500, fontSize: '0.875rem' }}>{tp.name}</td>
                  <td className="ltr-num" style={{ fontSize: '0.85rem' }}>{tp.defaultDurationMonths} {t['contract.months']}</td>
                  <td className="ltr-num" style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{fmt(tp.defaultValue)}</td>
                  <td>
                    {canWrite && (
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button className="btn btn-secondary" onClick={() => { setTplForm(tp); setTplEditing(tp); setTplModalOpen(true) }} style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}>{t.edit}</button>
                        <button className="btn btn-danger" onClick={async () => { await fetch(`/api/contracts/templates/${tp._id}`, { method: 'DELETE' }); fetchAll() }} style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}>{t.delete}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: 'var(--fg-4)' }}>
                  <p style={{ fontWeight: 500 }}>{t['contract.noTemplatesYet']}</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Contract modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t['contract.editEntry'] : t['contract.new']} width={620}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!editing && templates.length > 0 && (
            <div>
              <label className="label">{t['contract.fromTemplate']}</label>
              <select className="input" value={form.templateId || ''} onChange={e => applyTemplate(e.target.value)}>
                <option value="">—</option>
                {templates.map(tp => <option key={tp._id} value={tp._id}>{tp.name}</option>)}
              </select>
            </div>
          )}
          <div><label className="label">{t['contract.titleField']}</label><input className="input" value={form.title || ''} onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="label">{t['contract.client']}</label>
              <select className="input" value={form.customerId || ''} onChange={e => setForm((p: any) => ({ ...p, customerId: e.target.value }))}>
                <option value="">—</option>
                {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t['contract.project']}</label>
              <select className="input" value={form.projectId || ''} onChange={e => setForm((p: any) => ({ ...p, projectId: e.target.value }))}>
                <option value="">—</option>
                {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
            <div><label className="label">{t['contract.value']}</label><input className="input ltr-num" type="number" value={form.value ?? ''} onChange={e => setForm((p: any) => ({ ...p, value: Number(e.target.value) }))} /></div>
            <div><label className="label">{t['contract.startDate']}</label><input className="input" type="date" value={form.startDate || ''} onChange={e => setForm((p: any) => ({ ...p, startDate: e.target.value }))} /></div>
            <div><label className="label">{t['contract.endDate']}</label><input className="input" type="date" value={form.endDate || ''} onChange={e => setForm((p: any) => ({ ...p, endDate: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="label">{t.status}</label>
              <select className="input" value={form.status || 'draft'} onChange={e => setForm((p: any) => ({ ...p, status: e.target.value }))}>
                {CONTRACT_STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t['contract.reminderDays']}</label>
              <input className="input ltr-num" type="number" value={form.renewalReminderDays ?? 30} onChange={e => setForm((p: any) => ({ ...p, renewalReminderDays: Number(e.target.value) }))} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--fg-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={!!form.autoRenew} onChange={e => setForm((p: any) => ({ ...p, autoRenew: e.target.checked }))} />
            {t['contract.autoRenew']}
          </label>
          <div><label className="label">{t['contract.body']}</label><textarea className="input" rows={6} value={form.body || ''} onChange={e => setForm((p: any) => ({ ...p, body: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.title}>{saving ? '…' : t.save}</button>
          </div>
        </div>
      </Modal>

      {/* Template modal */}
      <Modal open={tplModalOpen} onClose={() => setTplModalOpen(false)} title={tplEditing ? t['contract.editTemplate'] : t['contract.newTemplate']} width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><label className="label">{t['contract.templateName']}</label><input className="input" value={tplForm.name || ''} onChange={e => setTplForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div><label className="label">{t['contract.duration']} ({t['contract.months']})</label><input className="input ltr-num" type="number" value={tplForm.defaultDurationMonths ?? 12} onChange={e => setTplForm((p: any) => ({ ...p, defaultDurationMonths: Number(e.target.value) }))} /></div>
            <div><label className="label">{t['contract.defaultValue']}</label><input className="input ltr-num" type="number" value={tplForm.defaultValue ?? 0} onChange={e => setTplForm((p: any) => ({ ...p, defaultValue: Number(e.target.value) }))} /></div>
          </div>
          <div><label className="label">{t['contract.body']}</label><textarea className="input" rows={7} value={tplForm.body || ''} onChange={e => setTplForm((p: any) => ({ ...p, body: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={() => setTplModalOpen(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={handleTplSave} disabled={saving || !tplForm.name}>{saving ? '…' : t.save}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={t['contract.deleteContract']} message={`"${deleteTarget?.contractNumber || deleteTarget?.title}" — ${t['support.cannotUndo']}`} loading={deleting} />
    </div>
  )
}
