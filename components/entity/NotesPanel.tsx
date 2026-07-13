'use client'
import { useState, useEffect, useCallback } from 'react'
import { useApp } from '@/contexts/AppContext'

export default function NotesPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { lang, hasPermission } = useApp()
  const isAr = lang === 'ar'
  const [notes, setNotes] = useState<any[]>([])
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/notes?entityType=${entityType}&entityId=${entityId}`)
    const data = await res.json()
    if (data.success) setNotes(data.data)
  }, [entityType, entityId])

  useEffect(() => { load() }, [load])

  async function addNote() {
    if (!body.trim()) return
    setSaving(true)
    await fetch('/api/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityId, body }),
    })
    setBody(''); setSaving(false); load()
  }

  async function togglePin(n: any) {
    await fetch(`/api/notes/${n._id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !n.pinned }),
    })
    load()
  }

  async function remove(id: string) {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    load()
  }

  const canWrite = !hasPermission || true // notes are open to all staff; API enforces

  const avatarColor = (name = '') => {
    let h = 0
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
    return `hsl(${Math.abs(h) % 360} 42% 40%)`
  }
  const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('') || '؟'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {canWrite && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            placeholder={isAr ? 'اكتب ملاحظة داخلية…' : 'Write an internal note…'}
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addNote() }}
          />
          <button className="btn btn-primary" onClick={addNote} disabled={saving}>{isAr ? 'إضافة' : 'Add'}</button>
        </div>
      )}
      {notes.length === 0 ? (
        <p style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--fg-4)', fontSize: 'var(--fs-sm)' }}>
          {isAr ? 'لا توجد ملاحظات' : 'No notes yet'}
        </p>
      ) : (
        <div className="notes-list">
          {notes.map(n => (
            <div key={n._id} className="note-item">
              <span className="chat-avatar" style={{ background: avatarColor(n.authorName) }} aria-hidden>
                {initials(n.authorName)}
              </span>
              <div className={`note-card${n.pinned ? ' pinned' : ''}`}>
                <p className="note-body">{n.body}</p>
                <div className="note-meta">
                  {n.pinned && <span className="note-pin-flag">★ {isAr ? 'مثبّتة' : 'Pinned'}</span>}
                  <span className="note-author">
                    {n.authorName || '—'} · {new Date(n.createdAt).toLocaleDateString(isAr ? 'ar-u-ca-gregory' : 'en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="note-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => togglePin(n)} title={isAr ? 'تثبيت' : 'Pin'}>
                      {n.pinned ? '★' : '☆'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => remove(n._id)} style={{ color: 'var(--danger-500)' }}>×</button>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
