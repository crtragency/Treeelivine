'use client'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import Modal from '@/components/ui/Modal'
import ConfirmModal from '@/components/ui/ConfirmModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

function mimeIcon(mime?: string) {
  if (!mime) return '📄'
  if (mime.startsWith('image/')) return '🖼️'
  if (mime.startsWith('video/')) return '🎬'
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.includes('pdf')) return '📕'
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜️'
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return '📊'
  if (mime.includes('word') || mime.includes('document')) return '📝'
  return '📄'
}

function fmtSize(b?: number) {
  const n = Number(b) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${Math.round((n / (1024 * 1024)) * 10) / 10} MB`
}

export default function FilesPage() {
  const { t, lang, hasPermission } = useApp()
  const isAr = lang === 'ar'
  const canWrite = hasPermission('dam.write')

  const [folders, setFolders] = useState<any[]>([])
  const [files, setFiles] = useState<any[]>([])
  const [currentFolder, setCurrentFolder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadTags, setUploadTags] = useState('')
  const [folderModal, setFolderModal] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [customers, setCustomers] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [folderCustomer, setFolderCustomer] = useState('')
  const [folderProject, setFolderProject] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<any>(null)
  const [historyFile, setHistoryFile] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const versionInput = useRef<HTMLInputElement>(null)
  const versionTarget = useRef<any>(null)

  async function fetchAll() {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (tagFilter) params.set('tag', tagFilter)
    if (currentFolder) params.set('folderId', currentFolder._id)
    else if (!search && !tagFilter) params.set('root', '1')
    const [fRes, flRes] = await Promise.all([
      fetch('/api/dam/folders').then(r => r.json()),
      fetch(`/api/dam/files?${params}`).then(r => r.json()),
    ])
    if (fRes.success) setFolders(fRes.data)
    if (flRes.success) setFiles(flRes.data)
    setLoading(false)
  }
  useEffect(() => { fetchAll() }, [search, tagFilter, currentFolder?._id])

  async function loadPickers() {
    if (customers.length || projects.length) return
    const [cu, pr] = await Promise.all([
      fetch('/api/customers').then(r => r.json()).catch(() => ({})),
      fetch('/api/projects').then(r => r.json()).catch(() => ({})),
    ])
    if (cu.success) setCustomers(cu.data)
    if (pr.success) setProjects(pr.data)
  }

  async function upload(f: File, versionGroup?: string) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', f)
    fd.append('dam', 'true')
    if (currentFolder && !versionGroup) fd.append('folderId', currentFolder._id)
    if (uploadTags.trim() && !versionGroup) fd.append('tags', uploadTags)
    if (versionGroup) fd.append('versionGroup', versionGroup)
    const res = await fetch('/api/attachments', { method: 'POST', body: fd }).then(r => r.json())
    if (!res.success) alert(res.message)
    setUploading(false)
    fetchAll()
  }

  async function createFolder() {
    const res = await fetch('/api/dam/folders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: folderName,
        parentId: currentFolder?._id || null,
        customerId: folderCustomer || null,
        projectId: folderProject || null,
      }),
    }).then(r => r.json())
    if (res.success) { setFolderModal(false); setFolderName(''); setFolderCustomer(''); setFolderProject(''); fetchAll() }
    else alert(res.message)
  }

  async function showHistory(f: any) {
    setHistoryFile(f); setHistory([])
    const res = await fetch(`/api/dam/files?versionGroup=${f.versionGroup}`).then(r => r.json())
    if (res.success) setHistory(res.data)
  }

  const subFolders = folders.filter(f => (f.parentId || null) === (currentFolder?._id || null))
  const crumbs: any[] = []
  let walker = currentFolder
  while (walker) { crumbs.unshift(walker); walker = folders.find(f => f._id === walker.parentId) }
  const allTags = Array.from(new Set(files.flatMap((f: any) => f.tags || [])))

  return (
    <div className="page-content">
      <div className="page-head">
        <div>
          <h1>{t['dam.title']}</h1>
          <p className="sub">{t['dam.subtitle']}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canWrite && <button className="btn btn-secondary" onClick={() => { loadPickers(); setFolderModal(true) }}>📁 {t['dam.newFolder']}</button>}
          {canWrite && (
            <>
              <input ref={fileInput} type="file" hidden onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
              <button className="btn btn-primary" onClick={() => fileInput.current?.click()} disabled={uploading}>{uploading ? '…' : `⬆ ${t['dam.upload']}`}</button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" placeholder={t['dam.searchFiles']} value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
        {canWrite && <input className="input" placeholder={t['dam.uploadTags']} value={uploadTags} onChange={e => setUploadTags(e.target.value)} style={{ width: 220 }} />}
        {allTags.length > 0 && (
          <select className="input" value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={{ width: 160 }}>
            <option value="">{t['dam.allTags']}</option>
            {allTags.map(tg => <option key={tg} value={tg}>{tg}</option>)}
          </select>
        )}
      </div>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
        <button onClick={() => setCurrentFolder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: currentFolder ? 'var(--accent)' : 'var(--fg-2)', fontWeight: 600, padding: 0 }}>
          🏠 {t['dam.root']}
        </button>
        {crumbs.map(c => (
          <span key={c._id} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ color: 'var(--fg-5)' }}>{isAr ? '‹' : '›'}</span>
            <button onClick={() => setCurrentFolder(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c._id === currentFolder?._id ? 'var(--fg-2)' : 'var(--accent)', fontWeight: c._id === currentFolder?._id ? 600 : 400, padding: 0 }}>{c.name}</button>
          </span>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <>
          {/* Folders grid */}
          {subFolders.length > 0 && !search && !tagFilter && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              {subFolders.map(f => (
                <div key={f._id} className="card-surface" style={{ padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => setCurrentFolder(f)} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'start', padding: 0 }}>
                    <span style={{ fontSize: '1.3rem' }}>📁</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      {(f.customer?.name || f.project?.name) && (
                        <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--fg-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.customer?.name || f.project?.name}
                        </span>
                      )}
                    </span>
                  </button>
                  {canWrite && (
                    <button className="iconbtn" onClick={() => setDeleteFolderTarget(f)} title={t.delete} style={{ flexShrink: 0 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Files grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {files.map(f => (
              <div key={f._id} className="card-surface" style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  {f.mimeType?.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/attachments/${f._id}`} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-1)', flexShrink: 0 }} />
                  ) : (
                    <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{mimeIcon(f.mimeType)}</span>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.fileName}>{f.fileName}</p>
                    <p className="ltr-num" style={{ fontSize: '0.68rem', color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
                      {fmtSize(f.sizeBytes)} · {new Date(f.createdAt).toLocaleDateString(isAr ? 'ar-u-ca-gregory' : 'en')}
                    </p>
                  </div>
                  {(f.versionCount > 1 || f.version > 1) && (
                    <button className="pill pill-info" onClick={() => showHistory(f)} style={{ cursor: 'pointer', flexShrink: 0 }}>v{f.version}</button>
                  )}
                </div>
                {(f.tags || []).length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {f.tags.map((tg: string) => (
                      <button key={tg} className="pill pill-draft" onClick={() => setTagFilter(tg)} style={{ cursor: 'pointer' }}>#{tg}</button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <a className="btn btn-secondary" href={`/api/attachments/${f._id}`} style={{ padding: '0.28rem 0.6rem', fontSize: '0.7rem', textDecoration: 'none' }}>⬇ {t['dam.download']}</a>
                  {canWrite && (
                    <button className="btn btn-secondary" style={{ padding: '0.28rem 0.6rem', fontSize: '0.7rem' }}
                      onClick={() => { versionTarget.current = f; versionInput.current?.click() }}>
                      ↺ {t['dam.newVersion']}
                    </button>
                  )}
                  {canWrite && <button className="btn btn-danger" onClick={() => setDeleteTarget(f)} style={{ padding: '0.28rem 0.6rem', fontSize: '0.7rem' }}>{t.delete}</button>}
                </div>
              </div>
            ))}
            {files.length === 0 && subFolders.length === 0 && (
              <div className="card-surface" style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--fg-4)' }}>
                <p style={{ fontWeight: 500 }}>{t['dam.empty']}</p>
              </div>
            )}
          </div>
        </>
      )}

      <input ref={versionInput} type="file" hidden onChange={e => {
        const f = e.target.files?.[0]
        if (f && versionTarget.current) upload(f, versionTarget.current.versionGroup)
        e.target.value = ''
      }} />

      {/* New folder modal */}
      <Modal open={folderModal} onClose={() => setFolderModal(false)} title={t['dam.newFolder']} width={460}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div><label className="label">{t['dam.folderName']}</label><input className="input" value={folderName} onChange={e => setFolderName(e.target.value)} /></div>
          {!currentFolder && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div>
                <label className="label">{t['dam.linkCustomer']}</label>
                <select className="input" value={folderCustomer} onChange={e => setFolderCustomer(e.target.value)}>
                  <option value="">—</option>
                  {customers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">{t['dam.linkProject']}</label>
                <select className="input" value={folderProject} onChange={e => setFolderProject(e.target.value)}>
                  <option value="">—</option>
                  {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setFolderModal(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={createFolder} disabled={!folderName.trim()}>{t.save}</button>
          </div>
        </div>
      </Modal>

      {/* Version history modal */}
      <Modal open={!!historyFile} onClose={() => setHistoryFile(null)} title={historyFile ? `${t['dam.versions']} — ${historyFile.fileName}` : ''} width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {history.map(h => (
            <div key={h._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0.55rem 0.75rem', border: '1px solid var(--border-1)', borderRadius: 8 }}>
              <span style={{ fontSize: '0.82rem' }}>
                <span className="pill pill-info" style={{ marginInlineEnd: 8 }}>v{h.version}</span>
                <span className="ltr-num" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--fg-4)' }}>
                  {fmtSize(h.sizeBytes)} · {new Date(h.createdAt).toLocaleString(isAr ? 'ar-u-ca-gregory' : 'en', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </span>
              <a className="btn btn-secondary" href={`/api/attachments/${h._id}`} style={{ padding: '0.25rem 0.6rem', fontSize: '0.7rem', textDecoration: 'none' }}>⬇</a>
            </div>
          ))}
          {history.length === 0 && <LoadingSpinner />}
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={async () => {
        await fetch(`/api/attachments/${deleteTarget._id}`, { method: 'DELETE' })
        setDeleteTarget(null); fetchAll()
      }} title={t['dam.deleteFile']} message={`"${deleteTarget?.fileName}" — ${t['support.cannotUndo']}`} loading={false} />

      <ConfirmModal open={!!deleteFolderTarget} onClose={() => setDeleteFolderTarget(null)} onConfirm={async () => {
        await fetch(`/api/dam/folders/${deleteFolderTarget._id}`, { method: 'DELETE' })
        setDeleteFolderTarget(null); fetchAll()
      }} title={t['dam.deleteFolder']} message={`"${deleteFolderTarget?.name}" — ${t['dam.deleteFolderNote']}`} loading={false} />
    </div>
  )
}
