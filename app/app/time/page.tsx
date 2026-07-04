'use client'
import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/contexts/AppContext'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type Tab = 'logs' | 'reports'

function fmtDur(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

function Elapsed({ since }: { since: string }) {
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(i) }, [])
  const secs = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000))
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60
  return <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontFeatureSettings: '"tnum"' }}>{h}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span>
}

export default function TimeTrackingPage() {
  const { t, lang, hasPermission } = useApp()
  const isAr = lang === 'ar'
  const [tab, setTab] = useState<Tab>('logs')
  const [timer, setTimer] = useState<any>(null)
  const [employee, setEmployee] = useState<any>(undefined) // undefined = loading, null = not linked
  const [entries, setEntries] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<'today' | 'week'>('week')

  // timer form
  const [desc, setDesc] = useState('')
  const [projectId, setProjectId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [billable, setBillable] = useState(true)
  const [busy, setBusy] = useState(false)

  // manual entry modal
  const [manualOpen, setManualOpen] = useState(false)
  const [manual, setManual] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const rangeFrom = useCallback(() => {
    const now = new Date()
    if (range === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return d }
    const d = new Date(now); d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0); return d // week start (Sunday)
  }, [range])

  const loadAll = useCallback(async () => {
    const from = rangeFrom().toISOString()
    const [tm, en, pr, ts, rp] = await Promise.all([
      fetch('/api/time-entries/timer').then(r => r.json()),
      fetch(`/api/time-entries?from=${from}`).then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/tasks').then(r => r.json()),
      fetch(`/api/time-entries/reports?from=${from}`).then(r => r.json()),
    ])
    if (tm.success) { setTimer(tm.data); setEmployee(tm.employee ?? null) }
    if (en.success) setEntries(en.data)
    if (pr.success) setProjects(pr.data)
    if (ts.success) setTasks(ts.data)
    if (rp.success) setReport(rp.data)
    setLoading(false)
  }, [rangeFrom])

  useEffect(() => { loadAll() }, [loadAll])

  async function startTimer() {
    setBusy(true)
    const res = await fetch('/api/time-entries/timer', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: desc, projectId: projectId || null, taskId: taskId || null, billable }),
    })
    const data = await res.json()
    if (data.success) { setTimer(data.data); setDesc('') } else alert(data.message)
    setBusy(false); loadAll()
  }

  async function stopTimer() {
    setBusy(true)
    const res = await fetch('/api/time-entries/timer', { method: 'PUT' })
    const data = await res.json()
    if (data.success) setTimer(null); else alert(data.message)
    setBusy(false); loadAll()
  }

  async function saveManual() {
    setSaving(true)
    const res = await fetch('/api/time-entries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: manual.description,
        projectId: manual.projectId || null,
        taskId: manual.taskId || null,
        billable: manual.billable !== false,
        startedAt: manual.date && manual.start ? `${manual.date}T${manual.start}:00` : null,
        endedAt: manual.date && manual.end ? `${manual.date}T${manual.end}:00` : null,
      }),
    })
    const data = await res.json()
    if (data.success) { setManualOpen(false); loadAll() } else alert(data.message)
    setSaving(false)
  }

  async function removeEntry(id: string) {
    await fetch(`/api/time-entries/${id}`, { method: 'DELETE' })
    loadAll()
  }

  const tp = (k: string) => t[`timePage.${k}`] || k
  const dstr = (d: string) => new Date(d).toLocaleDateString(isAr ? 'ar-u-ca-gregory' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const tstr = (d: string) => new Date(d).toLocaleTimeString(isAr ? 'ar' : 'en-US', { hour: '2-digit', minute: '2-digit' })
  const canWrite = hasPermission('time.write')

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1>{tp('title')}</h1>
          <div className="sub">{tp('subtitle')}</div>
        </div>
        <div className="actions">
          <div className="seg">
            <button className={range === 'today' ? 'on' : ''} onClick={() => setRange('today')}>{tp('today')}</button>
            <button className={range === 'week' ? 'on' : ''} onClick={() => setRange('week')}>{tp('thisWeek')}</button>
          </div>
          {canWrite && employee && (
            <button className="btn btn-secondary" onClick={() => { setManual({ billable: true, date: new Date().toISOString().substring(0, 10) }); setManualOpen(true) }}>
              + {tp('manualEntry')}
            </button>
          )}
        </div>
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* ── Timer card ── */}
          {employee === null ? (
            <div className="card-surface" style={{ padding: 'var(--space-5)', color: 'var(--fg-3)', fontSize: 'var(--fs-sm)' }}>
              {tp('noEmployee')}
            </div>
          ) : timer ? (
            <div className="card-surface" style={{ padding: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--success-500)', animation: 'pulseDot 2.5s ease-in-out infinite' }} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--fg-1)' }}>
                  {timer.description || timer.task?.title || timer.project?.name || tp('running')}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-4)' }}>
                  {timer.project?.name || '—'}{timer.billable ? ` · ${tp('billable')}` : ''}
                </div>
              </div>
              <span style={{ fontSize: 'var(--fs-3xl)', fontWeight: 600, color: 'var(--fg-1)' }}><Elapsed since={timer.startedAt} /></span>
              {canWrite && <button className="btn btn-danger" onClick={stopTimer} disabled={busy}>■ {tp('stopTimer')}</button>}
            </div>
          ) : (
            <div className="card-surface" style={{ padding: 'var(--space-5)', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: 180 }}>
                <label className="label">{tp('description')}</label>
                <input className="input" value={desc} onChange={e => setDesc(e.target.value)} placeholder={isAr ? 'على إيه شغال دلوقتي؟' : 'What are you working on?'} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label className="label">{t.project}</label>
                <select className="input" value={projectId} onChange={e => setProjectId(e.target.value)}>
                  <option value="">{tp('selectProject')}</option>
                  {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label className="label">{t.assignee === undefined ? 'Task' : (isAr ? 'المهمة' : 'Task')}</label>
                <select className="input" value={taskId} onChange={e => setTaskId(e.target.value)}>
                  <option value="">{tp('selectTask')}</option>
                  {tasks.filter(tk => !projectId || tk.projectId === projectId).map(tk => <option key={tk._id} value={tk._id}>{tk.title}</option>)}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--fg-3)', height: 34, cursor: 'pointer' }}>
                <input type="checkbox" checked={billable} onChange={e => setBillable(e.target.checked)} /> {tp('billable')}
              </label>
              {canWrite && <button className="btn btn-primary" onClick={startTimer} disabled={busy}>▶ {tp('startTimer')}</button>}
            </div>
          )}

          {/* ── Summary tiles ── */}
          {report && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {[
                { label: tp('totalHours'), value: fmtDur(report.totals.total) },
                { label: tp('billable'), value: fmtDur(report.totals.billable), color: 'var(--success-600)' },
                { label: tp('nonBillable'), value: fmtDur(report.totals.nonBillable), color: 'var(--fg-4)' },
              ].map(k => (
                <div key={k.label} className="kpi" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span className="kpi-label" style={{ marginBottom: 0 }}>{k.label}</span>
                  <span className="kpi-value ltr-num" style={k.color ? { color: k.color } : undefined}>{k.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Tabs: logs / reports ── */}
          <div className="seg">
            <button className={tab === 'logs' ? 'on' : ''} onClick={() => setTab('logs')}>{tp('logs')}</button>
            <button className={tab === 'reports' ? 'on' : ''} onClick={() => setTab('reports')}>{tp('reports')}</button>
          </div>

          {tab === 'logs' && (
            <div className="card-surface table-scroll">
              <table className="t-table">
                <thead><tr><th>{tp('description')}</th><th>{t.project}</th><th>{t.date}</th><th style={{ textAlign: 'end' }}>{tp('duration')}</th><th></th><th></th></tr></thead>
                <tbody>
                  {entries.filter(e => e.endedAt).map(e => (
                    <tr key={e._id}>
                      <td className="td-name">{e.description || e.task?.title || '—'}</td>
                      <td style={{ color: 'var(--fg-3)' }}>{e.project?.name || '—'}</td>
                      <td style={{ color: 'var(--fg-3)' }}>
                        {dstr(e.startedAt)} <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-4)' }}>{tstr(e.startedAt)}–{tstr(e.endedAt)}</span>
                      </td>
                      <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtDur(e.durationSeconds || 0)}</td>
                      <td>{e.billable ? <span className="pill pill-active"><span className="dot" />{tp('billable')}</span> : <span className="pill pill-draft"><span className="dot" />{tp('nonBillable')}</span>}</td>
                      <td style={{ textAlign: 'end' }}>
                        {canWrite && <button className="btn btn-ghost btn-sm" onClick={() => removeEntry(e._id)} style={{ color: 'var(--danger-500)' }}>×</button>}
                      </td>
                    </tr>
                  ))}
                  {!entries.filter(e => e.endedAt).length && <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--fg-4)' }}>{tp('noEntries')}</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'reports' && report && (
            <div className="dash-bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
              {[
                { title: tp('hoursPerEmployee'), rows: report.byEmployee },
                { title: tp('hoursPerProject'), rows: report.byProject },
              ].map(sec => (
                <div key={sec.title} className="card-surface">
                  <div className="card-head"><h3>{sec.title}</h3></div>
                  <div className="table-scroll">
                    <table className="t-table">
                      <thead><tr><th>{t.name}</th><th style={{ textAlign: 'end' }}>{tp('billable')}</th><th style={{ textAlign: 'end' }}>{tp('nonBillable')}</th><th style={{ textAlign: 'end' }}>{tp('totalHours')}</th></tr></thead>
                      <tbody>
                        {sec.rows.map((r: any) => (
                          <tr key={r.id}>
                            <td className="td-name">{r.name}</td>
                            <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)', color: 'var(--success-600)' }}>{fmtDur(r.billable)}</td>
                            <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)', color: 'var(--fg-4)' }}>{fmtDur(r.nonBillable)}</td>
                            <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtDur(r.total)}</td>
                          </tr>
                        ))}
                        {!sec.rows.length && <tr><td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--fg-4)' }}>{tp('noEntries')}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Manual entry modal */}
      <Modal open={manualOpen} onClose={() => setManualOpen(false)} title={tp('manualEntry')} width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div><label className="label">{tp('description')}</label><input className="input" value={manual.description || ''} onChange={e => setManual((p: any) => ({ ...p, description: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="label">{t.project}</label>
              <select className="input" value={manual.projectId || ''} onChange={e => setManual((p: any) => ({ ...p, projectId: e.target.value }))}>
                <option value="">{tp('selectProject')}</option>
                {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div><label className="label">{t.date}</label><input className="input" type="date" value={manual.date || ''} onChange={e => setManual((p: any) => ({ ...p, date: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div><label className="label">{tp('from')}</label><input className="input" type="time" value={manual.start || ''} onChange={e => setManual((p: any) => ({ ...p, start: e.target.value }))} /></div>
            <div><label className="label">{tp('to')}</label><input className="input" type="time" value={manual.end || ''} onChange={e => setManual((p: any) => ({ ...p, end: e.target.value }))} /></div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-sm)', color: 'var(--fg-2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={manual.billable !== false} onChange={e => setManual((p: any) => ({ ...p, billable: e.target.checked }))} /> {tp('billable')}
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setManualOpen(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={saveManual} disabled={saving}>{saving ? '…' : tp('addEntry')}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
