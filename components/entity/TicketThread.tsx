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

  const avatarColor = (name = '') => {
    let h = 0
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
    return `hsl(${Math.abs(h) % 360} 42% 40%)`
  }
  const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('') || '؟'
  const stamp = (d: string) => new Date(d).toLocaleString(isAr ? 'ar-u-ca-gregory' : 'en', { dateStyle: 'short', timeStyle: 'short' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div className="chat-thread" style={{ maxHeight: 340, padding: '0.35rem 0.15rem 0.5rem' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--fg-4)', fontSize: '0.8rem', padding: '1rem' }}>…</p>
        ) : messages.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--fg-4)', fontSize: '0.8rem', padding: '1rem' }}>{t['ticket.noMessages']}</p>
        ) : messages.map((m, i) => {
          const mine = m.authorId === user?._id
          const newest = i === messages.length - 1
          return (
            <div key={m._id} className={`chat-msg ${mine ? 'mine' : 'theirs'}${m.pending ? ' pending' : ''}${newest ? ' newest' : ''}`}>
              {!mine && (
                <span className="chat-avatar" style={{ background: avatarColor(m.authorName) }} aria-hidden>
                  {initials(m.authorName)}
                </span>
              )}
              <div className="chat-col">
                <div className={`chat-bubble${m.internal ? ' internal' : ''}`}>
                  {(!mine || m.internal) && (
                    <p className="chat-author">
                      {m.authorName || '—'}
                      {m.internal && <span className="chat-note-tag">{t['ticket.internalNote']}</span>}
                    </p>
                  )}
                  <p className="chat-body">{m.body}</p>
                  <p className="chat-time ltr-num">{stamp(m.createdAt)}</p>
                </div>
              </div>
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
