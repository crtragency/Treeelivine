'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import NotificationBell from '@/components/ui/NotificationBell'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, t, lang, setLang } = useApp()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    if (!loading && user && user.role !== 'client') router.replace('/app')
  }, [user, loading, router])

  if (loading || !user) return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>
      <header style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-1)',
        padding: '0 clamp(1rem, 4vw, 1.5rem)',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap',
        minHeight: 56,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--brand-primary)', letterSpacing: '-0.01em' }}>treeelivine</span>
          <nav style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {[
              { href: '/portal',          label: t.dashboard  || 'Dashboard' },
              { href: '/portal/projects', label: t.projects   || 'Projects' },
              { href: '/portal/invoices', label: t.invoices   || 'Invoices' },
              { href: '/portal/quotes',    label: lang === 'ar' ? 'عروض الأسعار' : 'Quotations' },
              { href: '/portal/contracts', label: lang === 'ar' ? 'عقودي' : 'Contracts' },
              { href: '/portal/files',     label: lang === 'ar' ? 'الملفات' : 'Files' },
              { href: '/portal/support',   label: lang === 'ar' ? 'الدعم' : 'Support' },
              { href: '/portal/activity',  label: lang === 'ar' ? 'النشاط' : 'Activity' },
            ].map(item => (
              <Link key={item.href} href={item.href} style={{
                padding: '0.3rem 0.65rem',
                borderRadius: 6,
                fontSize: '0.8125rem',
                color: 'var(--fg-3)',
                textDecoration: 'none',
                transition: 'background 120ms',
              }}>{item.label}</Link>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <NotificationBell allHref="" />
          <span style={{ fontSize: '0.8125rem', color: 'var(--fg-4)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name || user.email}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'EN' : 'AR'}</button>
          <button className="btn btn-secondary btn-sm" onClick={logout}>{lang === 'ar' ? 'خروج' : 'Logout'}</button>
        </div>
      </header>
      <main style={{ padding: 'clamp(1rem, 4vw, 1.5rem)', maxWidth: 1100, margin: '0 auto' }}>{children}</main>
    </div>
  )
}
