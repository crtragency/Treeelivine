'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

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
  const [sending, setSending] = useState(false)
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
        const same = prev.length === res.data.length && prev[prev.length - 1]?._id === res.data[res.data.length - 1]?._id
        return same ? prev : res.data
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
    if (!body.trim() || sending || !active) return
    setSending(true)
    // @mentions: match member names typed as @name
    const mentions = (active.members || [])
      .filter((m: any) => m.id !== user?._id && body.includes(`@${m.name}`))
      .map((m: any) => m.id)
    const res = await fetch(`/api/chat/channels/${active._id}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, mentions }),
    }).then(r => r.json())
    if (res.success) {
      setBody('')
      setMessages(prev => [...prev, res.data])
      fetchChannels()
    } else alert(res.message)
    setSending(false)
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

              <div style={{ flex: 1, overflowY: 'auto', padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {loadingThread ? <LoadingSpinner /> : messages.map(m => {
                  const mine = m.authorId === user?._id
                  return (
                    <div key={m._id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', position: 'relative' }}>
                      <div onDoubleClick={() => setRxTarget(rxTarget === m._id ? null : m._id)} style={{
                        background: mine ? 'var(--brand-primary)' : 'var(--bg-surface-2, var(--bg-app))',
                        color: mine ? '#fff' : 'var(--fg-1)',
                        border: mine ? 'none' : '1px solid var(--border-1)',
                        borderRadius: 12, padding: '0.5rem 0.8rem', cursor: 'default',
                      }}>
                        {!mine && <p style={{ fontSize: '0.68rem', fontWeight: 700, opacity: 0.8, marginBottom: 2 }}>{m.authorName}</p>}
                        <p style={{ fontSize: '0.84rem', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</p>
                        <p className="ltr-num" style={{ fontSize: '0.62rem', opacity: 0.6, marginTop: 3, textAlign: 'end', fontFamily: 'var(--font-mono)' }}>{timeStr(m.createdAt)}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                        {(m.reactions || []).map((r: any) => (
                          <button key={r.emoji} onClick={() => toggleReaction(m._id, r.emoji)} className="pill pill-draft" style={{ cursor: 'pointer', border: r.userIds.includes(user?._id) ? '1px solid var(--brand-primary)' : undefined }}>
                            {r.emoji} <span className="ltr-num">{r.userIds.length}</span>
                          </button>
                        ))}
                        <button onClick={() => setRxTarget(rxTarget === m._id ? null : m._id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--fg-5)', padding: '0 2px' }}>☺+</button>
                      </div>
                      {rxTarget === m._id && (
                        <div className="card-surface" style={{ position: 'absolute', zIndex: 10, display: 'flex', gap: 4, padding: '0.3rem 0.5rem', boxShadow: 'var(--shadow-md)' }}>
                          {QUICK_EMOJI.map(e => (
                            <button key={e} onClick={() => toggleReaction(m._id, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>{e}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
                {!loadingThread && messages.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--fg-4)', fontSize: '0.8rem', marginTop: '2rem' }}>{t['chat.noMessages']}</p>
                )}
                <div ref={bottomRef} />
              </div>

              <div style={{ padding: '0.7rem 1rem', borderTop: '1px solid var(--border-1)', display: 'flex', gap: 8 }}>
                <input className="input" value={body} placeholder={t['chat.writeMessage']}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                  style={{ flex: 1 }} />
                <button className="btn btn-primary" onClick={send} disabled={sending || !body.trim()}>{sending ? '…' : t['chat.send']}</button>
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
