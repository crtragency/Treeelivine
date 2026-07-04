'use client'
import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/contexts/AppContext'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ActivityTimeline from '@/components/entity/ActivityTimeline'

const STAGES = ['new', 'contacted', 'meeting_scheduled', 'proposal_sent', 'negotiation', 'won', 'lost']
const SOURCES = ['website', 'referral', 'social', 'ads', 'cold_call', 'event', 'other']

const STAGE_TINT: Record<string, string> = {
  new: 'var(--pipeline-prospect)',
  contacted: 'var(--pipeline-qualified)',
  meeting_scheduled: 'var(--pipeline-negotiation)',
  proposal_sent: 'var(--pipeline-negotiation)',
  negotiation: 'var(--pipeline-active)',
  won: 'var(--pipeline-active)',
  lost: 'var(--pipeline-lost)',
}

const IC = ({ d, size = 14 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
)

function ScoreDots({ score }: { score: number }) {
  const filled = Math.round((score || 0) / 20)
  return (
    <span style={{ display: 'inline-flex', gap: 2 }} title={`${score}/100`}>
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: 99, background: i < filled ? 'var(--brand-primary)' : 'var(--border-2)' }} />
      ))}
    </span>
  )
}

export default function LeadsPage() {
  const { t, lang, hasPermission } = useApp()
  const isAr = lang === 'ar'
  const [leads, setLeads] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)

  const canWrite = hasPermission('leads.write')

  const fetchAll = useCallback(async () => {
    const [lr, mr, er] = await Promise.all([
      fetch('/api/leads').then(r => r.json()),
      fetch('/api/leads/metrics').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
    ])
    if (lr.success) setLeads(lr.data)
    if (mr.success) setMetrics(mr.data)
    if (er.success) setEmployees(er.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  function openCreate() { setForm({ stage: 'new', source: 'other', score: 20, currency: 'SAR' }); setEditing(null); setModalOpen(true) }
  function openEdit(l: any) {
    setForm({ ...l, nextReminderAt: l.nextReminderAt ? l.nextReminderAt.substring(0, 10) : '' })
    setEditing(l); setModalOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const body = { ...form, nextReminderAt: form.nextReminderAt || null }
    const url = editing ? `/api/leads/${editing._id}` : '/api/leads'
    const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (data.success) { setModalOpen(false); fetchAll() }
    setSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/leads/${deleteTarget._id}`, { method: 'DELETE' })
    setDeleteTarget(null); setDeleting(false); fetchAll()
  }

  async function moveTo(leadId: string, stage: string) {
    // optimistic
    setLeads(prev => prev.map(l => l._id === leadId ? { ...l, stage } : l))
    const res = await fetch(`/api/leads/${leadId}/stage`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }),
    })
    const data = await res.json()
    if (!data.success) fetchAll()
    else { const mr = await fetch('/api/leads/metrics').then(r => r.json()); if (mr.success) setMetrics(mr.data) }
  }

  async function convert(l: any) {
    const res = await fetch(`/api/leads/${l._id}/convert`, { method: 'POST' })
    const data = await res.json()
    if (data.success) { setModalOpen(false); fetchAll() }
    else alert(data.message)
  }

  const fmt = (n: number) => (n || 0).toLocaleString('en-US')
  const stageLabel = (s: string) => t[`leadsPage.stage_${s}`] || s
  const srcLabel = (s: string) => t[`leadsPage.src_${s}`] || s

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1>{t['leadsPage.title'] || 'Leads'}</h1>
          <div className="sub">{t['leadsPage.subtitle']}</div>
        </div>
        <div className="actions">
          {canWrite && (
            <button className="btn btn-primary" onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <IC d="M12 5v14M5 12h14" /> {t['leadsPage.addLead']}
            </button>
          )}
        </div>
      </div>

      {/* Metrics */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {[
            { label: t['leadsPage.totalLeads'], value: fmt(metrics.totalLeads) },
            { label: t['leadsPage.conversionRate'], value: `${metrics.conversionRate}%` },
            { label: t['leadsPage.wonDeals'], value: fmt(metrics.wonDeals), color: 'var(--success-600)' },
            { label: t['leadsPage.lostDeals'], value: fmt(metrics.lostDeals), color: 'var(--danger-600)' },
            { label: t['leadsPage.pipelineValue'], value: `SAR ${fmt(metrics.pipelineValue)}` },
            { label: t['leadsPage.forecast'], value: `SAR ${fmt(metrics.forecast)}` },
          ].map(k => (
            <div key={k.label} className="kpi" style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span className="kpi-label" style={{ marginBottom: 0 }}>{k.label}</span>
              <span className="kpi-value ltr-num" style={{ fontSize: 'var(--fs-2xl)', ...(k.color ? { color: k.color } : {}) }}>{k.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Kanban board */}
      {loading ? <LoadingSpinner /> : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', alignItems: 'flex-start', paddingBottom: 8 }}>
          {STAGES.map(stage => {
            const items = leads.filter(l => l.stage === stage)
            const value = items.reduce((s, l) => s + (Number(l.expectedValue) || 0), 0)
            return (
              <div
                key={stage}
                onDragOver={e => { if (canWrite) { e.preventDefault(); setOverStage(stage) } }}
                onDragLeave={() => setOverStage(s => (s === stage ? null : s))}
                onDrop={e => {
                  e.preventDefault(); setOverStage(null)
                  const id = e.dataTransfer.getData('text/lead') || dragId
                  if (id && canWrite) moveTo(id, stage)
                }}
                style={{
                  minWidth: 230, width: 230, flexShrink: 0,
                  background: overStage === stage ? 'var(--bg-active)' : 'var(--bg-surface-2)',
                  border: `1px ${overStage === stage ? 'dashed var(--brand-primary)' : 'solid var(--border-1)'}`,
                  borderRadius: 'var(--radius-lg)', padding: 8,
                  transition: 'background var(--dur-fast)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px 8px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: STAGE_TINT[stage], border: '1px solid var(--border-2)' }} />
                  <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--fg-1)' }}>{stageLabel(stage)}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-4)', background: 'var(--bg-surface)', padding: '0 6px', borderRadius: 99 }}>{items.length}</span>
                  {value > 0 && <span className="ltr-num" style={{ marginInlineStart: 'auto', fontSize: 10.5, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>{fmt(value)}</span>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 40 }}>
                  {items.map(l => (
                    <div
                      key={l._id}
                      draggable={canWrite}
                      onDragStart={e => { setDragId(l._id); e.dataTransfer.setData('text/lead', l._id) }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => openEdit(l)}
                      className="card-surface"
                      style={{
                        padding: '10px 12px', cursor: canWrite ? 'grab' : 'pointer',
                        opacity: dragId === l._id ? 0.5 : 1,
                      }}
                    >
                      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--fg-1)', marginBottom: 2 }}>{l.name}</div>
                      {l.company && <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-4)' }}>{l.company}</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <ScoreDots score={l.score} />
                        {Number(l.expectedValue) > 0 && (
                          <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
                            {fmt(l.expectedValue)}
                          </span>
                        )}
                        {l.assignee?.name && (
                          <span className="av av-sm" title={l.assignee.name} style={{ marginInlineStart: 'auto', fontSize: 9 }}>
                            {l.assignee.name.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      {l.nextReminderAt && !['won', 'lost'].includes(l.stage) && (
                        <div style={{
                          marginTop: 6, fontSize: 10.5, fontFamily: 'var(--font-mono)',
                          color: new Date(l.nextReminderAt) < new Date() ? 'var(--danger-600)' : 'var(--fg-4)',
                        }}>
                          ⏰ {new Date(l.nextReminderAt).toLocaleDateString(isAr ? 'ar-u-ca-gregory' : 'en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div style={{ padding: '14px 8px', textAlign: 'center', fontSize: 'var(--fs-xs)', color: 'var(--fg-5)' }}>—</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t['leadsPage.editLead'] : t['leadsPage.addLead']} width={620}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div><label className="label">{t.name} *</label><input className="input" value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="label">{t.company}</label><input className="input" value={form.company || ''} onChange={e => setForm((p: any) => ({ ...p, company: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
            <div><label className="label">{t.email}</label><input className="input" value={form.email || ''} onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} /></div>
            <div><label className="label">{t.phone}</label><input className="input" value={form.phone || ''} onChange={e => setForm((p: any) => ({ ...p, phone: e.target.value }))} /></div>
            <div><label className="label">{t['crmProfile.whatsapp']}</label><input className="input" value={form.whatsapp || ''} onChange={e => setForm((p: any) => ({ ...p, whatsapp: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="label">{t.status}</label>
              <select className="input" value={form.stage || 'new'} onChange={e => setForm((p: any) => ({ ...p, stage: e.target.value }))}>
                {STAGES.map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t['leadsPage.leadSource']}</label>
              <select className="input" value={form.source || 'other'} onChange={e => setForm((p: any) => ({ ...p, source: e.target.value }))}>
                {SOURCES.map(s => <option key={s} value={s}>{srcLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t['leadsPage.assignedTo']}</label>
              <select className="input" value={form.assignedTo || ''} onChange={e => setForm((p: any) => ({ ...p, assignedTo: e.target.value }))}>
                <option value="">—</option>
                {employees.map(e2 => <option key={e2._id} value={e2._id}>{e2.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="label">{t['leadsPage.expectedValue']}</label>
              <input className="input" type="number" value={form.expectedValue ?? ''} onChange={e => setForm((p: any) => ({ ...p, expectedValue: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="label">{t['leadsPage.leadScore']} ({form.score ?? 0})</label>
              <input type="range" min={0} max={100} step={5} value={form.score ?? 0} onChange={e => setForm((p: any) => ({ ...p, score: Number(e.target.value) }))} style={{ width: '100%', accentColor: 'var(--brand-primary)', height: 34 }} />
            </div>
            <div>
              <label className="label">{t['leadsPage.nextReminder']}</label>
              <input className="input" type="date" value={form.nextReminderAt || ''} onChange={e => setForm((p: any) => ({ ...p, nextReminderAt: e.target.value }))} />
            </div>
          </div>
          {form.stage === 'lost' && (
            <div><label className="label">{t['leadsPage.lostReason']}</label><input className="input" value={form.lostReason || ''} onChange={e => setForm((p: any) => ({ ...p, lostReason: e.target.value }))} /></div>
          )}
          <div><label className="label">{t.notes}</label><textarea className="input" rows={2} value={form.notes || ''} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))} /></div>

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {editing && canWrite && !editing.customerId && (
              <button className="btn btn-secondary" onClick={() => convert(editing)} style={{ marginInlineEnd: 'auto' }}>
                ✓ {t['leadsPage.convert']}
              </button>
            )}
            {editing && editing.customerId && (
              <span className="pill pill-active" style={{ marginInlineEnd: 'auto', alignSelf: 'center' }}>{t['leadsPage.converted']}</span>
            )}
            {editing && canWrite && (
              <button className="btn btn-danger" onClick={() => { setModalOpen(false); setDeleteTarget(editing) }}>{t.delete}</button>
            )}
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t.cancel}</button>
            {canWrite && <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? '…' : t.save}</button>}
          </div>

          {editing && (
            <div style={{ borderTop: '1px solid var(--border-1)', paddingTop: 12 }}>
              <div className="label" style={{ marginBottom: 6 }}>{t['crmProfile.activity']}</div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                <ActivityTimeline entityType="lead" entityId={editing._id} />
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title={t['leadsPage.deleteLead']} message={`"${deleteTarget?.name}"?`} loading={deleting} />
    </div>
  )
}
