'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

function fmtSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PortalFilesPage() {
  const { lang } = useApp()
  const isAr = lang === 'ar'
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portal').then(r => r.json())
      .then(d => { if (d.success) setFiles(d.data.files || []) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>{isAr ? 'الملفات' : 'Files'}</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="t-table">
          <thead>
            <tr>
              <th>{isAr ? 'الملف' : 'File'}</th>
              <th style={{ textAlign: 'end' }}>{isAr ? 'الحجم' : 'Size'}</th>
              <th>{isAr ? 'التاريخ' : 'Date'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {files.map(f => (
              <tr key={f._id}>
                <td className="td-name">📄 {f.fileName}</td>
                <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>{fmtSize(f.sizeBytes)}</td>
                <td style={{ color: 'var(--fg-3)' }}>{new Date(f.createdAt).toLocaleDateString(isAr ? 'ar-u-ca-gregory' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td style={{ textAlign: 'end' }}>
                  <a href={`/api/attachments/${f._id}`} className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}>
                    {isAr ? 'تحميل' : 'Download'}
                  </a>
                </td>
              </tr>
            ))}
            {!files.length && <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>{isAr ? 'لا توجد ملفات مشتركة معك بعد' : 'No files shared with you yet'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
