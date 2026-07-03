'use client'
import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import PasswordInput from '@/components/ui/PasswordInput'

/* ── Brand logo ──────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function BrandMark({ size = 32, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="Treeelivine" width={size} height={size} style={{ objectFit: 'contain' }} />
  )
}

/* ── Check icon ─────────────────────────────────────────────────────── */
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

/* ── Globe icon ─────────────────────────────────────────────────────── */
function GlobeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  )
}

/* ── Moon / Sun ─────────────────────────────────────────────────────── */
function MoonIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}
function SunIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

export default function LoginPage() {
  const { login, lang, setLang, theme, setTheme } = useApp()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  const isAr = lang === 'ar'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const ok = await login(email, password)
    if (ok) {
      window.location.href = '/app'
    } else {
      setError(isAr ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials')
      setLoading(false)
    }
  }

  async function handleDemo() {
    setDemoLoading(true)
    setError('')
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        window.location.href = '/app'
      } else {
        setError(isAr ? 'تعذّر تشغيل الديمو' : 'Demo setup failed')
        setDemoLoading(false)
      }
    } catch {
      setError(isAr ? 'تعذّر تشغيل الديمو' : 'Demo setup failed')
      setDemoLoading(false)
    }
  }

  return (
    <div className="login-grid" style={{
      height: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      background: 'var(--bg-app)',
    }}>
      {/* ── Left panel: form ─────────────────────────────────── */}
      <div className="login-form-panel" style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-8) clamp(24px, 7vw, 72px)',
        justifyContent: 'center',
        background: 'var(--bg-surface)',
        borderInlineEnd: '1px solid var(--border-1)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-12)', color: 'var(--brand-primary)' }}>
          <BrandMark size={28} />
          <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--fg-1)', letterSpacing: '-0.01em' }}>
            treeelivine
          </span>
        </div>

        {/* Heading */}
        <h1 style={{ fontSize: 'var(--fs-4xl)', fontWeight: 'var(--fw-bold)', color: 'var(--fg-1)', lineHeight: 1.2, letterSpacing: '-0.01em', maxWidth: 380 }}>
          {isAr ? 'ادخل لتشغيل الوكالة.' : 'Sign in to operate the agency.'}
        </h1>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-3)', marginTop: 'var(--space-2)', maxWidth: 380, lineHeight: 1.6 }}>
          {isAr
            ? 'نظام داخلي للعملاء، المشاريع، المهام، البريف، والمالية.'
            : 'Internal system for customers, projects, tasks, briefs, and finance.'}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ marginTop: 'var(--space-8)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 380 }}>
          {error && (
            <div className="alert-error">{error}</div>
          )}

          <div className="field">
            <label className="label">{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={isAr ? 'you@company.com' : 'you@company.com'}
              required
              autoComplete="email"
            />
          </div>

          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="label">{isAr ? 'كلمة المرور' : 'Password'}</label>
              <a href="#" style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-link)', fontWeight: 'var(--fw-medium)' }}>
                {isAr ? 'نسيتها؟' : 'Forgot?'}
              </a>
            </div>
            <PasswordInput
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ height: 40, width: '100%', marginTop: 'var(--space-1)' }}>
            {loading ? (isAr ? 'جارٍ الدخول…' : 'Signing in…') : (isAr ? 'ادخل' : 'Sign in')}
          </button>

          <div style={{ height: 1, background: 'var(--border-1)', margin: 'var(--space-1) 0' }} />

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDemo}
            disabled={demoLoading}
            style={{ height: 40, width: '100%' }}
          >
            {demoLoading
              ? (isAr ? 'جارٍ إعداد الديمو…' : 'Setting up demo…')
              : (isAr ? '🚀 جرّب الديمو' : '🚀 Try Demo')}
          </button>
        </form>

        {/* Bottom bar */}
        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-6)', display: 'flex', gap: 'var(--space-2)', alignItems: 'center', color: 'var(--fg-4)', fontSize: 'var(--fs-xs)' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ gap: 4 }}
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          >
            <GlobeIcon />
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ gap: 4 }}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            {theme === 'light' ? (isAr ? 'داكن' : 'Dark') : (isAr ? 'فاتح' : 'Light')}
          </button>
          <span style={{ marginInlineStart: 'auto' }}>© {new Date().getFullYear()} treeelivine</span>
        </div>
      </div>

      {/* ── Right panel: branded olive-green ─────────────────── */}
      <div className="login-brand-panel" style={{
        background: 'var(--brand-olive-600)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        padding: 'clamp(40px, 6vw, 72px)',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Leaf motif SVG */}
        <svg
          viewBox="0 0 400 240"
          style={{ position: 'absolute', inset: 'auto -60px -60px auto', width: 480, opacity: 0.14, color: 'white' }}
          fill="currentColor"
        >
          <path d="M 40 160 C 120 40, 280 60, 360 140 C 260 130, 180 140, 120 190 C 100 180, 70 176, 40 160 Z" />
          <path d="M 60 160 C 140 100, 240 110, 340 150" fill="none" stroke="currentColor" strokeWidth="3" />
        </svg>

        {/* Top content */}
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.65, fontWeight: 500, marginBottom: 'var(--space-4)' }}>
            {isAr ? 'في يومٍ واحد' : 'In a single day'}
          </div>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 36px)', fontWeight: 700, lineHeight: 1.25, color: 'white', maxWidth: 400 }}>
            {isAr
              ? 'مهمتان جاهزتان للتسليم، فاتورة تم تحصيلها، وعميل جديد في المسار.'
              : 'Two tasks ready to hand over, an invoice collected, and a new customer in the pipeline.'}
          </h2>
        </div>

        {/* Bottom bullets */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {[
            isAr ? 'صلاحيات حقيقية حسب الدور — وليس فقط مظاهر.' : 'Real role-based scoping, not just chrome.',
            isAr ? 'لقطات مالية بالعملة الأصلية وسعر الصرف.' : 'Finance snapshots in original currency + FX.',
            isAr ? 'بوابة عميل ببريف وفواتير — بدون قنوات خارجية.' : 'Client portal with brief + invoices — no side channels.',
          ].map((text, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: 'var(--fs-sm)', opacity: 0.95 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckIcon />
              </div>
              {text}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .login-grid { grid-template-columns: 1fr !important; }
          .login-brand-panel { display: none !important; }
          .login-form-panel { padding: 2rem 1.5rem !important; justify-content: flex-start !important; padding-top: 3rem !important; overflow-y: auto; }
        }
      `}</style>
    </div>
  )
}
