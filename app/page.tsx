'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'

/* ── Brand logo ──────────────────────────────────────────────────────── */
function BrandMark({ size = 28 }: { size?: number }) {
  return <img src="/logo.png" alt="Treeelivine" width={size} height={size} style={{ objectFit: 'contain' }} />
}

/* ── Icons ───────────────────────────────────────────────────────────── */
function Ico({ d, size = 22 }: { d: string | string[]; size?: number }) {
  const paths = Array.isArray(d) ? d : [d]
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  )
}

/* ── Word-by-word animated headline (triggered by .revealed parent) ── */
function AnimatedWords({ text, baseDelay = 0 }: { text: string; baseDelay?: number }) {
  return (
    <>
      {text.split(' ').map((word, i) => (
        <span key={i} style={{ display: 'inline' }}>
          <span className="aw-wrap">
            <span className="aw-word" style={{ transitionDelay: `${baseDelay + i * 70}ms` }}>
              {word}
            </span>
          </span>
          {' '}
        </span>
      ))}
    </>
  )
}



/* ── Feature card ─────────────────────────────────────────────────────── */
const FeatureIcons: Record<string, React.ReactNode> = {
  crm:      <Ico d={['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2','M23 21v-2a4 4 0 00-3-3.87','M16 3.13a4 4 0 010 7.75','M9 11a4 4 0 100-8 4 4 0 000 8z']} />,
  pipeline: <Ico d={['M3 4h18l-7 8v6l-4 2v-8z']} />,
  projects: <Ico d={['M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z']} />,
  tasks:    <Ico d={['M9 11l3 3L22 4','M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11']} />,
  finance:  <Ico d={['M12 2v20','M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6']} />,
  quotes:   <Ico d={['M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2','M9 2h6a1 1 0 011 1v3a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z','M9 14l2 2 4-4']} />,
  contracts:<Ico d={['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z','M14 2v6h6','M8 16l2-2 1.5 1.5L15 12']} />,
  helpdesk: <Ico d={['M3 18v-6a9 9 0 0118 0v6','M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z','M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z']} />,
  chat:     <Ico d={['M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z']} />,
  resources:<Ico d={['M12 2L2 7l10 5 10-5-10-5z','M2 17l10 5 10-5','M2 12l10 5 10-5']} />,
  profit:   <Ico d={['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z','M12 12l4-4','M8 12h.01M12 8v.01M16 12h.01']} />,
  time:     <Ico d={['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z','M12 6v6l4 2']} />,
  files:    <Ico d={['M6 14l1.5-5h13L19 14a2 2 0 01-2 1.5H8A2 2 0 016 14z','M4 15V5a2 2 0 012-2h4l2 3h7a2 2 0 012 2v1']} />,
  notify:   <Ico d={['M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9','M13.73 21a2 2 0 01-3.46 0']} />,
  analytics:<Ico d={['M3 3v18h18','M18 9l-5 5-2-2-4 4']} />,
  roles:    <Ico d={['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z']} />,
}

function FeatureCard({ iconKey, title, desc }: { iconKey: string; title: string; desc: string }) {
  return (
    <div className="fade-card feature-card" style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-1)', borderRadius: 12, padding: 24,
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--brand-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)', marginBottom: 16 }}>
        {FeatureIcons[iconKey]}
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--fg-4)', lineHeight: 1.65 }}>{desc}</p>
    </div>
  )
}

/* ── Module badge ─────────────────────────────────────────────────────── */
const ModuleIcons: Record<string, React.ReactNode> = {
  dashboard: <Ico size={20} d={['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z','M9 22V12h6v10']} />,
  crm:       <Ico size={20} d={['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2','M9 11a4 4 0 100-8 4 4 0 000 8z']} />,
  projects:  <Ico size={20} d={['M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z']} />,
  tasks:     <Ico size={20} d={['M9 11l3 3L22 4','M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11']} />,
  team:      <Ico size={20} d={['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2','M23 21v-2a4 4 0 00-3-3.87','M16 3.13a4 4 0 010 7.75','M9 11a4 4 0 100-8 4 4 0 000 8z']} />,
  finance:   <Ico size={20} d={['M20 12V22H4V12','M22 7H2v5h20V7z','M12 22V7','M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z','M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z']} />,
  templates: <Ico size={20} d={['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z','M14 2v6h6','M16 13H8M16 17H8M10 9H8']} />,
  settings:  <Ico size={20} d={['M12 15a3 3 0 100-6 3 3 0 000 6z','M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z']} />,
  portal:    <Ico size={20} d={['M12 2a10 10 0 100 20A10 10 0 0012 2z','M2 12h20','M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z']} />,
  leads:     <Ico size={20} d={['M3 4h18l-7 8v6l-4 2v-8z']} />,
  quotes:    <Ico size={20} d={['M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2','M9 2h6a1 1 0 011 1v3a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z']} />,
  contracts: <Ico size={20} d={['M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z','M14 2v6h6','M8 16l2-2 1.5 1.5L15 12']} />,
  tickets:   <Ico size={20} d={['M3 18v-6a9 9 0 0118 0v6','M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z','M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z']} />,
  chat:      <Ico size={20} d={['M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z']} />,
  resources: <Ico size={20} d={['M12 2L2 7l10 5 10-5-10-5z','M2 17l10 5 10-5','M2 12l10 5 10-5']} />,
  profit:    <Ico size={20} d={['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z','M12 12l4-4']} />,
  time:      <Ico size={20} d={['M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z','M12 6v6l4 2']} />,
  files:     <Ico size={20} d={['M6 14l1.5-5h13L19 14a2 2 0 01-2 1.5H8A2 2 0 016 14z','M4 15V5a2 2 0 012-2h4l2 3h7a2 2 0 012 2v1']} />,
}

function ModuleBadge({ iconKey, name, desc }: { iconKey: string; name: string; desc: string }) {
  return (
    <div className="fade-card module-badge" style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-1)', borderRadius: 12, padding: 20,
      textAlign: 'center',
    }}>
      <div style={{ color: 'var(--brand-primary)', display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        {ModuleIcons[iconKey]}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 2 }}>{name}</div>
      <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>{desc}</div>
    </div>
  )
}

/* ── Testimonial ──────────────────────────────────────────────────────── */
function TestimonialCard({ quote, name, role, initials }: { quote: string; name: string; role: string; initials: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-1)', borderRadius: 12, padding: 24 }}>
      <div style={{ fontSize: 32, color: 'var(--brand-primary)', lineHeight: 1, marginBottom: 16, opacity: 0.4 }}>"</div>
      <p style={{ fontSize: 13, color: 'var(--fg-3)', lineHeight: 1.7, marginBottom: 20 }}>{quote}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{initials}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>{role}</div>
        </div>
      </div>
    </div>
  )
}

