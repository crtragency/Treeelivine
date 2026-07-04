'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'

/** Compact running-timer indicator for the topbar. Links to /app/time. */
export default function TimerBar() {
  const { user, lang } = useApp()
  const isAr = lang === 'ar'
  const pathname = usePathname()
  const [timer, setTimer] = useState<any>(null)
  const [, tick] = useState(0)

  const load = useCallback(async () => {
    if (!user || user.role === 'client') return
    try {
      const res = await fetch('/api/time-entries/timer')
      const data = await res.json()
      if (data.success) setTimer(data.data)
    } catch {}
  }, [user])

  // refresh on navigation (picks up start/stop from the time page) + 60s poll
  useEffect(() => { load() }, [load, pathname])
  useEffect(() => {
    const i = setInterval(() => { tick(x => x + 1) }, 1000)
    const p = setInterval(load, 60000)
    return () => { clearInterval(i); clearInterval(p) }
  }, [load])

  async function stop(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    await fetch('/api/time-entries/timer', { method: 'PUT' })
    setTimer(null)
  }

  if (!timer) return null

  const secs = Math.max(0, Math.floor((Date.now() - new Date(timer.startedAt).getTime()) / 1000))
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60

  return (
    <Link href="/app/time" title={timer.description || timer.project?.name || ''} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: 32, padding: '0 10px',
      background: 'var(--brand-primary-soft)', border: '1px solid var(--border-1)',
      borderRadius: 'var(--radius-md)', textDecoration: 'none',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--success-500)', animation: 'pulseDot 2.5s ease-in-out infinite' }} />
      <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)', fontFeatureSettings: '"tnum"' }}>
        {h}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </span>
      <button onClick={stop} title={isAr ? 'إيقاف' : 'Stop'} style={{
        border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
        color: 'var(--danger-500)', fontSize: 11, lineHeight: 1, display: 'flex',
      }}>■</button>
    </Link>
  )
}
