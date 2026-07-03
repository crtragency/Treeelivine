'use client'
import { useEffect, ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: number
}

export default function Modal({ open, onClose, title, children, width = 520 }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'var(--bg-overlay)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        animation: 'fadeIn var(--dur-base) var(--ease-out)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-2)',
        borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-xl)',
        width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto',
        animation: 'fadeUp var(--dur-base) var(--ease-out)',
      }}>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-5) var(--space-6)', borderBottom: '1px solid var(--border-1)' }}>
            <h3 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', color: 'var(--fg-1)' }}>{title}</h3>
            <button className="iconbtn" onClick={onClose} aria-label="Close" style={{ fontSize: 'var(--fs-lg)', lineHeight: 1 }}>×</button>
          </div>
        )}
        <div style={{ padding: 'var(--space-6)' }}>{children}</div>
      </div>
    </div>
  )
}