/* ── FAQ ──────────────────────────────────────────────────────────────── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid var(--border-1)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-surface)' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'none', border: 'none', color: 'var(--fg-1)', fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'start', fontFamily: 'inherit', gap: 16 }}
      >
        <span>{q}</span>
        <span style={{ color: 'var(--brand-primary)', fontSize: 18, fontWeight: 300, flexShrink: 0, transform: open ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}>+</span>
      </button>
      {open && <div style={{ padding: '0 20px 16px', color: 'var(--fg-3)', fontSize: 13, lineHeight: 1.7 }}>{a}</div>}
    </div>
  )
}

/* ── Animated feature mockups (pure CSS, no images) ─────────────────── */
function MockPipeline({ isAr }: { isAr: boolean }) {
  const cols = [
    { label: isAr ? 'محتمل' : 'Lead', cards: 2, tint: 'var(--brand-primary-soft)' },
    { label: isAr ? 'تفاوض' : 'Talks', cards: 1, tint: 'rgba(47,107,191,0.12)' },
    { label: isAr ? 'فوز 🎉' : 'Won 🎉', cards: 1, tint: 'rgba(47,138,62,0.12)' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, height: '100%' }}>
      {cols.map((c, ci) => (
        <div key={ci} style={{ background: 'var(--bg-app)', borderRadius: 8, padding: 8, border: '1px solid var(--border-1)' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg-3)', marginBottom: 6 }}>{c.label}</div>
          {Array.from({ length: c.cards }).map((_, i) => (
            <div key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-1)', borderRadius: 6, padding: '6px 7px', marginBottom: 6 }}>
              <div style={{ height: 5, width: '70%', borderRadius: 3, background: c.tint, marginBottom: 4 }} />
              <div style={{ height: 4, width: '45%', borderRadius: 3, background: 'var(--border-2)' }} />
            </div>
          ))}
          {ci === 2 && (
            <div className="mock-hop" style={{ background: 'var(--bg-surface)', border: '1px solid #a9bd80', borderRadius: 6, padding: '6px 7px', boxShadow: '0 4px 10px rgba(79,104,49,0.18)' }}>
              <div style={{ height: 5, width: '80%', borderRadius: 3, background: 'var(--brand-primary)', opacity: 0.55, marginBottom: 4 }} />
              <div style={{ height: 4, width: '50%', borderRadius: 3, background: 'var(--border-2)' }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function MockContract({ isAr }: { isAr: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
      <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-1)', borderRadius: 10, padding: '14px 16px', width: '75%' }}>
        {[85, 100, 92, 60].map((w, i) => (
          <div key={i} style={{ height: 4, width: `${w}%`, borderRadius: 3, background: 'var(--border-2)', marginBottom: 6 }} />
        ))}
        <svg viewBox="0 0 120 28" style={{ width: 96, height: 24, marginTop: 6 }}>
          <path className="mock-sig" d="M4 20 C 16 4, 26 26, 38 14 S 58 6, 66 16 S 88 24, 100 10 S 112 14, 116 12"
            fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <span className="pill pill-active mock-pop" style={{ fontSize: 10 }}>
        <span className="dot" /> {isAr ? 'تم توقيع العقد ✓' : 'Contract signed ✓'}
      </span>
    </div>
  )
}

function MockChat({ isAr }: { isAr: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7, height: '100%', padding: '0 6px' }}>
      <div className="mock-bub b1" style={{ alignSelf: 'flex-start', background: 'var(--bg-app)', border: '1px solid var(--border-1)', borderRadius: '10px 10px 10px 3px', padding: '6px 10px', fontSize: 10, color: 'var(--fg-2)', maxWidth: '75%' }}>
        {isAr ? 'التصميم خلص؟ 👀' : 'Design ready? 👀'}
      </div>
      <div className="mock-bub b2" style={{ alignSelf: 'flex-end', background: 'var(--brand-primary)', color: '#fff', borderRadius: '10px 10px 3px 10px', padding: '6px 10px', fontSize: 10, maxWidth: '75%' }}>
        {isAr ? 'اتبعت في الشات أهو 🚀' : 'Just sent it here 🚀'}
      </div>
      <div className="mock-bub b3" style={{ alignSelf: 'flex-end', display: 'flex', gap: 4 }}>
        <span style={{ background: 'var(--bg-app)', border: '1px solid var(--border-1)', borderRadius: 999, padding: '2px 8px', fontSize: 9 }}>👍 2</span>
        <span style={{ background: 'var(--bg-app)', border: '1px solid var(--border-1)', borderRadius: 999, padding: '2px 8px', fontSize: 9 }}>❤️ 1</span>
      </div>
    </div>
  )
}

function MockProfit({ isAr }: { isAr: boolean }) {
  const bars = [42, 68, 55, 88, 74, 96]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 76, direction: 'ltr', justifyContent: 'center' }}>
        {bars.map((h, i) => (
          <div key={i} className="mock-bar" style={{ width: 14, height: `${h}%`, borderRadius: '4px 4px 0 0', background: i % 2 ? 'var(--chart-2)' : 'var(--chart-1)', animationDelay: `${i * 120}ms`, transformOrigin: 'bottom' }} />
        ))}
      </div>
      <div style={{ textAlign: 'center' }}>
        <span className="pill pill-active" style={{ fontSize: 10 }}><span className="dot" /> {isAr ? 'هامش الربح +32%' : 'Profit margin +32%'}</span>
      </div>
    </div>
  )
}

function MockResources({ isAr }: { isAr: boolean }) {
  const rows = [
    { name: isAr ? 'كريم' : 'Karim', w: 65, cls: 'w1', color: 'var(--brand-primary)' },
    { name: isAr ? 'سارة' : 'Sara', w: 90, cls: 'w2', color: 'var(--warning-600, #d97706)' },
    { name: isAr ? 'عمر' : 'Omar', w: 100, cls: 'w3', color: 'var(--danger-600, #dc2626)', over: true },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, height: '100%', padding: '0 4px' }}>
      {rows.map((r, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--fg-3)', marginBottom: 4 }}>
            <span style={{ fontWeight: 700 }}>{r.name}</span>
            {r.over && <span style={{ color: r.color, fontWeight: 700 }}>{isAr ? '⚠ تحميل زائد' : '⚠ Overloaded'}</span>}
          </div>
          <div style={{ height: 7, borderRadius: 99, background: 'var(--bg-app)', border: '1px solid var(--border-1)', overflow: 'hidden' }}>
            <div className={`mock-fill ${r.cls}`} style={{ height: '100%', width: `${r.w}%`, borderRadius: 99, background: r.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function MockTicket({ isAr }: { isAr: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, height: '100%' }}>
      <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-1)', borderRadius: 10, padding: '10px 14px', width: '82%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent, var(--brand-primary))', fontFamily: 'var(--font-mono)' }}>TKT-0042</span>
          <span className="pill pill-pending mock-blink" style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>SLA 2h</span>
        </div>
        <div style={{ height: 5, width: '85%', borderRadius: 3, background: 'var(--border-2)', marginBottom: 5 }} />
        <div style={{ height: 4, width: '55%', borderRadius: 3, background: 'var(--border-2)' }} />
      </div>
      <div className="mock-pop" style={{ fontSize: 13, letterSpacing: 2 }}>
        <span style={{ color: '#d97706' }}>★★★★★</span> <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>5/5</span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const router = useRouter()
  const { theme, setTheme, lang, setLang } = useApp()
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [demoLoading, setDemoLoading] = useState(false)
  const [navScrolled, setNavScrolled] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 640
      setIsMobile(prev => { if (prev !== mobile) setCarouselIdx(0); return mobile })
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  /* ── All scroll effects in one useEffect ── */
  useEffect(() => {
    let ticking = false

    const updateTilt = () => {
      const el = document.getElementById('hero-dashboard')
      if (el) {
        const sy = window.scrollY
        const progress = Math.min(sy / 520, 1)
        // ease-out-cubic
        const ease = 1 - Math.pow(1 - progress, 3)
        const rotX  = 20 * (1 - ease)
        const scale  = 0.84 + 0.16 * ease
        const transY = 30 * (1 - ease)
        el.style.transform = `perspective(1400px) rotateX(${rotX}deg) translateY(${transY}px) scale(${scale})`
      }
      ticking = false
    }

    const onScroll = () => {
      setNavScrolled(window.scrollY > 40)
      if (!ticking) {
        requestAnimationFrame(updateTilt)
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    updateTilt()

    /* IntersectionObserver for section reveals */
    const io = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('revealed') }),
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' }
    )
    document.querySelectorAll('.reveal-section').forEach(el => io.observe(el))

    /* Stagger .fade-card children within revealed parents */
    const io2 = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          const cards = e.target.querySelectorAll('.fade-card')
          cards.forEach((card, i) => {
            setTimeout(() => card.classList.add('card-visible'), i * 80)
          })
        }
      }),
      { threshold: 0.1 }
    )
    document.querySelectorAll('.cards-container').forEach(el => io2.observe(el))

    return () => {
      window.removeEventListener('scroll', onScroll)
      io.disconnect()
      io2.disconnect()
    }
  }, [])

  async function handleDemo() {
    setDemoLoading(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        window.location.href = '/app'
      } else {
        alert(lp.demoFailMsg)
        setDemoLoading(false)
      }
    } catch {
      alert(lp.demoFailMsg)
      setDemoLoading(false)
    }
  }

  const isDark = theme === 'dark'
  const isAr = lang === 'ar'

  /* ── All landing-page text in both languages ── */
  const lp = {
    dir: isAr ? 'rtl' : 'ltr',
    // Nav
    navFeatures:  isAr ? 'المميزات'   : 'Features',
    navModules:   isAr ? 'الوحدات'    : 'Modules',
    navPricing:   isAr ? 'الأسعار'    : 'Pricing',
    navLogin:     isAr ? 'دخول'       : 'Sign In',
    navRegister:  '',
    navDemo:      isAr ? 'جرّب الديمو' : 'Try Demo',
    // Hero
    trustBadge:   isAr ? 'موثوق من مئات الوكالات' : 'Trusted by hundreds of agencies',
    heroLine1:    isAr ? ['شغّل','شركتك','بالكامل'] : ['Run','Your','Business'],
    heroLine2:    isAr ? ['من','منصة','ERP','واحدة'] : ['From','One','ERP','Platform'],
    heroSub:      isAr
      ? 'إدارة العملاء، المشاريع، المهام، الفواتير، والمالية — كل شيء في لوحة تحكم واحدة مصممة لوكالات التسويق.'
      : 'Manage clients, projects, tasks, invoices, and finances — everything in one dashboard built for marketing agencies.',
    heroCta1:     isAr ? 'جرّب الديمو مجاناً' : 'Try Demo for Free',
    heroCta2:     isAr ? 'إنشاء حساب'         : 'Create Account',
    heroNote:     isAr ? 'بدون بطاقة ائتمانية · بدون تسجيل' : 'No credit card · No registration required',
    heroLoading:  isAr ? 'جاري الفتح...' : 'Opening...',
    // Stats
    stats: [
      { value: '16',      label: isAr ? 'وحدة متكاملة'     : 'Integrated Modules' },
      { value: '60+',     label: isAr ? 'ميزة جاهزة'       : 'Ready Features' },
      { value: '99%',     label: isAr ? 'نسبة التشغيل'     : 'Uptime' },
      { value: '24/7',    label: isAr ? 'وصول بلا انقطاع' : 'Always Available' },
    ],
    // Features section
    featuresLabel: isAr ? 'المميزات' : 'Features',
    featuresH2:    isAr ? 'كل ما تحتاجه لإدارة شركتك' : 'Everything You Need to Manage Your Business',
    featuresSub:   isAr ? 'منصة متكاملة تجمع كل أدوات إدارة الأعمال في مكان واحد' : 'An integrated platform bringing all business management tools together',
    features: [
      { iconKey: 'crm',       title: isAr ? 'إدارة العملاء CRM'   : 'CRM Management',      desc: isAr ? 'تتبّع كل عميل من أول تواصل حتى إغلاق الصفقة، مع إدارة كاملة للحالة والأولوية والمسؤول.'  : 'Track every client from first contact to closed deal, with full control over status, priority, and assignee.' },
      { iconKey: 'projects',  title: isAr ? 'إدارة المشاريع'       : 'Project Management',  desc: isAr ? 'أسند المشاريع، تابع التقدم، وشارك البريف مع العملاء مباشرةً من منصة واحدة.'              : 'Assign projects, track progress, and share briefs with clients directly from one platform.' },
      { iconKey: 'tasks',     title: isAr ? 'المهام والتسليمات'    : 'Tasks & Deliverables', desc: isAr ? 'نظام مهام مرن يربط الفريق بالمشاريع والعملاء، مع تتبع التقدم والمواعيد النهائية.'         : 'A flexible task system connecting your team to projects and clients, with progress and deadline tracking.' },
      { iconKey: 'finance',   title: isAr ? 'الفواتير والمالية'    : 'Invoices & Finance',  desc: isAr ? 'أنشئ فواتير احترافية، تتبّع المدفوعات، وراقب المصروفات والأرباح في لوحة مالية موحدة.'   : 'Create professional invoices, track payments, and monitor expenses and profits in a unified finance dashboard.' },
      { iconKey: 'analytics', title: isAr ? 'تقارير وتحليلات'      : 'Reports & Analytics', desc: isAr ? 'لوحة مؤشرات حية توضح الإيرادات والأرباح والأداء — بأرقام حقيقية وفي الوقت الفعلي.'       : 'A live KPI dashboard showing revenues, profits, and performance — in real numbers and real time.' },
      { iconKey: 'roles',     title: isAr ? 'صلاحيات وأدوار'       : 'Roles & Permissions', desc: isAr ? 'تحكّم في وصول كل مستخدم بدقة — أدمن، مدير، فريق، عميل — مع صلاحيات تفصيلية لكل وحدة.' : 'Fine-grained user access control — admin, manager, team, client — with per-module permission settings.' },
      { iconKey: 'pipeline',  title: isAr ? 'قمع مبيعات Kanban'    : 'Sales Pipeline',      desc: isAr ? 'اسحب العملاء المحتملين بين المراحل، تابع نسب التحويل، وحوّل الفرصة لعميل ومشروع بضغطة.'   : 'Drag leads between stages, track conversion rates, and turn an opportunity into a client and project in one click.' },
      { iconKey: 'quotes',    title: isAr ? 'عروض أسعار بروابط عامة' : 'Shareable Quotations', desc: isAr ? 'أنشئ عرض السعر وابعت للعميل لينك يفتحه بدون حساب — يشوف ويوافق أو يرفض فورًا.'          : 'Build a quote and send the client a public link — they view and accept or decline instantly, no account needed.' },
      { iconKey: 'contracts', title: isAr ? 'عقود وتوقيع إلكتروني' : 'Contracts & E-Sign',  desc: isAr ? 'قوالب عقود، تجديد تلقائي، تنبيه قبل الانتهاء، ولينك توقيع إلكتروني يوقّع منه العميل.'    : 'Contract templates, auto-renewal, expiry alerts, and an e-signature link your client signs from directly.' },
      { iconKey: 'helpdesk',  title: isAr ? 'دعم فني بـ SLA وتقييم' : 'Help Desk with SLA',  desc: isAr ? 'تذاكر بمحادثة كاملة وملاحظات داخلية، عدّاد SLA، تصعيد، وتقييم رضا العميل بالنجوم.'       : 'Ticket threads with internal notes, SLA countdowns, escalation, and star-rated client satisfaction.' },
      { iconKey: 'chat',      title: isAr ? 'شات داخلي للفريق'     : 'Team Chat',           desc: isAr ? 'رسائل مباشرة وجروبات بتفاعلات إيموجي وإشارات @ — بسرعة لحظية وصوت إشعارات.'              : 'DMs and group channels with emoji reactions and @mentions — instant sending with notification sounds.' },
      { iconKey: 'resources', title: isAr ? 'تخطيط الموارد'         : 'Resource Planning',   desc: isAr ? 'وزّع الفريق على المشاريع بالنِسَب، اكتشف التحميل الزائد تلقائيًا، وأدر الإجازات بموافقات.' : 'Allocate the team across projects by percentage, auto-detect overload, and manage vacations with approvals.' },
      { iconKey: 'profit',    title: isAr ? 'ربحية المشاريع'        : 'Project Profitability', desc: isAr ? 'الإيراد مقابل التكلفة الفعلية (مصروفات + ساعات عمل) لكل مشروع وعميل مع توقعات الشهر القادم.' : 'Revenue vs real cost (expenses + labor hours) per project and client, with next-month forecasting.' },
      { iconKey: 'time',      title: isAr ? 'تتبع الوقت بتايمر'     : 'Time Tracking',       desc: isAr ? 'تايمر مباشر من أي صفحة، سجلات ساعات لكل مشروع ومهمة، وتقارير أسبوعية للفريق.'             : 'A live timer from any page, hour logs per project and task, and weekly team reports.' },
      { iconKey: 'files',     title: isAr ? 'مكتبة ملفات بإصدارات'  : 'File Library',        desc: isAr ? 'مجلدات لكل عميل ومشروع، وسوم للبحث، وإصدارات v1 وv2 لكل ملف بتاريخ كامل.'                : 'Folders per client and project, searchable tags, and v1/v2 file versioning with full history.' },
      { iconKey: 'notify',    title: isAr ? 'إشعارات ذكية بصوت'     : 'Smart Notifications', desc: isAr ? 'جرس موحّد لكل شيء: ردود التذاكر، العقود اللي بتقرب تخلص، طلبات الإجازة — بنغمة لطيفة.'  : 'One bell for everything: ticket replies, expiring contracts, vacation requests — with a gentle chime.' },
    ],
    // Modules section
    modulesLabel: isAr ? 'الوحدات' : 'Modules',
    modulesH2:    isAr ? 'نظام متكامل من 16 وحدة' : 'An Integrated System of 16 Modules',
    modulesSub:   isAr ? 'كل وحدة مصممة لتحل مشكلة محددة وتتكامل مع باقي الوحدات' : 'Each module designed to solve a specific problem and integrate seamlessly with the rest',
    modules: [
      { iconKey: 'dashboard', name: 'Dashboard',     desc: isAr ? 'لوحة التحكم'      : 'Control Panel' },
      { iconKey: 'crm',       name: 'CRM',           desc: isAr ? 'إدارة العملاء'    : 'Client Management' },
      { iconKey: 'leads',     name: 'Leads',         desc: isAr ? 'قمع المبيعات'     : 'Sales Pipeline' },
      { iconKey: 'projects',  name: 'Projects',      desc: isAr ? 'المشاريع والبريف'  : 'Projects & Briefs' },
      { iconKey: 'tasks',     name: 'Tasks',         desc: isAr ? 'المهام والتسليم'   : 'Tasks & Handover' },
      { iconKey: 'time',      name: 'Time',          desc: isAr ? 'تتبع الوقت'       : 'Time Tracking' },
      { iconKey: 'quotes',    name: 'Quotations',    desc: isAr ? 'عروض الأسعار'     : 'Quotations' },
      { iconKey: 'contracts', name: 'Contracts',     desc: isAr ? 'العقود والتوقيع'   : 'Contracts & E-Sign' },
      { iconKey: 'finance',   name: 'Finance',       desc: isAr ? 'الفواتير والمالية' : 'Invoices & Finance' },
      { iconKey: 'profit',    name: 'Profitability', desc: isAr ? 'الربحية'          : 'Profitability' },
      { iconKey: 'tickets',   name: 'Help Desk',     desc: isAr ? 'الدعم الفني SLA'  : 'Support & SLA' },
      { iconKey: 'chat',      name: 'Chat',          desc: isAr ? 'شات الفريق'       : 'Team Chat' },
      { iconKey: 'resources', name: 'Resources',     desc: isAr ? 'تخطيط الموارد'    : 'Resource Planning' },
      { iconKey: 'files',     name: 'Files',         desc: isAr ? 'مكتبة الملفات'    : 'File Library' },
      { iconKey: 'team',      name: 'Team & HR',     desc: isAr ? 'الفريق والرواتب'   : 'Team & Payroll' },
      { iconKey: 'portal',    name: 'Client Portal', desc: isAr ? 'بوابة العميل'     : 'Client Portal' },
    ],
    // Showcase (new features, animated mockups)
    showcaseLabel: isAr ? '✨ الجديد في المنصة' : '✨ What\'s New',
    showcaseH2:    isAr ? 'فيتشرز جديدة بالكامل — شوفها شغالة' : 'Brand-New Features — See Them in Action',
    showcaseSub:   isAr ? 'من قمع المبيعات للتوقيع الإلكتروني للشات — كل ده اتضاف في آخر تحديثات' : 'From sales pipeline to e-signatures to team chat — all added in the latest updates',
    showcase: [
      { key: 'pipeline',  title: isAr ? 'قمع مبيعات بالسحب والإفلات' : 'Drag-and-Drop Pipeline',  desc: isAr ? 'حرّك الفرص بين المراحل وتابع نسبة التحويل لحظيًا' : 'Move deals between stages and watch conversion live' },
      { key: 'contract',  title: isAr ? 'توقيع إلكتروني للعقود'       : 'Contract E-Signatures',   desc: isAr ? 'العميل يوقّع من لينك — بدون طباعة ولا سكانر'      : 'Clients sign from a link — no printing, no scanning' },
      { key: 'chat',      title: isAr ? 'شات فريق لحظي'               : 'Instant Team Chat',       desc: isAr ? 'رسائل وتفاعلات وإشارات — بصوت إشعارات لطيف'        : 'Messages, reactions and mentions — with a gentle chime' },
      { key: 'profit',    title: isAr ? 'ربحية كل مشروع'              : 'Per-Project Profitability', desc: isAr ? 'الإيراد مقابل التكلفة الفعلية بساعات الشغل'     : 'Revenue vs true cost including labor hours' },
      { key: 'resources', title: isAr ? 'أحمال الفريق والإجازات'      : 'Workload & Vacations',    desc: isAr ? 'اكتشف التحميل الزائد قبل ما يحصل'                  : 'Catch overload before it happens' },
      { key: 'ticket',    title: isAr ? 'دعم فني بـ SLA وتقييم'       : 'Help Desk, SLA & CSAT',   desc: isAr ? 'عدّاد التزام ورضا عملاء بالنجوم'                   : 'SLA countdowns and star-rated satisfaction' },
    ],
    // Demo CTA section
    demoLabel:        isAr ? '⚡ جرّب الآن'                              : '⚡ Try Now',
    demoH2:           isAr ? 'جرّب Treeelivine ERP بدون إنشاء حساب'    : 'Try Treeelivine ERP Without an Account',
    demoDesc:         isAr ? 'بيانات تجريبية كاملة — عملاء، مشاريع، مهام، وفواتير — جاهزة فوراً.' : 'Full demo data — clients, projects, tasks, and invoices — ready instantly.',
    demoCta1:         isAr ? 'ابدأ الديمو الآن'    : 'Start Demo Now',
    demoCta2:         isAr ? 'إنشاء حساب'          : 'Create Account',
    demoCredsTitle:   isAr ? 'بيانات الدخول التجريبية' : 'Demo Login Credentials',
    demoEmailLbl:     isAr ? 'البريد'              : 'Email',
    demoPassLbl:      isAr ? 'كلمة المرور'         : 'Password',
    demoRoleLbl:      isAr ? 'الدور'               : 'Role',
    demoRoleVal:      isAr ? 'Admin — صلاحيات كاملة' : 'Admin — Full Access',
    demoOpenBtn:      isAr ? 'افتح الديمو ←'       : 'Open Demo →',
    demoLoadingTxt:   isAr ? 'جاري فتح الديمو...'  : 'Opening demo...',
    // Testimonials
    testimonialsLabel: isAr ? 'آراء العملاء'       : 'Reviews',
    testimonialsH2:    isAr ? 'ماذا يقول مستخدمونا' : 'What Our Users Say',
    testimonials: [
      { quote: isAr ? 'Treeelivine غيّر طريقة إدارتنا للفريق. الآن كل شيء في مكان واحد ولا يفوتنا شيء.'       : 'Treeelivine changed how we manage our team. Everything is now in one place and nothing slips through.',        name: isAr ? 'أحمد الزهراني' : 'Ahmed Al-Zahrani', role: isAr ? 'مدير وكالة تسويق'       : 'Marketing Agency Manager',    initials: 'AZ' },
      { quote: isAr ? 'بوابة العميل رائعة! يقدر عملاؤنا يتابعون مشاريعهم ويوافقون على البريف مباشرةً.'         : 'The client portal is amazing! Our clients can follow their projects and approve briefs directly.',             name: isAr ? 'سارة العمري'   : 'Sara Al-Omari',    role: isAr ? 'CEO — إبداع الرقمي'      : 'CEO — Digital Ibda',          initials: 'SO' },
      { quote: isAr ? 'الفواتير والمصروفات أصبحت سهلة جداً. وفّرنا ساعات من العمل اليدوي كل أسبوع.'           : 'Invoices and expenses became so easy. We save hours of manual work every week.',                             name: isAr ? 'فهد المطيري'   : 'Fahad Al-Mutairi', role: isAr ? 'مدير مالي'               : 'Finance Manager',             initials: 'FM' },
      { quote: isAr ? 'إدارة المشاريع والمهام صارت أوضح بكثير. كل فرد في الفريق يعرف مهامه بالضبط.'            : 'Project and task management became much clearer. Every team member knows exactly what to do.',               name: isAr ? 'نورة الشمري'   : 'Noura Al-Shamri',  role: isAr ? 'مديرة مشاريع'            : 'Project Manager',             initials: 'NS' },
      { quote: isAr ? 'النظام سهّل علينا متابعة العملاء من أول تواصل لحين إغلاق الصفقة. ممتاز جداً.'           : 'The system simplified following up with clients from first contact to closing the deal. Excellent.',          name: isAr ? 'خالد العتيبي'  : 'Khalid Al-Otaibi', role: isAr ? 'مدير مبيعات'             : 'Sales Manager',               initials: 'KO' },
      { quote: isAr ? 'التقارير المالية الآن تُنجز في دقائق بدلاً من ساعات. ربحنا وقتاً ثميناً جداً.'          : 'Financial reports now take minutes instead of hours. We gained very valuable time.',                         name: isAr ? 'ريم الحارثي'   : 'Reem Al-Harthi',   role: isAr ? 'CFO — نور ميديا'         : 'CFO — Noor Media',            initials: 'RH' },
      { quote: isAr ? 'صلاحيات الأدوار دقيقة جداً. كل موظف يرى فقط ما يخصه وهذا يحسّن الإنتاجية.'            : 'Role permissions are very precise. Each employee sees only what concerns them, improving productivity.',       name: isAr ? 'طارق السبيعي'  : 'Tariq Al-Subai',   role: isAr ? 'CTO — سحاب تك'          : 'CTO — Sahab Tech',            initials: 'TS' },
      { quote: isAr ? 'بريف المشاريع ووثائق العميل كلها في مكان واحد. لا مزيد من البريد والواتساب.'             : 'Project briefs and client documents are all in one place. No more email and WhatsApp chains.',                name: isAr ? 'منى القحطاني'  : 'Mona Al-Qahtani',  role: isAr ? 'مديرة محتوى'             : 'Content Manager',             initials: 'MQ' },
      { quote: isAr ? 'الديمو كان كافياً لأقرر الاشتراك فوراً. النظام واضح وسريع ومُصمَّم للعرب.'              : 'The demo was enough to decide immediately. The system is clear, fast, and built for Arab businesses.',         name: isAr ? 'عمر الدوسري'   : 'Omar Al-Dosari',   role: isAr ? 'صاحب وكالة إبداعية'      : 'Creative Agency Owner',       initials: 'OD' },
    ],
    // FAQ
    faqLabel: isAr ? 'FAQ' : 'FAQ',
    faqH2:    isAr ? 'أجوبة على أكثر الأسئلة شيوعاً' : 'Answers to the Most Common Questions',
    faqs: [
      { q: isAr ? 'هل يمكن تجربة النظام قبل إنشاء حساب؟'  : 'Can I try the system before creating an account?',    a: isAr ? 'نعم! اضغط على "جرّب الديمو" وسيتم إنشاء بيانات تجريبية كاملة وتسجيل دخولك تلقائياً بدون أي خطوات إضافية.' : 'Yes! Click "Try Demo" and full demo data will be created and you\'ll be logged in automatically with no extra steps.' },
      { q: isAr ? 'هل يعمل النظام على الموبايل؟'            : 'Does the system work on mobile?',                    a: isAr ? 'نعم، النظام مصمم بشكل متجاوب يعمل على جميع الأجهزة — سطح المكتب والتابلت والموبايل.'  : 'Yes, the system is responsively designed and works on all devices — desktop, tablet, and mobile.' },
      { q: isAr ? 'ما الوحدات المتوفرة في النظام؟'          : 'What modules are available?',                        a: isAr ? 'يضم النظام 16 وحدة: لوحة تحكم، CRM، قمع مبيعات، مشاريع، مهام، تتبع وقت، عروض أسعار، عقود بتوقيع إلكتروني، فواتير ومالية، ربحية، دعم فني بـ SLA، شات فريق، تخطيط موارد، مكتبة ملفات، فريق ورواتب، وبوابة عميل.' : 'The system includes 16 modules: Dashboard, CRM, Sales Pipeline, Projects, Tasks, Time Tracking, Quotations, Contracts with E-Sign, Invoices & Finance, Profitability, Help Desk with SLA, Team Chat, Resource Planning, File Library, Team & Payroll, and Client Portal.' },
      { q: isAr ? 'هل يوجد بوابة للعميل؟'                   : 'Is there a client portal?',                          a: isAr ? 'نعم! يمكن لعملائك الوصول لبوابة خاصة لمتابعة المشاريع، والموافقة على البريف، وعرض الفواتير.' : 'Yes! Your clients can access a private portal to follow projects, approve briefs, and view invoices.' },
      { q: isAr ? 'هل النظام مصمم للعربية؟'                 : 'Is the system designed for Arabic?',                 a: isAr ? 'نعم، النظام عربي-أول مع دعم كامل للغة الإنجليزية، مع تصميم RTL أصيل وليس مجرد ترجمة.' : 'Yes, the system is Arabic-first with full English support, featuring genuine RTL design — not just a translation.' },
    ],
    // Final CTA
    finalLabel: isAr ? 'ابدأ الآن'                             : 'Get Started',
    finalH2:    isAr ? 'جاهز لإدارة شركتك بذكاء؟'             : 'Ready to Manage Your Business Smartly?',
    finalDesc:  isAr ? 'انضم إلى مئات الشركات التي تستخدم Treeelivine ERP لتبسيط عملياتها.' : 'Join hundreds of companies using Treeelivine ERP to streamline their operations.',
    finalCta1:  isAr ? 'جرّب الديمو'   : 'Try Demo',
    finalCta2:  isAr ? 'إنشاء حساب'    : 'Create Account',
    // Footer
    footerDesc:     isAr ? 'منصة ERP متكاملة لإدارة وكالات التسويق والشركات الخدمية.' : 'An integrated ERP platform for marketing agencies and service companies.',
    footerProduct:  isAr ? 'المنتج'  : 'Product',
    footerAccount:  isAr ? 'الحساب' : 'Account',
    footerSupport:  isAr ? 'الدعم'  : 'Support',
    footerLogin:    isAr ? 'تسجيل الدخول' : 'Sign In',
    footerRegister: isAr ? 'إنشاء حساب'   : 'Create Account',
    footerDemo:     isAr ? 'الديمو'        : 'Demo',
    footerPrivacy:  isAr ? 'سياسة الخصوصية'  : 'Privacy Policy',
    footerTerms:    isAr ? 'الشروط والأحكام' : 'Terms & Conditions',
    footerSupport2: isAr ? 'الدعم الفني'     : 'Support',
    copyright:      isAr ? `© ${new Date().getFullYear()} treeelivine ERP. جميع الحقوق محفوظة.` : `© ${new Date().getFullYear()} treeelivine ERP. All rights reserved.`,
    demoFailMsg:    isAr ? 'تعذّر تشغيل الديمو. تأكد من اتصال قاعدة البيانات.' : 'Demo failed. Please check your database connection.',
  }
  const L = {
    bg: 'var(--bg-app)',
    surface: 'var(--bg-surface)',
    border: 'var(--border-1)',
    border2: 'var(--border-2)',
    fg1: 'var(--fg-1)',
    fg2: 'var(--fg-2)',
    fg3: 'var(--fg-3)',
    fg4: 'var(--fg-4)',
    fg5: 'var(--fg-5)',
    olive: 'var(--brand-primary)',
    oliveL: 'var(--brand-primary-soft)',
    olive2: 'var(--brand-olive-100)',
    navBg: isDark ? 'rgba(20,20,15,0.92)' : 'rgba(255,255,255,0.92)',
  }

  return (
    <div style={{ background: 'var(--bg-app)', color: 'var(--fg-2)', minHeight: '100vh', direction: lp.dir as 'rtl'|'ltr', overflowX: 'hidden' }}>

      {/* ═══════════════════ GLOBAL STYLES ═══════════════════ */}
      <style>{`
        html { scroll-behavior: smooth; }

        /* ── Nav ── */
        .ln-link { color: ${L.fg4}; font-size:14px; padding:6px 12px; border-radius:8px; text-decoration:none; transition:color 0.15s; }
        .ln-link:hover { color:${L.fg1}; text-decoration:none; }

        /* ── Buttons ── */
        .btn-primary {
          display:inline-flex; align-items:center; gap:6px;
          padding:13px 26px; background:${L.olive}; color:#fff;
          border-radius:10px; font-size:15px; font-weight:600;
          border:none; cursor:pointer; font-family:inherit; text-decoration:none;
          transition:background 0.15s, box-shadow 0.15s, transform 0.12s;
        }
        .btn-primary:hover { background:#3d5128; box-shadow:0 6px 20px rgba(79,104,49,0.32); color:#fff; text-decoration:none; transform:translateY(-1px); }
        .btn-primary:active { transform:translateY(0); }
        .btn-secondary {
          display:inline-flex; align-items:center; gap:6px;
          padding:13px 24px; background:${L.surface}; color:${L.fg1};
          border-radius:10px; font-size:15px; font-weight:500;
          border:1px solid ${L.border}; cursor:pointer; font-family:inherit; text-decoration:none;
          transition:background 0.15s, transform 0.12s;
        }
        .btn-secondary:hover { background:${L.bg}; text-decoration:none; color:${L.fg1}; transform:translateY(-1px); }
        .btn-sm { padding:7px 16px !important; font-size:13px !important; border-radius:8px !important; }

        /* ── Word-by-word reveal (scroll triggered) ── */
        .aw-wrap {
          display:inline-block; overflow:hidden;
          vertical-align:bottom;
          margin-inline-end:0.22em;
        }
        .aw-word {
          display:inline-block;
          transform:translateX(50px);
          opacity:0;
          transition:transform 0.6s cubic-bezier(0.22,0.61,0.36,1),
                      opacity 0.5s ease;
        }
        .reveal-section.revealed .aw-word { transform:translateX(0); opacity:1; }

        /* ── Hero headline (immediate on load) ── */
        @keyframes wordIn {
          from { transform:translateX(44px); opacity:0; }
          to   { transform:translateX(0);    opacity:1; }
        }
        .hero-word {
          display:inline-block;
          margin-inline-end:0.24em;
          animation: wordIn 0.65s cubic-bezier(0.22,0.61,0.36,1) both;
        }

        /* ── Fade-up cards ── */
        .fade-card {
          opacity:0; transform:translateY(28px);
          transition:opacity 0.55s ease, transform 0.55s cubic-bezier(0.22,0.61,0.36,1);
        }
        .fade-card.card-visible { opacity:1; transform:translateY(0); }

        /* ── Dashboard tilt container ── */
        #hero-dashboard {
          transform-origin:center bottom;
          will-change:transform;
        }

        /* ── Feature card hover ── */
        .feature-card { transition:box-shadow 0.18s ease, border-color 0.18s ease, opacity 0.55s ease, transform 0.55s cubic-bezier(0.22,0.61,0.36,1) !important; }
        .feature-card:hover { box-shadow:0 6px 20px rgba(23,22,19,0.08); border-color:#c9d6ac !important; }

        /* ── Module badge hover ── */
        .module-badge { transition:border-color 0.18s ease, transform 0.18s ease, opacity 0.55s ease, transform 0.55s cubic-bezier(0.22,0.61,0.36,1) !important; }
        .module-badge:hover { border-color:#a9bd80 !important; transform:translateY(-3px); }

        /* ── Floating hero satellite cards ── */
        @keyframes satFloat {
          0%,100% { transform:translateY(0) rotate(-0.5deg); }
          50%     { transform:translateY(-12px) rotate(0.5deg); }
        }
        .hero-sat { animation:satFloat 5.2s ease-in-out infinite; will-change:transform; }
        .sat-1 { animation-delay:0s; }
        .sat-2 { animation-delay:1.3s; animation-duration:6s; }
        .sat-3 { animation-delay:0.7s; animation-duration:5.6s; }
        .sat-4 { animation-delay:2s;   animation-duration:6.4s; }

        /* ── Gradient orbs ── */
        @keyframes orbDrift {
          0%,100% { transform:translate(0,0) scale(1); }
          50%     { transform:translate(20px,-24px) scale(1.08); }
        }
        .orb { position:absolute; border-radius:50%; filter:blur(10px); pointer-events:none; animation:orbDrift 11s ease-in-out infinite; }
        .orb.o2 { animation-delay:3s; animation-duration:14s; }

        /* ── Showcase cards: 3D tilt on hover ── */
        .showcase-card .showcase-stage {
          transform-style:preserve-3d;
          transition:transform 0.45s cubic-bezier(0.22,0.61,0.36,1), box-shadow 0.45s ease, border-color 0.3s ease;
        }
        .showcase-card:hover .showcase-stage {
          transform:rotateX(7deg) rotateY(-6deg) translateY(-6px) scale(1.02);
          box-shadow:0 24px 48px rgba(23,22,19,0.16), 0 8px 18px rgba(79,104,49,0.10);
          border-color:#a9bd80 !important;
        }
        [dir=rtl] .showcase-card:hover .showcase-stage { transform:rotateX(7deg) rotateY(6deg) translateY(-6px) scale(1.02); }

        /* ── Mockup animations ── */
        @keyframes mockHop {
          0%,55%,100% { transform:translateY(0); box-shadow:0 4px 10px rgba(79,104,49,0.18); }
          25%         { transform:translateY(-7px); box-shadow:0 12px 20px rgba(79,104,49,0.26); }
        }
        .mock-hop { animation:mockHop 3.2s ease-in-out infinite; }

        .mock-sig {
          stroke-dasharray:220; stroke-dashoffset:220;
          animation:sigDraw 3.6s ease-in-out infinite;
        }
        @keyframes sigDraw {
          0%      { stroke-dashoffset:220; }
          45%,80% { stroke-dashoffset:0; }
          100%    { stroke-dashoffset:-220; }
        }

        @keyframes popIn {
          0%   { opacity:0; transform:scale(0.7) translateY(6px); }
          60%  { opacity:1; transform:scale(1.06) translateY(0); }
          100% { opacity:1; transform:scale(1); }
        }
        .mock-pop { animation:popIn 0.8s cubic-bezier(0.34,1.56,0.64,1) both; animation-delay:1.2s; }

        @keyframes bubCycle {
          0%,4%   { opacity:0; transform:scale(0.8) translateY(8px); }
          10%,88% { opacity:1; transform:scale(1) translateY(0); }
          96%,100%{ opacity:0; transform:scale(0.9); }
        }
        .mock-bub { animation:bubCycle 7s ease-in-out infinite; }
        .mock-bub.b2 { animation-delay:0.9s; }
        .mock-bub.b3 { animation-delay:1.8s; }

        @keyframes barGrow {
          0%,8%    { transform:scaleY(0.08); }
          38%,86%  { transform:scaleY(1); }
          100%     { transform:scaleY(0.08); }
        }
        .mock-bar { animation:barGrow 5.5s cubic-bezier(0.22,0.61,0.36,1) infinite; }

        @keyframes fillGrow { from { width:0; } }
        .mock-fill { animation:fillGrow 1.6s cubic-bezier(0.22,0.61,0.36,1) both; }
        .mock-fill.w2 { animation-delay:0.3s; }
        .mock-fill.w3 { animation-delay:0.6s; }

        @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.45; } }
        .mock-blink { animation:blink 1.6s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .hero-sat, .orb, .mock-hop, .mock-sig, .mock-pop, .mock-bub, .mock-bar, .mock-fill, .mock-blink { animation:none !important; }
          .mock-bub { opacity:1; }
        }

        /* ── Responsive ── */
        @media (max-width:900px) {
          .nav-links-d { display:none !important; }
          .features-g  { grid-template-columns:repeat(2,1fr) !important; }
          .modules-g   { grid-template-columns:repeat(4,1fr) !important; }
          .showcase-g  { grid-template-columns:repeat(2,1fr) !important; }
          .hero-sat    { display:none !important; }
        }
        @media (max-width:640px) {
          .stats-row        { grid-template-columns:repeat(2,1fr) !important; }
          .features-g       { grid-template-columns:1fr !important; }
          .modules-g        { grid-template-columns:repeat(3,1fr) !important; }
          .showcase-g       { grid-template-columns:1fr !important; }
          .footer-g         { grid-template-columns:1fr 1fr !important; }
          .hero-btns        { flex-direction:column; align-items:stretch !important; }
          .hero-btns .btn-primary, .hero-btns .btn-secondary { justify-content:center; }
          .demo-grid        { grid-template-columns:1fr !important; gap:24px !important; }
          .nav-hide-mobile  { display:none !important; }
          .btn-primary { padding:11px 20px !important; font-size:14px !important; }
          .btn-secondary { padding:11px 18px !important; font-size:14px !important; }
        }
      `}</style>

      {/* ═══════════════════ NAVBAR ═══════════════════ */}
      <nav style={{
        position: 'fixed', top: 0, insetInline: 0, zIndex: 1000,
        height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(16px,4vw,48px)',
        transition: 'background 0.3s, backdrop-filter 0.3s, border-bottom 0.3s',
        background: navScrolled ? L.navBg : 'transparent',
        borderBottom: navScrolled ? `1px solid ${L.border}` : '1px solid transparent',
        backdropFilter: navScrolled ? 'blur(14px)' : 'none',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <BrandMark size={26} />
          <span style={{ fontSize: 15, fontWeight: 700, color: L.fg1, letterSpacing: '-0.01em' }}>treeelivine</span>
        </Link>
        <div className="nav-links-d" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {[{ label: lp.navFeatures, href: '#features' }, { label: lp.navModules, href: '#modules' }, { label: isAr ? 'الجديد ✨' : 'New ✨', href: '#new' }, { label: lp.navPricing, href: '#pricing' }, { label: 'FAQ', href: '#faq' }].map(l => (
            <a key={l.href} href={l.href} className="ln-link">{l.label}</a>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn-secondary btn-sm" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
            {lang === 'ar' ? 'EN' : 'AR'}
          </button>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="btn-secondary btn-sm" style={{ padding: '7px 10px', fontSize: 14 }}>
            {isDark ? '☀️' : '🌙'}
          </button>
          <Link href="/login" className="ln-link nav-hide-mobile" style={{ display: 'inline-block' }}>{lp.navLogin}</Link>
          <button onClick={handleDemo} disabled={demoLoading} className="btn-primary btn-sm" style={{ opacity: demoLoading ? 0.75 : 1 }}>
            {demoLoading ? '...' : lp.navDemo}
          </button>
        </div>
      </nav>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section style={{ paddingTop: 'clamp(90px,12vw,130px)', paddingBottom: 0, textAlign: 'center', position: 'relative' }}>

        {/* Subtle radial glow */}
        <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 800, height: 500, background: 'radial-gradient(ellipse at center top, rgba(79,104,49,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 clamp(16px,4vw,24px)', position: 'relative' }}>
          {/* Trust badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '6px 16px 6px 10px', borderRadius: 999, background: L.surface, border: `1px solid ${L.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 28, animation: 'wordIn 0.6s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {['#4f6831','#2f6bbf','#c87a52'].map((c, i) => (
                <div key={i} style={{ width: 22, height: 22, borderRadius: '50%', background: c, border: '2px solid #fff', marginInlineEnd: i < 2 ? -6 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff', fontWeight: 700 }}>
                  {['أد','سع','فم'][i]}
                </div>
              ))}
            </div>
            <span style={{ fontSize: 12, color: L.fg3, fontWeight: 500 }}>{lp.trustBadge}</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#2f8a3e', display: 'inline-block', flexShrink: 0 }} />
          </div>

          {/* Main headline — word by word on load */}
          <h1 style={{ fontSize: 'clamp(30px,5.5vw,62px)', fontWeight: 800, lineHeight: 1.12, color: L.fg1, letterSpacing: '-0.025em', marginBottom: 18 }}>
            {lp.heroLine1.map((w, i) => (
              <span key={i} className="hero-word" style={{ animationDelay: `${i * 90}ms` }}>{w} </span>
            ))}
            <br />
            <span style={{ color: L.olive }}>
              {lp.heroLine2.map((w, i) => (
                <span key={i} className="hero-word" style={{ animationDelay: `${lp.heroLine1.length * 90 + i * 90}ms` }}>{w} </span>
              ))}
            </span>
          </h1>

          {/* Subtitle */}
          <p style={{ fontSize: 'clamp(14px,1.9vw,18px)', color: L.fg4, lineHeight: 1.75, maxWidth: 580, margin: '0 auto 28px', animation: 'wordIn 0.7s ease 0.5s both' }}>
            {lp.heroSub}
          </p>

          {/* CTAs */}
          <div className="hero-btns" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10, animation: 'wordIn 0.7s ease 0.7s both' }}>
            <button onClick={handleDemo} disabled={demoLoading} className="btn-primary" style={{ opacity: demoLoading ? 0.75 : 1, fontSize: 16, padding: '14px 30px' }}>
              {demoLoading ? lp.heroLoading : lp.heroCta1}
            </button>
            <Link href="/login" className="btn-secondary" style={{ fontSize: 16, padding: '14px 28px' }}>{lp.navLogin}</Link>
          </div>
          <p style={{ fontSize: 12, color: L.fg5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, animation: 'wordIn 0.7s ease 0.85s both' }}>
            <span style={{ color: '#2f8a3e', fontWeight: 700 }}>✓</span>
            {lp.heroNote}
          </p>
        </div>

        {/* ── Dashboard with perspective tilt ── */}
        <div style={{ marginTop: 16, position: 'relative', padding: '0 clamp(8px,3vw,24px)' }}>
          {/* Bottom fade mask */}
          <div style={{ position: 'absolute', bottom: 0, insetInline: 0, height: '20%', background: `linear-gradient(to top, var(--bg-app), transparent)`, zIndex: 2, pointerEvents: 'none' }} />

          {/* Glow under mockup */}
          <div style={{ position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)', width: '60%', height: 80, background: 'rgba(79,104,49,0.2)', filter: 'blur(52px)', pointerEvents: 'none', zIndex: 0 }} />

          <div id="hero-dashboard" style={{ maxWidth: 1060, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            {/* floating satellite cards (hidden on small screens) */}
            <div className="hero-sat sat-1" style={{ position: 'absolute', top: '14%', insetInlineStart: -26, zIndex: 3, background: 'var(--bg-surface)', border: `1px solid ${L.border}`, borderRadius: 12, padding: '10px 14px', boxShadow: '0 14px 34px rgba(0,0,0,0.16)', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: L.oliveL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🔔</span>
              <span style={{ textAlign: 'start' }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: L.fg1 }}>{isAr ? 'تم سداد فاتورة' : 'Invoice paid'}</span>
                <span className="ltr-num" style={{ display: 'block', fontSize: 10, color: L.fg4, fontFamily: 'var(--font-mono)' }}>INV-2026-014 · SAR 8,500</span>
              </span>
            </div>
            <div className="hero-sat sat-2" style={{ position: 'absolute', top: '42%', insetInlineEnd: -30, zIndex: 3, background: 'var(--bg-surface)', border: `1px solid ${L.border}`, borderRadius: 12, padding: '10px 14px', boxShadow: '0 14px 34px rgba(0,0,0,0.16)', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(47,138,62,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>✍️</span>
              <span style={{ textAlign: 'start' }}>
                <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: L.fg1 }}>{isAr ? 'تم توقيع العقد' : 'Contract signed'}</span>
                <span style={{ display: 'block', fontSize: 10, color: '#2f8a3e', fontWeight: 600 }}>{isAr ? 'دلوقتي ✓' : 'Just now ✓'}</span>
              </span>
            </div>
            <div className="hero-sat sat-3" style={{ position: 'absolute', bottom: '30%', insetInlineStart: -20, zIndex: 3, background: 'var(--brand-primary)', color: '#fff', borderRadius: '14px 14px 14px 4px', padding: '9px 14px', boxShadow: '0 14px 34px rgba(79,104,49,0.32)', fontSize: 11, fontWeight: 600 }}>
              {isAr ? 'تمام يا فندم، هخلص النهاردة 🚀' : 'On it — shipping today 🚀'}
              <span style={{ display: 'block', fontSize: 9, opacity: 0.75, marginTop: 2, textAlign: 'end' }}>✓✓</span>
            </div>
            <div className="hero-sat sat-4" style={{ position: 'absolute', top: '8%', insetInlineEnd: '12%', zIndex: 3, background: 'var(--bg-surface)', border: `1px solid ${L.border}`, borderRadius: 12, padding: '9px 13px', boxShadow: '0 14px 34px rgba(0,0,0,0.14)', textAlign: 'start' }}>
              <span style={{ display: 'block', fontSize: 9, color: L.fg4, marginBottom: 3 }}>{isAr ? 'هامش الربح' : 'Profit margin'}</span>
              <span style={{ display: 'flex', alignItems: 'flex-end', gap: 3, direction: 'ltr' }}>
                {[40, 65, 50, 85].map((h, i) => (
                  <span key={i} style={{ width: 6, height: h * 0.28, borderRadius: 2, background: i === 3 ? 'var(--chart-1)' : 'var(--border-2)', display: 'inline-block' }} />
                ))}
                <span style={{ fontSize: 12, fontWeight: 800, color: '#2f8a3e', marginInlineStart: 4 }}>+32%</span>
              </span>
            </div>
            <div style={{
              borderRadius: 18,
              overflow: 'hidden',
              boxShadow: '0 2px 0 1px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.14), 0 32px 80px rgba(0,0,0,0.22), 0 64px 120px rgba(0,0,0,0.12)',
              border: `1px solid ${L.border}`,
              background: 'var(--bg-surface)',
            }}>
              {/* Browser chrome bar */}
              <div style={{
                background: 'var(--bg-surface-2)',
                borderBottom: `1px solid ${L.border}`,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['#ff5f57','#febc2e','#28c840'].map(c => (
                    <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                  ))}
                </div>
                <div style={{ flex: 1, background: 'var(--bg-app)', borderRadius: 6, height: 22, maxWidth: 280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--fg-4)" strokeWidth={2}><circle cx={12} cy={12} r={10}/><path d="M2 12h20"/></svg>
                  <span style={{ fontSize: 10, color: 'var(--fg-4)', fontFamily: 'monospace' }}>app.treeelivine.com</span>
                </div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={isDark ? '/dashboard-dark.png' : '/dashboard-light.png'}
                alt="Treeelivine Dashboard"
                style={{ width: '100%', display: 'block' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ STATS STRIP ═══════════════════ */}
      <div style={{ borderTop: `1px solid ${L.border}` }} />
      <section className="reveal-section" style={{ padding: '40px clamp(16px,4vw,24px)', background: L.surface }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24, textAlign: 'center' }} className="stats-row">
          {lp.stats.map((s, i) => (
            <div key={i} style={{ transitionDelay: `${i * 80}ms` }} className="aw-wrap">
              <div style={{ fontSize: 'clamp(24px,3vw,36px)', fontWeight: 800, color: L.olive, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
                <AnimatedWords text={s.value} baseDelay={i * 60} />
              </div>
              <div style={{ fontSize: 12, color: L.fg4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>
      <div style={{ borderTop: `1px solid ${L.border}` }} />

      {/* ═══════════════════ FEATURES ═══════════════════ */}
      <section id="features" style={{ padding: 'clamp(56px,8vw,96px) clamp(16px,4vw,24px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="reveal-section" style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: L.olive, marginBottom: 14 }}>{lp.featuresLabel}</div>
            <h2 style={{ fontSize: 'clamp(22px,3.5vw,38px)', fontWeight: 700, color: L.fg1, letterSpacing: '-0.015em', marginBottom: 12 }}>
              <AnimatedWords text={lp.featuresH2} />
            </h2>
            <p style={{ fontSize: 14, color: L.fg3, maxWidth: 520, margin: '0 auto', lineHeight: 1.75 }}>
              <AnimatedWords text={lp.featuresSub} baseDelay={300} />
            </p>
          </div>
          <div className="cards-container features-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {lp.features.map((f, i) => <FeatureCard key={i} {...f} />)}
          </div>
        </div>
      </section>

      {/* ═══════════════════ MODULES ═══════════════════ */}
      <section id="modules" style={{ padding: 'clamp(56px,8vw,96px) clamp(16px,4vw,24px)', background: L.surface, borderTop: `1px solid ${L.border}`, borderBottom: `1px solid ${L.border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="reveal-section" style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: L.olive, marginBottom: 14 }}>{lp.modulesLabel}</div>
            <h2 style={{ fontSize: 'clamp(22px,3.5vw,38px)', fontWeight: 700, color: L.fg1, letterSpacing: '-0.015em', marginBottom: 12 }}>
              <AnimatedWords text={lp.modulesH2} />
            </h2>
            <p style={{ fontSize: 14, color: L.fg3, maxWidth: 520, margin: '0 auto', lineHeight: 1.75 }}>
              <AnimatedWords text={lp.modulesSub} baseDelay={280} />
            </p>
          </div>
          <div className="cards-container modules-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: 10 }}>
            {lp.modules.map((m, i) => <ModuleBadge key={i} {...m} />)}
          </div>
        </div>
      </section>

      {/* ═══════════════════ NEW FEATURES SHOWCASE (animated 3D mockups) ═══════════════════ */}
      <section id="new" style={{ padding: 'clamp(56px,8vw,96px) clamp(16px,4vw,24px)', position: 'relative', overflow: 'hidden' }}>
        {/* floating gradient orbs */}
        <div className="orb" style={{ top: 60, insetInlineStart: '-6%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(79,104,49,0.14), transparent 70%)' }} />
        <div className="orb o2" style={{ bottom: 40, insetInlineEnd: '-4%', width: 260, height: 260, background: 'radial-gradient(circle, rgba(47,107,191,0.10), transparent 70%)' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
          <div className="reveal-section" style={{ textAlign: 'center', marginBottom: 52 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: L.olive, marginBottom: 14 }}>{lp.showcaseLabel}</div>
            <h2 style={{ fontSize: 'clamp(22px,3.5vw,38px)', fontWeight: 700, color: L.fg1, letterSpacing: '-0.015em', marginBottom: 12 }}>
              <AnimatedWords text={lp.showcaseH2} />
            </h2>
            <p style={{ fontSize: 14, color: L.fg3, maxWidth: 560, margin: '0 auto', lineHeight: 1.75 }}>
              <AnimatedWords text={lp.showcaseSub} baseDelay={300} />
            </p>
          </div>

          <div className="cards-container showcase-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, perspective: 1600 }}>
            {lp.showcase.map((s, i) => (
              <div key={s.key} className="fade-card showcase-card" style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="showcase-stage" style={{
                  height: 190, borderRadius: 14, border: `1px solid ${L.border}`,
                  background: `linear-gradient(160deg, var(--bg-surface), var(--bg-surface-2, var(--bg-app)))`,
                  padding: 16, overflow: 'hidden', position: 'relative',
                }}>
                  {s.key === 'pipeline' && <MockPipeline isAr={isAr} />}
                  {s.key === 'contract' && <MockContract isAr={isAr} />}
                  {s.key === 'chat' && <MockChat isAr={isAr} />}
                  {s.key === 'profit' && <MockProfit isAr={isAr} />}
                  {s.key === 'resources' && <MockResources isAr={isAr} />}
                  {s.key === 'ticket' && <MockTicket isAr={isAr} />}
                </div>
                <div style={{ padding: '14px 6px 0' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: L.fg1, marginBottom: 5 }}>{s.title}</h3>
                  <p style={{ fontSize: 12.5, color: L.fg4, lineHeight: 1.65 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ DEMO CTA ═══════════════════ */}
      <section id="pricing" style={{ padding: 'clamp(56px,8vw,96px) clamp(16px,4vw,24px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="reveal-section demo-grid" style={{
            background: L.surface, border: `1px solid ${L.border2}`, borderRadius: 20,
            padding: 'clamp(28px,5vw,56px)', position: 'relative', overflow: 'hidden',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center',
          }}>
            <div style={{ position: 'absolute', top: -80, insetInlineEnd: -80, width: 280, height: 280, borderRadius: '50%', background: L.oliveL, pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: L.olive, marginBottom: 14 }}>{lp.demoLabel}</div>
              <h2 style={{ fontSize: 'clamp(20px,3vw,32px)', fontWeight: 700, color: L.fg1, marginBottom: 14, lineHeight: 1.25, letterSpacing: '-0.015em' }}>
                <AnimatedWords text={lp.demoH2} />
              </h2>
              <p style={{ color: L.fg3, lineHeight: 1.7, marginBottom: 24, fontSize: 13 }}>{lp.demoDesc}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <button onClick={handleDemo} disabled={demoLoading} className="btn-primary" style={{ opacity: demoLoading ? 0.75 : 1 }}>
                  {demoLoading ? lp.demoLoadingTxt : lp.demoCta1}
                </button>
              </div>
            </div>
            <div style={{ background: L.bg, border: `1px solid ${L.border}`, borderRadius: 12, padding: 20, position: 'relative' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: L.olive, marginBottom: 16 }}>{lp.demoCredsTitle}</div>
              {[
                { label: lp.demoEmailLbl, value: 'demo@treeelivine.com' },
                { label: lp.demoPassLbl,  value: 'demo1234' },
                { label: lp.demoRoleLbl,  value: lp.demoRoleVal },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: L.surface, borderRadius: 6, fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: L.fg4 }}>{r.label}</span>
                  <span style={{ color: L.fg1, fontWeight: 600, direction: 'ltr', fontFamily: 'monospace', fontSize: 12 }}>{r.value}</span>
                </div>
              ))}
              <button onClick={handleDemo} disabled={demoLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 4, opacity: demoLoading ? 0.75 : 1 }}>
                {demoLoading ? lp.demoLoadingTxt : lp.demoOpenBtn}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ TESTIMONIALS ═══════════════════ */}
      <section style={{ padding: 'clamp(56px,8vw,96px) clamp(16px,4vw,24px)', background: L.surface, borderTop: `1px solid ${L.border}`, borderBottom: `1px solid ${L.border}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
          <div className="reveal-section" style={{ marginBottom: 48 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: L.olive, marginBottom: 14 }}>{lp.testimonialsLabel}</div>
            <h2 style={{ fontSize: 'clamp(22px,3.5vw,38px)', fontWeight: 700, color: L.fg1, letterSpacing: '-0.015em' }}>
              <AnimatedWords text={lp.testimonialsH2} />
            </h2>
          </div>

          {/* Carousel */}
          {(() => {
            const perPage = isMobile ? 1 : 3
            const totalPages = Math.ceil(lp.testimonials.length / perPage)
            const maxIdx = totalPages - 1
            const visible = lp.testimonials.slice(carouselIdx * perPage, carouselIdx * perPage + perPage)
            return (
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 16, marginBottom: 32 }}>
                  {visible.map((t, i) => (
                    <TestimonialCard key={carouselIdx * perPage + i} {...t} />
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                  <button
                    onClick={() => setCarouselIdx(p => Math.max(0, p - 1))}
                    disabled={carouselIdx === 0}
                    style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${L.border}`, background: 'var(--bg-surface)', color: L.fg3, cursor: carouselIdx === 0 ? 'not-allowed' : 'pointer', opacity: carouselIdx === 0 ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'opacity 0.2s' }}
                  >‹</button>

                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setCarouselIdx(i)}
                      style={{ width: carouselIdx === i ? 24 : 8, height: 8, borderRadius: 4, border: 'none', background: carouselIdx === i ? L.olive : L.border, cursor: 'pointer', transition: 'all 0.25s', padding: 0 }}
                    />
                  ))}

                  <button
                    onClick={() => setCarouselIdx(p => Math.min(maxIdx, p + 1))}
                    disabled={carouselIdx === maxIdx}
                    style={{ width: 32, height: 32, borderRadius: '50%', border: `1px solid ${L.border}`, background: 'var(--bg-surface)', color: L.fg3, cursor: carouselIdx === maxIdx ? 'not-allowed' : 'pointer', opacity: carouselIdx === maxIdx ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, transition: 'opacity 0.2s' }}
                  >›</button>
                </div>
              </div>
            )
          })()}
        </div>
      </section>

      {/* ═══════════════════ FAQ ═══════════════════ */}
      <section id="faq" style={{ padding: 'clamp(56px,8vw,96px) clamp(16px,4vw,24px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="reveal-section" style={{ textAlign: 'center', marginBottom: 48 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: L.olive, marginBottom: 14 }}>{lp.faqLabel}</div>
            <h2 style={{ fontSize: 'clamp(22px,3.5vw,38px)', fontWeight: 700, color: L.fg1, letterSpacing: '-0.015em' }}>
              <AnimatedWords text={lp.faqH2} />
            </h2>
          </div>
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lp.faqs.map((f, i) => <FAQItem key={i} {...f} />)}
          </div>
        </div>
      </section>

      {/* ═══════════════════ FINAL CTA ═══════════════════ */}
      <section style={{ padding: 'clamp(72px,10vw,110px) clamp(16px,4vw,24px)', background: '#4f6831', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none' }}>
          <svg viewBox="0 0 800 400" style={{ width: '100%', height: '100%' }} fill="white">
            <circle cx={200} cy={100} r={180} />
            <circle cx={650} cy={320} r={220} />
          </svg>
        </div>
        <div className="reveal-section" style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ display: 'inline-block', padding: '4px 16px', borderRadius: 999, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', fontSize: 12, color: 'white', fontWeight: 500, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {lp.finalLabel}
          </div>
          <h2 style={{ fontSize: 'clamp(24px,4.5vw,46px)', fontWeight: 800, color: 'white', marginBottom: 16, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            <AnimatedWords text={lp.finalH2} />
          </h2>
          <p style={{ fontSize: 'clamp(14px,1.8vw,17px)', color: 'rgba(255,255,255,0.75)', maxWidth: 460, margin: '0 auto 36px', lineHeight: 1.7 }}>
            {lp.finalDesc}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleDemo} disabled={demoLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '14px 30px', background: 'white', color: '#4f6831', borderRadius: 10, fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: demoLoading ? 0.75 : 1, transition: 'transform 0.12s', fontFamily: 'inherit' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'}>
              {demoLoading ? '...' : lp.finalCta1}
            </button>
            <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', padding: '14px 28px', background: 'rgba(255,255,255,0.15)', color: 'white', borderRadius: 10, fontSize: 15, fontWeight: 600, border: '1px solid rgba(255,255,255,0.3)', textDecoration: 'none' }}>
              {lp.navLogin}
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer style={{ borderTop: `1px solid ${L.border}`, padding: '40px clamp(16px,4vw,24px) 28px', background: L.surface }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="footer-g" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 32, marginBottom: 32 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <BrandMark size={22} />
                <span style={{ fontSize: 15, fontWeight: 700, color: L.fg1, letterSpacing: '-0.01em' }}>treeelivine</span>
              </div>
              <p style={{ color: L.fg4, fontSize: 13, lineHeight: 1.7, maxWidth: 220 }}>{lp.footerDesc}</p>
            </div>
            {[
              { title: lp.footerProduct, links: [{ l: lp.navFeatures, h: '#features' }, { l: lp.navModules, h: '#modules' }, { l: lp.navPricing, h: '#pricing' }, { l: 'FAQ', h: '#faq' }] },
              { title: lp.footerAccount, links: [{ l: lp.footerLogin, h: '/login' }, { l: lp.footerDemo, h: '#pricing' }] },
              { title: lp.footerSupport, links: [{ l: lp.footerPrivacy, h: '/privacy' }, { l: lp.footerTerms, h: '/terms' }, { l: lp.footerSupport2, h: '/support' }] },
            ].map((col, i) => (
              <div key={i}>
                <p style={{ fontWeight: 600, fontSize: 11, color: L.fg3, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{col.title}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {col.links.map((lk, j) => <a key={j} href={lk.h} className="ln-link" style={{ padding: 0 }}>{lk.l}</a>)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${L.border}`, paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <p style={{ fontSize: 12, color: L.fg5 }}>{lp.copyright}</p>
            <div style={{ display: 'flex', gap: 16 }}>
              {[{ l: lp.footerPrivacy, h: '/privacy' }, { l: lp.footerTerms, h: '/terms' }].map((lk, i) => (
                <a key={i} href={lk.h} style={{ fontSize: 12, color: L.fg5, textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = L.fg3}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = L.fg5}
                >{lk.l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
