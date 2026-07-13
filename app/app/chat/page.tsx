'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { playMessageSound } from '@/lib/sound'

const QUICK_EMOJI = ['👍', '❤️', '😂', '🎉', '👀', '✅']

export default function ChatPage() {
  const { t, lang, user, hasPermission } = useApp()
  const isAr = lang === 'ar'
  const canChat = hasPermission('chat.use')

  const [channels, setChannels] = useState<any[]>([])
  const [active, setActive] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingThread, setLoadingThread] = useState(false)
  const [body, setBody] = useState('')
  const [newModal, setNewModal] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [newType, setNewType] = useState<'dm' | 'team'>('dm')
  const [dmUser, setDmUser] = useState('')
  const [teamName, setTeamName] = useState('')
  const [teamMembers, setTeamMembers] = useState<string[]>([])
  const [rxTarget, setRxTarget] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<any>(null)
  activeRef.current = active
  const userRef = useRef<string | undefined>(undefined)
  userRef.current = user?._id

  const fetchChannels = useCallback(async () => {
    const res = await fetch('/api/chat/channels').then(r => r.json())
    if (res.success) setChannels(res.data)
    setLoadingChannels(false)
    return res.success ? res.data : []
  }, [])

  const fetchMessages = useCallback(async (channelId: string, markRead = true) => {
    const res = await fetch(`/api/chat/channels/${channelId}/messages`).then(r => r.json())
    if (res.success && activeRef.current?._id === channelId) {
      setMessages(prev => {
        // keep optimistic (still-sending) messages out of the comparison
        const settled = prev.filter(m => !m.pending)
        const same = settled.length === res.data.length && settled[settled.length - 1]?._id === res.data[res.data.length - 1]?._id
        if (same) return prev
        // blip when someone else's new message lands in the open thread
        const known = new Set(settled.map((m: any) => m._id))
        const incoming = res.data.some((m: any) => !known.has(m._id) && m.authorId !== userRef.current)
        if (incoming) playMessageSound()
        return [...res.data, ...prev.filter(m => m.pending)]
      })
      if (markRead) {
        fetch(`/api/chat/channels/${channelId}/read`, { method: 'PUT' }).catch(() => {})
        setChannels(prev => prev.map(c => c._id === channelId ? { ...c, unread: 0 } : c))
      }
    }
    setLoadingThread(false)
  }, [])

  useEffect(() => { if (canChat) fetchChannels() }, [canChat, fetchChannels])

  // polling: open thread every 3s, channel list every 10s — only while visible
  useEffect(() => {
    if (!canChat) return
    const iv = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (activeRef.current) fetchMessages(activeRef.current._id)
    }, 3000)
    const iv2 = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      fetchChannels()
    }, 10000)
    return () => { clearInterval(iv); clearInterval(iv2) }
  }, [canChat, fetchMessages, fetchChannels])

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'nearest' }) }, [messages.length, active?._id])

  function openChannel(ch: any) {
    setActive(ch)
    setMessages([])
    setLoadingThread(true)
    fetchMessages(ch._id)
  }

  async function send() {
    if (!body.trim() || !active) return
    const text = body
    const channelId = active._id
    // @mentions: match member names typed as @name
    const mentions = (active.members || [])
      .filter((m: any) => m.id !== user?._id && text.includes(`@${m.name}`))
      .map((m: any) => m.id)

    // optimistic: show the message instantly, reconcile with the server reply
    const temp = {
      _id: `tmp-${Date.now()}`, channelId, authorId: user?._id,
      authorName: user?.name || user?.email, body: text,
      createdAt: new Date().toISOString(), reactions: [], mentions, pending: true,
    }
    setBody('')
    setMessages(prev => [...prev, temp])
    setChannels(prev => prev.map(c => c._id === channelId
      ? { ...c, lastMessage: { body: text, authorName: temp.authorName, createdAt: temp.createdAt } } : c))

    try {
      const res = await fetch(`/api/chat/channels/${channelId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, mentions }),
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
  }

  async function toggleReaction(msgId: string, emoji: string) {
    setRxTarget(null)
    await fetch(`/api/chat/messages/${msgId}/reactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    })
    if (active) fetchMessages(active._id, false)
  }

  async function openUserDirectory() {
    setNewModal(true)
    if (!users.length) {
      const res = await fetch('/api/chat/users').then(r => r.json())
      if (res.success) setUsers(res.data)
    }
  }

  async function createChannel() {
    const payload = newType === 'dm'
      ? { type: 'dm', userId: dmUser }
      : { type: 'team', name: teamName, memberIds: teamMembers }
    const res = await fetch('/api/chat/channels', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(r => r.json())
    if (res.success) {
      setNewModal(false); setDmUser(''); setTeamName(''); setTeamMembers([])
      const list = await fetchChannels()
      const ch = list.find((c: any) => c._id === res.data._id)
      if (ch) openChannel(ch)
    } else alert(res.message)
  }

  const timeStr = (d: string) => new Date(d).toLocaleTimeString(isAr ? 'ar-u-ca-gregory' : 'en', { hour: '2-digit', minute: '2-digit' })

  // deterministic avatar tint + initials from a name
  const avatarColor = (name = '') => {
    let h = 0
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
    return `hsl(${Math.abs(h) % 360} 42% 40%)`
  }
  const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('') || '؟'

  if (!canChat) {
    return <div className="page-content"><div className="card-surface" style={{ padding: '3rem', textAlign: 'center', color: 'var(--fg-4)' }}>{t['chat.noAccess']}</div></div>
  }

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="page-head">
        <div>
          <h1>{t['chat.title']}</h1>
          <p className="sub">{t['chat.subtitle']}</p>
        </div>
        <button className="btn btn-primary" onClick={openUserDirectory}>+ {t['chat.newChat']}</button>
      </div>

      <div className="card-surface" style={{ display: 'flex', flex: 1, minHeight: 420, overflow: 'hidden' }}>
        {/* Channel list */}
        <div style={{ width: 260, minWidth: 200, borderInlineEnd: '1px solid var(--border-1)', overflowY: 'auto', flexShrink: 0 }}>
          {loadingChannels ? <LoadingSpinner /> : channels.length === 0 ? (
            <p style={{ padding: '1.5rem 1rem', fontSize: '0.8rem', color: 'var(--fg-4)', textAlign: 'center' }}>{t['chat.noChannels']}</p>
          ) : channels.map(ch => (
            <button key={ch._id} onClick={() => openChannel(ch)} style={{
              display: 'flex', flexDirection: 'column', gap: 2, width: '100%', textAlign: 'start',
              padding: '0.7rem 0.9rem', background: active?._id === ch._id ? 'var(--bg-surface-2, var(--bg-app))' : 'none',
              border: 'none', borderBottom: '1px solid var(--border-1)', cursor: 'pointer',
            }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.85rem', fontWeight: ch.unread ? 700 : 500, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ch.type === 'dm' ? '👤' : ch.type === 'project' ? '📁' : '#'} {ch.name}
                </span>
                {ch.unread > 0 && (
                  <span className="ltr-num" style={{ background: 'var(--brand-primary)', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>{ch.unread}</span>
                )}
              </span>
              {ch.lastMessage && (
                <span style={{ fontSize: '0.7rem', color: 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ch.lastMessage.authorName}: {ch.lastMessage.body || '📎'}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Thread */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {!active ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-4)', fontSize: '0.85rem' }}>
              {t['chat.pickChannel']}
            </div>
          ) : (
            <>
              <div style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--fg-1)' }}>{active.type === 'dm' ? '👤' : active.type === 'project' ? '📁' : '#'} {active.name}</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--fg-5)' }}>{(active.members || []).map((m: any) => m.name).join('، ')}</span>
              </div>

              <div className="chat-thread">
                {loadingThread ? <LoadingSpinner /> : messages.map((m, i) => {
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
                        <div className="chat-bubble" onDoubleClick={() => setRxTarget(rxTarget === m._id ? null : m._id)}>
                          {!mine && <p className="chat-author">{m.authorName}</p>}
                          <p className="chat-body">{m.body}</p>
                          <p className="chat-time ltr-num">{timeStr(m.createdAt)}</p>
                          {rxTarget === m._id && (
                            <div className="chat-emoji-pop">
                              {QUICK_EMOJI.map(e => (
                                <button key={e} onClick={() => toggleReaction(m._id, e)}>{e}</button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="chat-reacts">
                          {(m.reactions || []).map((r: any) => (
                            <button key={r.emoji} onClick={() => toggleReaction(m._id, r.emoji)}
                              className={`chat-react${r.userIds.includes(user?._id) ? ' on' : ''}`}>
                              {r.emoji} <span className="ltr-num">{r.userIds.length}</span>
                            </button>
                          ))}
                          <button className="chat-addreact" onClick={() => setRxTarget(rxTarget === m._id ? null : m._id)} aria-label="reaction">☺﹢</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {!loadingThread && messages.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--fg-4)', fontSize: '0.8rem', marginTop: '2rem' }}>{t['chat.noMessages']}</p>
                )}
                <div ref={bottomRef} />
              </div>

              <div className="chat-composer">
                <input className="input" value={body} placeholder={t['chat.writeMessage']}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
                <button className="btn btn-primary chat-send" onClick={send} disabled={!body.trim()} aria-label={t['chat.send']}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" style={{ transform: isAr ? 'scaleX(-1)' : 'none' }}>
                    <path d="M3 11.5 21 3l-8.5 18-2.2-7.3L3 11.5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New chat modal */}
      <Modal open={newModal} onClose={() => setNewModal(false)} title={t['chat.newChat']} width={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="seg">
            <button className={newType === 'dm' ? 'active' : ''} onClick={() => setNewType('dm')}>{t['chat.direct']}</button>
            <button className={newType === 'team' ? 'active' : ''} onClick={() => setNewType('team')}>{t['chat.group']}</button>
          </div>
          {newType === 'dm' ? (
            <div>
              <label className="label">{t['chat.pickUser']}</label>
              <select className="input" value={dmUser} onChange={e => setDmUser(e.target.value)}>
                <option value="">—</option>
                {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            </div>
          ) : (
            <>
              <div><label className="label">{t['chat.groupName']}</label><input className="input" value={teamName} onChange={e => setTeamName(e.target.value)} /></div>
              <div>
                <label className="label">{t['chat.members']}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-1)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
                  {users.map(u => (
                    <label key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={teamMembers.includes(u._id)}
                        onChange={e => setTeamMembers(prev => e.target.checked ? [...prev, u._id] : prev.filter(x => x !== u._id))} />
                      {u.name}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setNewModal(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={createChannel} disabled={newType === 'dm' ? !dmUser : !teamName.trim()}>{t['chat.start']}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
