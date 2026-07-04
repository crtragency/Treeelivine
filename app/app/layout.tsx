'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import TimerBar from '@/components/ui/TimerBar'

/* ── Lucide-style SVG icons (inline, no dep needed) ─────────────────── */
function Icon({ d, size = 16 }: { d: string | string[]; size?: number }) {
  const paths = Array.isArray(d) ? d : [d]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  )
}

const Icons = {
  Dashboard: () => <Icon d={['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10']} />,
  Users:     () => <Icon d={['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', 'M23 21v-2a4 4 0 00-3-3.87', 'M16 3.13a4 4 0 010 7.75', 'M9 11a4 4 0 100-8 4 4 0 000 8z']} />,
  Folder:    () => <Icon d={['M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z']} />,
  CheckSq:   () => <Icon d={['M9 11l3 3L22 4', 'M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11']} />,
  Building:  () => <Icon d={['M3 21h18', 'M5 21V7l8-4v18', 'M19 21V11l-6-4', 'M9 9v.01M9 12v.01M9 15v.01M9 18v.01']} />,
  Wallet:    () => <Icon d={['M20 12V22H4V12', 'M22 7H2v5h20V7z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z']} />,
  File:      () => <Icon d={['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', 'M14 2v6h6', 'M16 13H8M16 17H8M10 9H8']} />,
  Settings:  () => <Icon d={['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z']} />,
  Globe:     () => <Icon d={['M12 2a10 10 0 100 20A10 10 0 0012 2z', 'M2 12h20', 'M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z']} />,
  Moon:      () => <Icon d={['M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z']} />,
  Sun:       () => <Icon d={['M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42', 'M12 17a5 5 0 100-10 5 5 0 000 10z']} />,
  Bell:      () => <Icon d={['M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 01-3.46 0']} />,
  LogOut:    () => <Icon d={['M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4', 'M16 17l5-5-5-5', 'M21 12H9']} />,
  Search:    () => <Icon d={['M11 19a8 8 0 100-16 8 8 0 000 16z', 'M21 21l-4.35-4.35']} />,
  Menu:      () => <Icon d={['M3 12h18M3 6h18M3 18h18']} />,
  Headset:   () => <Icon d={['M3 18v-6a9 9 0 0118 0v6', 'M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z', 'M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z']} />,
  Clipboard: () => <Icon d={['M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2', 'M9 2h6a1 1 0 011 1v3a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z']} />,
  Receipt:   () => <Icon d={['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z', 'M14 2v6h6M16 13H8M16 17H8M12 9H8']} />,
  TrendUp:   () => <Icon d={['M23 6l-9.5 9.5-5-5L1 18', 'M17 6h6v6']} />,
  Briefcase: () => <Icon d={['M20 7H4a2 2 0 00-2 2v11a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z', 'M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2']} />,
  Clock:     () => <Icon d={['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', 'M12 6v6l4 2']} />,
}

/* ── Brand logo image ────────────────────────────────────────────────── */
function BrandMark({ size = 24 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="Treeelivine" width={size} height={size} style={{ objectFit: 'contain' }} />
  )
}

