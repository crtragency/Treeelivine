'use client'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/contexts/AppContext'

/** Ticket conversation thread — used by staff (with internal notes) and the
 *  client portal (public messages only). */
export default function TicketThread({ ticketId, staff = false }: { ticketId: string; staff?: boolean }) {
  const { t, lang, user } = useApp()
  const isAr = lang === 'ar'
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function load() {
    const res = await fetch(`/api/tickets/${ticketId}/messages`).then(r => r.json())
    if (res.success) setMessages(res.data)
    setLoading(false)
  }
  useEffect(() => { setLoading(true); load() }, [ticketId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length])

  async function send() {
    if (!body.trim() || sending) return
    const text = body
    const isInternal = staff && internal
    // optimistic: show the reply instantly, reconcile with the server row
    const temp = {
      _id: `tmp-${Date.now()}`, ticketId, authorId: user?._id,
      authorName: user?.name || user?.email, body: text,
      internal: isInternal, createdAt: new Date().toISOString(), pending: true,
    }
    setBody('')
    setSending(true)
    setMessages(prev => [...prev, temp])
    try {
      const res = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, internal: isInternal }),
      }).then(r => r.json())
      if (res.success) {
        setMessages(prev => prev.map(m => m._id === temp._id ? res.data : m))
      } else {
        setMessages(prev => prev.filter(m => m._id !== temp._id))
        setBody(text)
        alert(res.message)
      }
    } catch {
      setMessages(prev => prev.filter(m => m._id !== temp._id))
      setBody(text)
    }
    setSending(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--fg-4)', fontSize: '0.8rem', padding: '1rem' }}>…</p>
        ) : messages.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--fg-4)', fontSize: '0.8rem', padding: '1rem' }}>{t['ticket.noMessages']}</p>
        ) : messages.map(m => {
          const mine = m.authorId === user?._id
          return (
            <div key={m._id} style={{
              alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%',
              background: m.internal ? 'var(--warning-100, #fef3c7)' : mine ? 'var(--brand-primary)' : 'var(--bg-surface-2, var(--bg-app))',
              color: m.internal ? 'var(--fg-1)' : mine ? '#fff' : 'var(--fg-1)',
              borderRadius: 10, padding: '0.5rem 0.75rem',
              border: m.internal ? '1px dashed var(--warning-600, #d97706)' : '1px solid var(--border-1)',
              opacity: m.pending ? 0.6 : 1, transition: 'opacity 150ms',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 2 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.85 }}>{m.authorName || '—'}</span>
                {m.internal && <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--warning-600, #b45309)' }}>{t['ticket.internalNote']}</span>}
                <span style={{ fontSize: '0.62rem', opacity: 0.65 }}>{new Date(m.createdAt).toLocaleString(isAr ? 'ar-u-ca-gregory' : 'en', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
              <p style={{ fontSize: '0.82rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</p>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <textarea className="input" rows={2} value={body} placeholder={t['ticket.writeReply']}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send() }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          {staff ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--fg-3)', cursor: 'pointer' }}>
              <input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} />
              {t['ticket.markInternal']}
            </label>
          ) : <span />}
          <button className="btn btn-primary" onClick={send} disabled={sending || !body.trim()} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
            {sending ? '…' : t['ticket.send']}
          </button>
        </div>
      </div>
    </div>
  )
}
