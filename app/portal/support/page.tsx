'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import TicketThread from '@/components/entity/TicketThread'

const DEPARTMENTS = ['general', 'design', 'development', 'marketing', 'finance', 'accounts']

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} onClick={() => onChange?.(i)} disabled={!onChange} style={{
          background: 'none', border: 'none', cursor: onChange ? 'pointer' : 'default',
          fontSize: '1.35rem', color: i <= value ? '#d97706' : 'var(--border-2, #d1d5db)', padding: 0,
        }}>★</button>
      ))}
    </div>
  )
}

export default function PortalSupportPage() {
  const { t, lang } = useApp()
  const isAr = lang === 'ar'
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<any>({ priority: 'medium', department: 'general' })
  const [saving, setSaving] = useState(false)
  const [openTicket, setOpenTicket] = useState<any>(null)
  const [rating, setRating] = useState(0)
  const [ratingNote, setRatingNote] = useState('')
  const [ratingBusy, setRatingBusy] = useState(false)

  async function fetchAll() {
    setLoading(true)
    const res = await fetch('/api/portal/tickets').then(r => r.json())
    if (res.success) setTickets(res.data)
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [])

  async function handleCreate() {
    setSaving(true)
    const res = await fetch('/api/portal/tickets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).then(r => r.json())
    if (res.success) { setModalOpen(false); setForm({ priority: 'medium', department: 'general' }); fetchAll() }
    else alert(res.message)
    setSaving(false)
  }

  async function submitRating() {
    if (!rating || !openTicket) return
    setRatingBusy(true)
    const res = await fetch(`/api/tickets/${openTicket._id}/satisfaction`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, note: ratingNote }),
    }).then(r => r.json())
    if (res.success) {
      setOpenTicket((p: any) => ({ ...p, satisfactionRating: rating }))
      fetchAll()
    } else alert(res.message)
    setRatingBusy(false)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--fg-1)' }}>{isAr ? 'الدعم الفني' : 'Support'}</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--fg-4)' }}>{isAr ? 'أرسل طلب دعم وتابع الرد عليه' : 'Open a support ticket and follow the conversation'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ {isAr ? 'تذكرة جديدة' : 'New ticket'}</button>
      </div>

      {loading ? <LoadingSpinner /> : tickets.length === 0 ? (
        <div className="card-surface" style={{ padding: '3rem', textAlign: 'center', color: 'var(--fg-4)' }}>
          <p style={{ fontWeight: 500 }}>{isAr ? 'لا توجد تذاكر بعد' : 'No tickets yet'}</p>
          <p style={{ fontSize: '0.8rem', marginTop: 4 }}>{isAr ? 'لو عندك مشكلة أو استفسار افتح تذكرة وهنرد عليك' : 'If you have an issue or question, open a ticket and we will reply'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {tickets.map(tk => (
            <button key={tk._id} className="card-surface" onClick={() => { setOpenTicket(tk); setRating(0); setRatingNote('') }} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
              padding: '0.9rem 1.15rem', cursor: 'pointer', textAlign: 'start', width: '100%', flexWrap: 'wrap',
            }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--fg-1)' }}>
                  <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: '0.78rem', marginInlineEnd: 8 }}>{tk.ticketNumber}</span>
                  {tk.title}
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--fg-4)', marginTop: 2 }}>
                  {new Date(tk.createdAt).toLocaleDateString(isAr ? 'ar-u-ca-gregory' : 'en')}
                  {tk.satisfactionRating ? ` · ${'★'.repeat(tk.satisfactionRating)}` : ''}
                </p>
              </div>
              <StatusBadge status={tk.status} />
            </button>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={isAr ? 'تذكرة دعم جديدة' : 'New support ticket'} width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><label className="label">{isAr ? 'الموضوع' : 'Subject'}</label><input className="input" value={form.title || ''} onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))} /></div>
          <div><label className="label">{isAr ? 'التفاصيل' : 'Details'}</label><textarea className="input" rows={4} value={form.description || ''} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="label">{isAr ? 'القسم' : 'Department'}</label>
              <select className="input" value={form.department} onChange={e => setForm((p: any) => ({ ...p, department: e.target.value }))}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{t[`dept.${d}`] || d}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{isAr ? 'الأولوية' : 'Priority'}</label>
              <select className="input" value={form.priority} onChange={e => setForm((p: any) => ({ ...p, priority: e.target.value }))}>
                {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{t[`status.${p}`] || p}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>{t.cancel || (isAr ? 'إلغاء' : 'Cancel')}</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !form.title}>{saving ? '…' : (isAr ? 'إرسال' : 'Submit')}</button>
          </div>
        </div>
      </Modal>

      {/* Thread modal */}
      <Modal open={!!openTicket} onClose={() => setOpenTicket(null)} title={openTicket ? `${openTicket.ticketNumber} — ${openTicket.title}` : ''} width={600}>
        {openTicket && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={openTicket.status} />
              {openTicket.assignee?.name && <span style={{ fontSize: '0.75rem', color: 'var(--fg-4)' }}>{isAr ? 'المسؤول:' : 'Agent:'} {openTicket.assignee.name}</span>}
            </div>
            {openTicket.description && (
              <p style={{ fontSize: '0.8rem', color: 'var(--fg-3)', background: 'var(--bg-surface-2, var(--bg-app))', borderRadius: 8, padding: '0.6rem 0.8rem' }}>{openTicket.description}</p>
            )}
            <TicketThread ticketId={openTicket._id} />
            {['resolved', 'closed'].includes(openTicket.status) && !openTicket.satisfactionRating && (
              <div style={{ borderTop: '1px solid var(--border-1)', paddingTop: '0.85rem' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6 }}>{isAr ? 'قيّم تجربتك مع الدعم' : 'Rate your support experience'}</p>
                <Stars value={rating} onChange={setRating} />
                <textarea className="input" rows={2} placeholder={isAr ? 'ملاحظات (اختياري)' : 'Notes (optional)'} value={ratingNote} onChange={e => setRatingNote(e.target.value)} style={{ marginTop: 8 }} />
                <button className="btn btn-primary" onClick={submitRating} disabled={!rating || ratingBusy} style={{ marginTop: 8 }}>
                  {ratingBusy ? '…' : (isAr ? 'إرسال التقييم' : 'Submit rating')}
                </button>
              </div>
            )}
            {openTicket.satisfactionRating > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border-1)', paddingTop: '0.85rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--fg-3)' }}>{isAr ? 'تقييمك:' : 'Your rating:'}</span>
                <Stars value={openTicket.satisfactionRating} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
