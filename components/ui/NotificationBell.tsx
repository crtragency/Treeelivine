'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import { playNotificationSound } from '@/lib/sound'

const TYPE_ICONS: Record<string, string> = {
  mention: '💬', task_assigned: '📋', task_due: '⏰', contract_expiring: '📄',
  ticket_reply: '🎧', ticket_escalated: '🚨', project_update: '📁',
  chat_message: '💬', reminder: '🔔', vacation_request: '🌴', overload: '⚠️',
}

export default function NotificationBell({ allHref = '/app/notifications' }: { allHref?: string }) {
  const { t, lang } = useApp()
  const router = useRouter()
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const wrapRef = useRef<HTMLDivElement>(null)
  const prevUnread = useRef<number | null>(null)
  const isAr = lang === 'ar'

  const fetchCount = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    try {
      const res = await fetch('/api/notifications?count=1').then(r => r.json())
      if (res.success) {
        // chime when something new arrives (not on the very first load)
        if (prevUnread.current !== null && res.data.unread > prevUnread.current) {
          playNotificationSound()
        }
        prevUnread.current = res.data.unread
        setUnread(res.data.unread)
      }
    } catch { /* offline — keep last count */ }
  }, [])

  useEffect(() => {
    setSoundOn(localStorage.getItem('notifSound') !== 'off')
    fetchCount()
    const iv = setInterval(fetchCount, 8000)
    return () => clearInterval(iv)
  }, [fetchCount])

  function toggleSound() {
    const next = !soundOn
    setSoundOn(next)
    localStorage.setItem('notifSound', next ? 'on' : 'off')
    if (next) playNotificationSound() // preview + unlocks audio on this gesture
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next) {
      setLoading(true)
      try {
        const res = await fetch('/api/notifications').then(r => r.json())
        if (res.success) setItems(res.data)
      } finally { setLoading(false) }
    }
  }

  async function openItem(n: any) {
    setOpen(false)
    if (!n.readAt) {
      setUnread(u => Math.max(0, u - 1))
      if (prevUnread.current !== null) prevUnread.current = Math.max(0, prevUnread.current - 1)
      fetch(`/api/notifications/${n._id}`, { method: 'PUT' }).catch(() => {})
    }
    if (n.link) router.push(n.link)
  }

  async function markAllRead() {
    setUnread(0)
    prevUnread.current = 0
    setItems(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })))
    await fetch('/api/notifications', { method: 'PUT' }).catch(() => {})
  }

  function timeAgo(d: string) {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
    if (mins < 1) return isAr ? 'الآن' : 'now'
    if (mins < 60) return isAr ? `منذ ${mins} د` : `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return isAr ? `منذ ${hrs} س` : `${hrs}h`
    return new Date(d).toLocaleDateString(isAr ? 'ar-u-ca-gregory' : 'en', { month: 'short', day: 'numeric' })
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button className="iconbtn" title={t['notif.title'] || 'Notifications'} onClick={toggle} style={{ position: 'relative' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 4, insetInlineEnd: 4, minWidth: 14, height: 14,
            borderRadius: 999, background: 'var(--danger, #dc2626)', color: '#fff',
            fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '0 3px', lineHeight: 1,
          }} className="ltr-num">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="card-surface" style={{
          position: 'absolute', top: 'calc(100% + 8px)', insetInlineEnd: 0, width: 340,
          maxWidth: 'calc(100vw - 24px)', zIndex: 60, boxShadow: 'var(--shadow-3, 0 8px 24px rgba(0,0,0,.12))',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-1)' }}>
            <span style={{ fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t['notif.title'] || 'Notifications'}
              <button onClick={toggleSound} title={soundOn ? (t['notif.soundOff'] || 'Mute') : (t['notif.soundOn'] || 'Unmute')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1, padding: 2, opacity: soundOn ? 1 : 0.45 }}>
                {soundOn ? '🔊' : '🔇'}
              </button>
            </span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 500 }}>
                {t['notif.markAllRead'] || 'Mark all read'}
              </button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--fg-4)', fontSize: '0.8rem' }}>…</div>
            ) : items.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--fg-4)', fontSize: '0.8rem' }}>
                {t['notif.empty'] || 'No notifications yet'}
              </div>
            ) : items.map(n => (
              <button key={n._id} onClick={() => openItem(n)} style={{
                display: 'flex', gap: '0.65rem', width: '100%', textAlign: 'start',
                padding: '0.65rem 1rem', background: n.readAt ? 'transparent' : 'var(--bg-surface-2, var(--bg-app))',
                border: 'none', borderBottom: '1px solid var(--border-1)', cursor: 'pointer',
              }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{TYPE_ICONS[n.type] || '🔔'}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: n.readAt ? 400 : 600, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                  {n.body && <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</span>}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--fg-5)', flexShrink: 0 }}>{timeAgo(n.createdAt)}</span>
              </button>
            ))}
          </div>
          {allHref && <button onClick={() => { setOpen(false); router.push(allHref) }} style={{
            display: 'block', width: '100%', padding: '0.6rem', background: 'none', border: 'none',
            cursor: 'pointer', color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 500,
          }}>
            {t['notif.showAll'] || 'View all'}
          </button>}
        </div>
      )}
    </div>
  )
}
