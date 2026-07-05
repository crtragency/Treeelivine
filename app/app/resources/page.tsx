'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const VACATION_TYPES = ['vacation', 'sick', 'unpaid', 'other']

export default function ResourcesPage() {
  const { t, lang, hasPermission } = useApp()
  const isAr = lang === 'ar'
  const canWrite = hasPermission('resources.write')

  const [tab, setTab] = useState<'board' | 'vacations'>('board')
  const [data, setData] = useState<any>(null)
  const [vacations, setVacations] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [allocModal, setAllocModal] = useState(false)
  const [allocForm, setAllocForm] = useState<any>({})
  const [vacModal, setVacModal] = useState(false)
  const [vacForm, setVacForm] = useState<any>({ type: 'vacation' })
  const [saving, setSaving] = useState(false)
  const [deleteAlloc, setDeleteAlloc] = useState<any>(null)

  async function fetchAll() {
    setLoading(true)
    const [rRes, vRes, eRes, pRes] = await Promise.all([
      fetch('/api/resources').then(r => r.json()),
      fetch('/api/vacations').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ])
    if (rRes.success) setData(rRes.data)
    if (vRes.success) setVacations(vRes.data)
    if (eRes.success) setEmployees(eRes.data)
    if (pRes.success) setProjects(pRes.data)
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [])

  async function saveAlloc() {
    setSaving(true)
    const res = await fetch('/api/allocations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allocForm),
    }).then(r => r.json())
    if (res.success) { setAllocModal(false); setAllocForm({}); fetchAll() }
    else alert(res.message)
    setSaving(false)
  }

  async function saveVacation() {
    setSaving(true)
    const res = await fetch('/api/vacations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vacForm),
    }).then(r => r.json())
    if (res.success) { setVacModal(false); setVacForm({ type: 'vacation' }); fetchAll() }
    else alert(res.message)
    setSaving(false)
  }

  async function setVacStatus(v: any, status: string) {
    const res = await fetch(`/api/vacations/${v._id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then(r => r.json())
    if (res.success) fetchAll()
    else alert(res.message)
  }

  async function removeAlloc() {
    await fetch(`/api/allocations/${deleteAlloc.id}`, { method: 'DELETE' })
    setDeleteAlloc(null); fetchAll()
  }

  const dstr = (d?: string) => d ? new Date(d).toLocaleDateString(isAr ? 'ar-u-ca-gregory' : 'en') : '—'

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1>{t['res.title']}</h1>
          <p className="sub">{t['res.subtitle']}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => { setVacForm({ type: 'vacation' }); setVacModal(true) }}>🌴 {t['res.requestVacation']}</button>
          {canWrite && <button className="btn btn-primary" onClick={() => { setAllocForm({ percent: 50, startDate: new Date().toISOString().slice(0, 10) }); setAllocModal(true) }}>+ {t['res.newAllocation']}</button>}
        </div>
      </div>

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.875rem', marginBottom: '1.5rem' }}>
          <div className="kpi"><div className="kpi-label">{t['res.avgAllocation']}</div><div className="kpi-value ltr-num">{data.avgAllocation}%</div></div>
          <div className="kpi"><div className="kpi-label">{t['res.overloaded']}</div><div className="kpi-value ltr-num" style={{ color: data.overloadedCount ? 'var(--danger-600, #dc2626)' : undefined }}>{data.overloadedCount}</div></div>
          <div className="kpi"><div className="kpi-label">{t['res.onVacation']}</div><div className="kpi-value ltr-num">{data.onVacationToday}</div></div>
          <div className="kpi"><div className="kpi-label">{t['res.pendingRequests']}</div><div className="kpi-value ltr-num" style={{ color: data.pendingVacations ? 'var(--warning-600, #d97706)' : undefined }}>{data.pendingVacations}</div></div>
        </div>
      )}

      <div className="seg" style={{ marginBottom: '1rem' }}>
        <button className={tab === 'board' ? 'active' : ''} onClick={() => setTab('board')}>{t['res.tabBoard']}</button>
        <button className={tab === 'vacations' ? 'active' : ''} onClick={() => setTab('vacations')}>{t['res.tabVacations']}</button>
      </div>

      {loading ? <LoadingSpinner /> : tab === 'board' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {(data?.board || []).map((b: any) => (
            <div key={b.employeeId} className="card-surface" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--fg-1)' }}>{b.name}</span>
                  {b.position && <span style={{ fontSize: '0.75rem', color: 'var(--fg-4)', marginInlineStart: 8 }}>{b.position}</span>}
                  {b.onVacation && <span className="pill pill-info" style={{ marginInlineStart: 8 }}>🌴 {t['res.onVacationNow']}</span>}
                  {b.overloaded && <span className="pill pill-blocked" style={{ marginInlineStart: 8 }}>⚠ {t['res.overloadedPill']}</span>}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: '0.75rem', color: 'var(--fg-4)' }}>
                  <span className="ltr-num">{t['res.capacity']}: {b.capacityHours}h</span>
                  <span className="ltr-num">{t['res.tracked']}: {b.trackedHours}h ({b.utilization}%)</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="progress" style={{ flex: 1 }}>
                  <div style={{
                    width: `${Math.min(b.allocatedPercent, 100)}%`, height: '100%', borderRadius: 'inherit',
                    background: b.allocatedPercent > 100 ? 'var(--danger-600, #dc2626)' : b.allocatedPercent > 80 ? 'var(--warning-600, #d97706)' : 'var(--brand-primary)',
                    transition: 'width 200ms',
                  }} />
                </div>
                <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600, color: b.allocatedPercent > 100 ? 'var(--danger-600, #dc2626)' : 'var(--fg-2)', minWidth: 44, textAlign: 'end' }}>
                  {b.allocatedPercent}%
                </span>
              </div>
              {b.allocations.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: '0.6rem' }}>
                  {b.allocations.map((a: any) => (
                    <span key={a.id} className="pill pill-draft" style={{ gap: 6 }}>
                      {a.project?.name || '—'} · <span className="ltr-num">{a.percent}%</span>
                      {canWrite && (
                        <button onClick={() => setDeleteAlloc(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-4)', padding: 0, lineHeight: 1 }}>✕</button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {(data?.board || []).length === 0 && (
            <div className="card-surface" style={{ padding: '3rem', textAlign: 'center', color: 'var(--fg-4)' }}>{t['res.emptyBoard']}</div>
          )}
        </div>
      ) : (
        <div className="card-surface table-scroll" style={{ overflow: 'hidden auto' }}>
          <table className="t-table">
            <thead>
              <tr>{[t['res.employee'], t['res.type'], t['res.period'], t.status, t['res.notesField'], t['support.actions']].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {vacations.map(v => (
                <tr key={v._id}>
                  <td style={{ fontWeight: 500, fontSize: '0.875rem' }}>{v.employee?.name || '—'}</td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--fg-3)' }}>{t[`vac.${v.type}`] || v.type}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--fg-4)' }}>{dstr(v.startDate)} ← {dstr(v.endDate)}</td>
                  <td><StatusBadge status={v.status} /></td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--fg-4)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.notes || '—'}</td>
                  <td>
                    {canWrite && v.status === 'pending' && (
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button className="btn btn-primary" onClick={() => setVacStatus(v, 'approved')} style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}>{t['res.approve']}</button>
                        <button className="btn btn-danger" onClick={() => setVacStatus(v, 'rejected')} style={{ padding: '0.3rem 0.6rem', fontSize: '0.72rem' }}>{t['res.reject']}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {vacations.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--fg-4)' }}>{t['res.noVacations']}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Allocation modal */}
      <Modal open={allocModal} onClose={() => setAllocModal(false)} title={t['res.newAllocation']} width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="label">{t['res.employee']}</label>
              <select className="input" value={allocForm.employeeId || ''} onChange={e => setAllocForm((p: any) => ({ ...p, employeeId: e.target.value }))}>
                <option value="">—</option>
                {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t['res.project']}</label>
              <select className="input" value={allocForm.projectId || ''} onChange={e => setAllocForm((p: any) => ({ ...p, projectId: e.target.value }))}>
                <option value="">—</option>
                {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{t['res.percent']} (<span className="ltr-num">{allocForm.percent || 50}%</span>)</label>
            <input type="range" min={5} max={100} step={5} value={allocForm.percent || 50}
              onChange={e => setAllocForm((p: any) => ({ ...p, percent: Number(e.target.value) }))} style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div><label className="label">{t['contract.startDate']}</label><input className="input" type="date" value={allocForm.startDate || ''} onChange={e => setAllocForm((p: any) => ({ ...p, startDate: e.target.value }))} /></div>
            <div><label className="label">{t['contract.endDate']}</label><input className="input" type="date" value={allocForm.endDate || ''} onChange={e => setAllocForm((p: any) => ({ ...p, endDate: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setAllocModal(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={saveAlloc} disabled={saving || !allocForm.employeeId || !allocForm.projectId || !allocForm.startDate}>{saving ? '…' : t.save}</button>
          </div>
        </div>
      </Modal>

      {/* Vacation request modal */}
      <Modal open={vacModal} onClose={() => setVacModal(false)} title={t['res.requestVacation']} width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {canWrite && (
            <div>
              <label className="label">{t['res.employee']}</label>
              <select className="input" value={vacForm.employeeId || ''} onChange={e => setVacForm((p: any) => ({ ...p, employeeId: e.target.value }))}>
                <option value="">{t['res.myself']}</option>
                {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">{t['res.type']}</label>
            <select className="input" value={vacForm.type} onChange={e => setVacForm((p: any) => ({ ...p, type: e.target.value }))}>
              {VACATION_TYPES.map(ty => <option key={ty} value={ty}>{t[`vac.${ty}`] || ty}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div><label className="label">{t['contract.startDate']}</label><input className="input" type="date" value={vacForm.startDate || ''} onChange={e => setVacForm((p: any) => ({ ...p, startDate: e.target.value }))} /></div>
            <div><label className="label">{t['contract.endDate']}</label><input className="input" type="date" value={vacForm.endDate || ''} onChange={e => setVacForm((p: any) => ({ ...p, endDate: e.target.value }))} /></div>
          </div>
          <div><label className="label">{t['res.notesField']}</label><textarea className="input" rows={2} value={vacForm.notes || ''} onChange={e => setVacForm((p: any) => ({ ...p, notes: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setVacModal(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={saveVacation} disabled={saving || !vacForm.startDate || !vacForm.endDate}>{saving ? '…' : t['res.submitRequest']}</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={!!deleteAlloc} onClose={() => setDeleteAlloc(null)} onConfirm={removeAlloc} title={t['res.deleteAllocation']} message={`${deleteAlloc?.project?.name || ''} — ${t['support.cannotUndo']}`} loading={false} />
    </div>
  )
}
