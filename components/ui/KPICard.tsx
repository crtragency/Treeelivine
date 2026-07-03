'use client'
import { ReactNode } from 'react'

interface Props {
  title: string
  value: string | number
  icon?: ReactNode
  color?: string
  sub?: string
  delta?: string
  deltaDir?: 'up' | 'down'
}

export default function KPICard({ title, value, icon, sub, delta, deltaDir }: Props) {
  return (
    <div className="kpi" style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="kpi-label" style={{ marginBottom: 0 }}>{title}</span>
        {icon && <span style={{ color: 'var(--fg-4)', flexShrink: 0, display: 'inline-flex' }}>{icon}</span>}
      </div>
      <span className="kpi-value">{value}</span>
      {delta && <span className={`kpi-delta ${deltaDir === 'down' ? 'kpi-delta-down' : 'kpi-delta-up'}`}>{delta}</span>}
      {sub && <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-4)', marginTop: 2 }}>{sub}</span>}
    </div>
  )
}
