'use client'
import { useState, InputHTMLAttributes } from 'react'

const EyeIcon = ({ off }: { off?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </>
    ) : (
      <>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
)

/** Password input with a show/hide toggle. Drop-in replacement for
 *  <input className="input" type="password" ...> — RTL-aware. */
export default function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  const { className, style, ...rest } = props
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        {...rest}
        type={show ? 'text' : 'password'}
        className={className || 'input'}
        style={{ ...style, paddingInlineEnd: 38 }}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', insetInlineEnd: 6, top: '50%', transform: 'translateY(-50%)',
          width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--fg-4)', borderRadius: 'var(--radius-sm)',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--fg-2)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-4)')}
      >
        <EyeIcon off={show} />
      </button>
    </div>
  )
}
