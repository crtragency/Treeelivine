'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const TYPE_ICONS: Record<string, string> = {
  mention: '💬', task_assigned: '📋', task_due: '⏰', contract_expiring: '📄',
  ticket_reply: '🎧', ticket_escalated: '🚨', project_update: '📁',
  chat_message: '💬', reminder: '🔔', vacation_request: '🌴', overload: '⚠️',
}

export default function NotificationsPage() {
  const { t, lang } = useApp()
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const isAr = lang === 'ar'

  async function fetchItems(unread = filter === 'unread') {
    setLoading(true)
    const res = await fetch(`/api/notifications${unread ? '?unread=1' : ''}`).then(r => r.json())
    if (res.success) { setItems(res.data); setHasMore(res.data.length >= 30) }
    setLoading(false)
  }
  useEffect(() => { fetchItems() }, [filter])

  async function loadMore() {
    if (!items.length) return
    setLoadingMore(true)
    const before = items[items.length - 1].createdAt
    const params = new URLSearchParams({ before })
    if (filter === 'unread') params.set('unread', '1')
    const res = await fetch(`/api/notifications?${params}`).then(r => r.json())
    if (res.success) {
      setItems(prev => [...prev, ...res.data])
      setHasMore(res.data.length >= 30)
    }
    setLoadingMore(false)
  }

  async function openItem(n: any) {
    if (!n.readAt) {
      setItems(prev => prev.map(x => x._id === n._id ? { ...x, readAt: new Date().toISOString() } : x))
      fetch(`/api/notifications/${n._id}`, { method: 'PUT' }).catch(() => {})
    }
    if (n.link) router.push(n.link)
  }

  async function markAllRead() {
    setItems(prev => prev.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() })))
    await fetch('/api/notifications', { method: 'PUT' }).catch(() => {})
  }

  async function remove(n: any) {
    setItems(prev => prev.filter(x => x._id !== n._id))
    await fetch(`/api/notifications/${n._id}`, { method: 'DELETE' }).catch(() => {})
  }

  const unreadCount = items.filter(n => !n.readAt).length

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1>{t['notif.title']}</h1>
          <p className="sub">{t['notif.subtitle']}</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-secondary" onClick={markAllRead}>{t['notif.markAllRead']}</button>
        )}
      </div>

      <div className="seg" style={{ marginBottom: '1rem' }}>
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>{t['notif.all']}</button>
        <button className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>{t['notif.unread']}</button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card-surface" style={{ overflow: 'hidden' }}>
          {items.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--fg-4)' }}>
              <p style={{ fontWeight: 500 }}>{t['notif.empty']}</p>
            </div>
          ) : items.map(n => (
            <div key={n._id} style={{
              display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
              padding: '0.85rem 1.15rem', borderBottom: '1px solid var(--border-1)',
              background: n.readAt ? 'transparent' : 'var(--bg-surface-2, var(--bg-app))',
            }}>
              <span style={{ fontSize: '1.15rem', flexShrink: 0, lineHeight: 1.4 }}>{TYPE_ICONS[n.type] || '🔔'}</span>
              <button onClick={() => openItem(n)} style={{ flex: 1, minWidth: 0, textAlign: 'start', background: 'none', border: 'none', cursor: n.link ? 'pointer' : 'default', padding: 0 }}>
                <p style={{ fontSize: '0.875rem', fontWeight: n.readAt ? 400 : 600, color: 'var(--fg-1)', marginBottom: 2 }}>{n.title}</p>
                {n.body && <p style={{ fontSize: '0.78rem', color: 'var(--fg-4)' }}>{n.body}</p>}
                <p style={{ fontSize: '0.7rem', color: 'var(--fg-5)', marginTop: 4 }}>
                  {new Date(n.createdAt).toLocaleString(isAr ? 'ar-u-ca-gregory' : 'en', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </button>
              <button className="iconbtn" title={t.delete} onClick={() => remove(n)} style={{ flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
          {items.length > 0 && hasMore && (
            <button className="btn btn-secondary" onClick={loadMore} disabled={loadingMore} style={{ margin: '0.75rem auto', display: 'block' }}>
              {loadingMore ? '…' : (t['notif.loadMore'] || 'Load more')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
