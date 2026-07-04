'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '@/contexts/AppContext'

function fmtSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AttachmentsPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { lang, hasPermission } = useApp()
  const isAr = lang === 'ar'
  const [files, setFiles] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [clientVisible, setClientVisible] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/attachments?entityType=${entityType}&entityId=${entityId}`)
    const data = await res.json()
    if (data.success) setFiles(data.data)
  }, [entityType, entityId])

  useEffect(() => { load() }, [load])

  async function upload(file: File) {
    setUploading(true); setError('')
    const form = new FormData()
    form.append('file', file)
    form.append('entityType', entityType)
    form.append('entityId', entityId)
    form.append('clientVisible', String(clientVisible))
    const res = await fetch('/api/attachments', { method: 'POST', body: form })
    const data = await res.json()
    if (!data.success) setError(data.message || 'Upload failed')
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    load()
  }

  async function remove(id: string) {
    await fetch(`/api/attachments/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {hasPermission('files.write') && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={inputRef} type="file" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
          <button className="btn btn-secondary" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? (isAr ? 'جارٍ الرفع…' : 'Uploading…') : (isAr ? '⤴ رفع ملف' : '⤴ Upload file')}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-xs)', color: 'var(--fg-3)', cursor: 'pointer' }}>
            <input type="checkbox" checked={clientVisible} onChange={e => setClientVisible(e.target.checked)} />
            {isAr ? 'ظاهر للعميل في البوابة' : 'Visible to client in portal'}
          </label>
        </div>
      )}
      {error && <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--danger-500)' }}>{error}</p>}

      {files.length === 0 ? (
        <p style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--fg-4)', fontSize: 'var(--fs-sm)' }}>
          {isAr ? 'لا توجد ملفات' : 'No files yet'}
        </p>
      ) : files.map(f => (
        <div key={f._id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg-surface-2)', border: '1px solid var(--border-1)',
          borderRadius: 'var(--radius-md)', padding: '8px 12px',
        }}>
          <span style={{ fontSize: 16 }}>📄</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <a href={`/api/attachments/${f._id}`} style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--fg-link)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
              {f.fileName}
            </a>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--fg-4)' }}>
              {fmtSize(f.sizeBytes)}{f.clientVisible ? (isAr ? ' · ظاهر للعميل' : ' · client visible') : ''}
            </span>
          </div>
          {hasPermission('files.write') && (
            <button className="btn btn-ghost btn-sm" onClick={() => remove(f._id)} style={{ color: 'var(--danger-500)' }}>×</button>
          )}
        </div>
      ))}
    </div>
  )
}