/* ── Nav config ──────────────────────────────────────────────────────── */
const NAV_SECTIONS = [
  {
    label: { ar: 'الرئيسية', en: 'Main' },
    items: [
      { href: '/app',                  labelAr: 'اللوحة الرئيسية', labelEn: 'Dashboard',        Icon: Icons.Dashboard, perm: null,           exact: true },
      { href: '/app/projects',         labelAr: 'المشاريع',        labelEn: 'Projects',          Icon: Icons.Folder,    perm: 'projects.read' },
      { href: '/app/leads',            labelAr: 'العملاء المحتملون', labelEn: 'Leads',            Icon: Icons.TrendUp,   perm: 'leads.read' },
      { href: '/app/support-tickets',  labelAr: 'طلبات الدعم',     labelEn: 'Support Tickets',   Icon: Icons.Headset,   perm: null },
      { href: '/app/clients',          labelAr: 'العملاء',         labelEn: 'Clients',           Icon: Icons.Users,     perm: 'crm.read' },
      { href: '/app/quotations',       labelAr: 'عروض الأسعار',    labelEn: 'Quotations',        Icon: Icons.Clipboard, perm: 'finance.read' },
      { href: '/app/invoices',         labelAr: 'الفواتير',        labelEn: 'Invoices',          Icon: Icons.Receipt,   perm: 'finance.read' },
    ],
  },
  {
    label: { ar: 'الإدارة', en: 'Management' },
    items: [
      { href: '/app/financial',        labelAr: 'المالية',         labelEn: 'Financial',         Icon: Icons.TrendUp,   perm: 'finance.read' },
      { href: '/app/hr-payroll',       labelAr: 'الموارد البشرية', labelEn: 'HR & Payroll',      Icon: Icons.Briefcase, perm: 'team.read' },
      { href: '/app/team',             labelAr: 'الفريق',          labelEn: 'Team',              Icon: Icons.Building,  perm: 'team.read' },
      { href: '/app/tasks',            labelAr: 'المهام',          labelEn: 'Tasks',             Icon: Icons.CheckSq,   perm: 'tasks.read' },
      { href: '/app/time',             labelAr: 'تتبع الوقت',      labelEn: 'Time Tracking',     Icon: Icons.Clock,     perm: 'time.read' },
    ],
  },
  {
    label: { ar: 'النظام', en: 'System' },
    items: [
      { href: '/app/settings',         labelAr: 'الإعدادات',       labelEn: 'Settings',          Icon: Icons.Settings,  perm: 'settings.read' },
    ],
  },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, hasPermission, lang, setLang, theme, setTheme } = useApp()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
    if (!loading && user && user.role === 'client') router.replace('/portal')
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    )
  }

  const isAr = lang === 'ar'

  const initials = (user.name || user.email || '?')
    .split(' ')
    .map((w: string) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-app)' }}>
      {/* ── Mobile overlay ─────────────────────────────────────── */}
      <div
        className="sidebar-overlay"
        data-open={sidebarOpen}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className="sidebar" data-open={sidebarOpen}>
        {/* Brand */}
        <div className="brand">
          <span className="brand-icon"><BrandMark size={22} /></span>
          <span className="brand-name">treeelivine</span>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: 'var(--space-2) var(--space-2)', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto' }}>
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter(item => !item.perm || hasPermission(item.perm))
            if (!visibleItems.length) return null
            return (
              <div key={section.label.en}>
                <div className="nav-section">{isAr ? section.label.ar : section.label.en}</div>
                {visibleItems.map((item) => {
                  const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-item${isActive ? ' active' : ''}`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.Icon />
                      <span>{isAr ? item.labelAr : item.labelEn}</span>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* User block */}
        <div className="user-block">
          <div className="av av-md">{initials}</div>
          <div className="meta">
            <div className="name">{user.name || user.email}</div>
            <div className="role">{user.role}</div>
          </div>
          <button
            className="iconbtn"
            onClick={logout}
            title={isAr ? 'تسجيل الخروج' : 'Sign out'}
            style={{ marginInlineStart: 'auto', flexShrink: 0 }}
          >
            <Icons.LogOut />
          </button>
        </div>
      </aside>

      {/* ── Main content (offset by sidebar width) ────────────── */}
      <div className="app-main">
        {/* Topbar */}
        <header className="topbar">
          {/* Mobile: hamburger */}
          <button
            className="menu-btn"
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>

          {/* Search */}
          <div className="search-bar" style={{ flex: 1, maxWidth: 340 }}>
            <Icons.Search />
            <input placeholder={isAr ? 'ابحث في كل النظام…' : 'Search…'} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-5)' }}>⌘K</span>
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginInlineStart: 'auto' }}>
            <TimerBar />
            <button
              className="iconbtn"
              style={{ width: 'auto', padding: '0 var(--space-2)', gap: 4 }}
              onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              title="Toggle language"
            >
              <Icons.Globe />
              <span style={{ fontSize: 11, fontWeight: 500 }}>{lang === 'ar' ? 'EN' : 'AR'}</span>
            </button>
            <button
              className="iconbtn"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title="Toggle theme"
            >
              {theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
            </button>
            <button className="iconbtn" title={isAr ? 'الإشعارات' : 'Notifications'}>
              <Icons.Bell />
            </button>
            <div style={{ width: 1, height: 20, background: 'var(--border-1)', margin: '0 var(--space-1)' }} />
            <div className="av av-md" style={{ cursor: 'default' }}>{initials}</div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
