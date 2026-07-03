'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function PortalBriefPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useApp()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [approving, setApproving] = useState(false)

  async function fetchBrief() {
    const res = await fetch(`/api/projects/${projectId}/brief`)
    const data = await res.json()
    if (data.success) setProject(data.data)
    setLoading(false)
  }

  useEffect(() => { fetchBrief() }, [projectId])

  async function handleAction(action: string) {
    setApproving(true)
    await fetch(`/api/projects/${projectId}/brief`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
    setApproving(false); fetchBrief()
  }

  async function addComment() {
    if (!comment.trim()) return
    await fetch(`/api/projects/${projectId}/brief/comment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: comment }) })
    setComment(''); fetchBrief()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href="/portal/projects" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>← Projects</Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{project?.name}</h2>
        {project?.briefStatus && <StatusBadge status={project.briefStatus} />}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 600 }}>Project Brief</h3>
          {project?.brief && project?.briefStatus !== 'approved' && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary" onClick={() => handleAction('approve')} disabled={approving} style={{ fontSize: '0.85rem' }}>✓ Approve</button>
              {project?.briefStatus !== 'rejected' && (
                <button className="btn btn-danger" onClick={() => handleAction('reject')} disabled={approving} style={{ fontSize: '0.85rem' }}>✗ Request Changes</button>
              )}
            </div>
          )}
        </div>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: project?.brief ? 'var(--text)' : 'var(--text-muted)', minHeight: 60 }}>
          {project?.brief || 'Brief not written yet.'}
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Comments ({project?.briefComments?.length || 0})</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          {(project?.briefComments || []).map((c: any, i: number) => (
            <div key={i} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{c.authorName}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <p style={{ fontSize: '0.875rem' }}>{c.text}</p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input className="input" placeholder="Write a comment..." value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addComment() }} />
          <button className="btn btn-primary" onClick={addComment}>Send</button>
        </div>
      </div>
    </div>
  )
}
