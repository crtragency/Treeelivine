'use client'
import { useState, useEffect } from 'react'
import { useApp } from '@/contexts/AppContext'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type Tab = 'general' | 'permissions' | 'users' | 'currencies'

const ROLES = [
  { value: 'admin',   label: 'Admin',   color: '#e53e3e', bg: '#fff5f5' },
  { value: 'manager', label: 'Manager', color: '#805ad5', bg: '#faf5ff' },
  { value: 'team',    label: 'Team',    color: '#3182ce', bg: '#ebf8ff' },
  { value: 'finance', label: 'Finance', color: '#d69e2e', bg: '#fffff0' },
  { value: 'viewer',  label: 'Viewer',  color: '#718096', bg: '#f7fafc' },
  { value: 'client',  label: 'Client',  color: '#38a169', bg: '#f0fff4' },
]

function roleMeta(role: string) {
  return ROLES.find(r => r.value === role) || { value: role, label: role, color: '#718096', bg: '#f7fafc' }
}

function RoleBadge({ role }: { role: string }) {
  const m = roleMeta(role)
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 10px', borderRadius: 20, color: m.color, background: m.bg, border: `1px solid ${m.color}30` }}>
      {m.label}
    </span>
  )
}

const BLANK_FORM = { name: '', email: '', password: '', role: 'team' }

function UserModal({ user, onClose, onSave }: {
  user: any | null  // null = create, object = edit
  onClose: () => void
  onSave: () => void
}) {
  const isEdit = !!user
  const [form, setForm] = useState(isEdit
    ? { name: user.name || '', email: user.email || '', password: '', role: user.role || 'staff' }
    : { ...BLANK_FORM }
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit() {
    setErr('')
    if (!form.name.trim()) { setErr('Name is required'); return }
    if (!form.email.trim()) { setErr('Email is required'); return }
    if (!isEdit && !form.password.trim()) { setErr('Password is required'); return }

    setSaving(true)
    const body: any = { name: form.name, email: form.email, role: form.role }
    if (form.password) body.password = form.password

    const res = await fetch(
      isEdit ? `/api/users/${user._id}` : '/api/users',
      { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    )
    const data = await res.json()
    setSaving(false)
    if (!data.success) { setErr(data.message || 'Error'); return }
    onSave()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{isEdit ? 'Edit User' : 'Add Team Member'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ahmed Mohamed" />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="ahmed@company.com" disabled={isEdit} style={isEdit ? { opacity: 0.6 } : {}} />
          </div>
          <div>
            <label className="label">{isEdit ? 'New Password (leave blank to keep)' : 'Password'}</label>
            <input className="input" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder={isEdit ? '••••••••' : 'Min 6 characters'} />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="input" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
              {form.role === 'admin' && 'Full access to everything'}
              {form.role === 'manager' && 'Broad access: CRM, projects, tasks, team'}
              {form.role === 'team' && 'Access to projects and tasks'}
              {form.role === 'finance' && 'Access to finance, projects, and tasks'}
              {form.role === 'viewer' && 'Read-only access to CRM, projects, tasks'}
              {form.role === 'client' && 'Client portal access only'}
            </p>
          </div>

          {err && <p style={{ fontSize: '0.85rem', color: 'var(--danger)', background: 'var(--danger-soft,#fff5f5)', borderRadius: 8, padding: '8px 12px' }}>{err}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving} style={{ flex: 2 }}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { t, hasPermission, settings: appSettings, setSettings } = useApp()
  const [tab, setTab] = useState<Tab>('general')
  const [settings, setLocalSettings] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userModal, setUserModal] = useState<{ open: boolean; user: any | null }>({ open: false, user: null })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([s, u]) => {
      if (s.success) setLocalSettings(s.data)
      if (u.success) setUsers(u.data)
      setLoading(false)
    })
  }, [])

  async function refreshUsers() {
    const res = await fetch('/api/users')
    const data = await res.json()
    if (data.success) setUsers(data.data)
  }

  async function saveSettings() {
    setSaving(true)
    const res = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    const data = await res.json()
    if (data.success && setSettings) setSettings(data.data)
    setSaving(false)
  }

  async function toggleActive(u: any) {
    await fetch(`/api/users/${u._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !u.isActive }) })
    refreshUsers()
  }

  async function deleteUser(id: string) {
    await fetch(`/api/users/${id}`, { method: 'DELETE' })
    setDeleteConfirm(null)
    refreshUsers()
  }

  async function updateUserPermissions(userId: string, effectivePermissions: string[]) {
    await fetch(`/api/users/${userId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ effectivePermissions }) })
    refreshUsers()
  }

  if (loading) return <LoadingSpinner />

  const TABS: Tab[] = ['general', 'currencies', 'users', 'permissions']
  const TAB_LABELS: Record<Tab, string> = {
    general: t['settingsPage.general'] || 'General',
    currencies: t['settingsPage.currencies'] || 'Currencies',
    users: t['settingsPage.users'] || 'Users',
    permissions: t['settingsPage.permissions'] || 'Permissions',
  }
  const ALL_PERMISSIONS = ['crm.read', 'crm.write', 'projects.read', 'projects.write', 'tasks.read', 'tasks.write', 'team.read', 'team.write', 'finance.read', 'finance.write', 'templates.read', 'templates.write', 'settings.read', 'settings.write']

  const canWrite = hasPermission('settings.write')

  return (
    <div className="page-content">
      <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 600, color: 'var(--fg-1)', letterSpacing: '-0.01em', marginBottom: '1.5rem' }}>{t.settings || 'Settings'}</h2>

      <div className="seg" style={{ marginBottom: '1.5rem' }}>
        {TABS.map(tb => (
          <button key={tb} className={tab === tb ? 'on' : ''} onClick={() => setTab(tb)}>
            {(t as any)[tb] || tb}
          </button>
        ))}
      </div>

      {tab === 'general' && settings && (
        <div className="card" style={{ maxWidth: 560 }}>
          <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>{t['settingsPage.generalSettings'] || 'General Settings'}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div><label className="label">{t['settingsPage.companyName'] || 'Company Name'}</label><input className="input" value={settings.companyName || ''} onChange={e => setLocalSettings((p: any) => ({ ...p, companyName: e.target.value }))} /></div>
            <div><label className="label">{t['settingsPage.companyAddress'] || 'Company Address'}</label><textarea className="input" value={settings.companyAddress || ''} onChange={e => setLocalSettings((p: any) => ({ ...p, companyAddress: e.target.value }))} rows={2} /></div>
            <div><label className="label">{t['settingsPage.defaultCurrency'] || 'Default Currency'}</label>
              <input className="input" value={settings.defaultCurrency || ''} onChange={e => setLocalSettings((p: any) => ({ ...p, defaultCurrency: e.target.value }))} placeholder="SAR" />
            </div>
            <div><label className="label">{t['settingsPage.taxRate'] || 'Tax Rate (%)'}</label><input className="input" type="number" value={settings.defaultTaxRate || ''} onChange={e => setLocalSettings((p: any) => ({ ...p, defaultTaxRate: Number(e.target.value) }))} /></div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="checkbox" id="demoMode" checked={!!settings.demoMode} onChange={e => setLocalSettings((p: any) => ({ ...p, demoMode: e.target.checked })) } />
              <label htmlFor="demoMode" style={{ fontSize: '0.875rem' }}>{t['settingsPage.demoMode'] || 'Demo Mode'}</label>
            </div>
            <button className="btn btn-primary" onClick={saveSettings} disabled={saving} style={{ width: 'fit-content' }}>{saving ? (t.saving || 'Saving…') : (t.saveChanges || 'Save Changes')}</button>
          </div>
        </div>
      )}

      {tab === 'currencies' && settings && (
        <div className="card" style={{ maxWidth: 560 }}>
          <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Currencies</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {(settings.currencies || []).map((c: any, i: number) => (
              <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <input className="input" value={c.code || ''} placeholder="USD" onChange={e => {
                  const arr = [...settings.currencies]; arr[i] = { ...arr[i], code: e.target.value }
                  setLocalSettings((p: any) => ({ ...p, currencies: arr }))
                }} style={{ width: 80 }} />
                <input className="input" value={c.name || ''} placeholder="US Dollar" onChange={e => {
                  const arr = [...settings.currencies]; arr[i] = { ...arr[i], name: e.target.value }
                  setLocalSettings((p: any) => ({ ...p, currencies: arr }))
                }} />
                <input className="input" type="number" value={c.rate || 1} placeholder="Rate" onChange={e => {
                  const arr = [...settings.currencies]; arr[i] = { ...arr[i], rate: Number(e.target.value) }
                  setLocalSettings((p: any) => ({ ...p, currencies: arr }))
                }} style={{ width: 100 }} />
                <button className="btn btn-danger" onClick={() => setLocalSettings((p: any) => ({ ...p, currencies: settings.currencies.filter((_: any, j: number) => j !== i) }))} style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={() => setLocalSettings((p: any) => ({ ...p, currencies: [...(settings.currencies || []), { code: '', name: '', rate: 1 }] }))}>+ Add Currency</button>
            <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>{saving ? '...' : 'Save'}</button>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <p style={{ fontWeight: 600 }}>Team Members</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{users.length} user{users.length !== 1 ? 's' : ''}</p>
            </div>
            {canWrite && (
              <button className="btn btn-primary" onClick={() => setUserModal({ open: true, user: null })} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M8.5 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6" />
                </svg>
                Add User
              </button>
            )}
          </div>

          {/* Role legend */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {ROLES.map(r => <RoleBadge key={r.value} role={r.value} />)}
          </div>

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="t-table">
              <thead>
                <tr>
                  {['User', 'Role', 'Status', 'Actions'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: roleMeta(u.role).bg, color: roleMeta(u.role).color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0, border: `1px solid ${roleMeta(u.role).color}30` }}>
                          {(u.name || u.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.name || '—'}</p>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td><RoleBadge role={u.role} /></td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.82rem', fontWeight: 500, color: u.isActive ? '#38a169' : '#e53e3e' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: u.isActive ? '#38a169' : '#e53e3e', display: 'inline-block' }} />
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {canWrite && (
                          <>
                            <button className="btn btn-secondary" onClick={() => setUserModal({ open: true, user: u })} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                              Edit
                            </button>
                            <button className="btn btn-secondary" onClick={() => toggleActive(u)} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            {u.role !== 'admin' && (
                              <button className="btn btn-danger" onClick={() => setDeleteConfirm(u._id)} style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem' }}>
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No users yet. Add your first team member.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'permissions' && (
        <div className="card" style={{ overflowX: 'auto' }}>
          <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>User Permissions</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Admins always have full access. Configure what each non-admin user can see and do.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'start', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, width: 160 }}>User</th>
                {ALL_PERMISSIONS.map(p => (
                  <th key={p} style={{ padding: '0.5rem 0.25rem', fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center', writingMode: 'vertical-lr', height: 80 }}>{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.filter(u => u.role !== 'admin').map(u => (
                <tr key={u._id}>
                  <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    <p style={{ fontWeight: 500 }}>{u.name || u.email}</p>
                    <div style={{ marginTop: 4 }}><RoleBadge role={u.role} /></div>
                  </td>
                  {ALL_PERMISSIONS.map(perm => {
                    const has = (u.effectivePermissions || []).includes(perm)
                    return (
                      <td key={perm} style={{ textAlign: 'center', padding: '0.5rem 0.25rem' }}>
                        <input type="checkbox" checked={has} onChange={e => {
                          const current = u.effectivePermissions || []
                          const next = e.target.checked ? [...current, perm] : current.filter((x: string) => x !== perm)
                          updateUserPermissions(u._id, next)
                        }} />
                      </td>
                    )
                  })}
                </tr>
              ))}
              {users.filter(u => u.role !== 'admin').length === 0 && (
                <tr><td colSpan={ALL_PERMISSIONS.length + 1} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No non-admin users to configure.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {userModal.open && (
        <UserModal
          user={userModal.user}
          onClose={() => setUserModal({ open: false, user: null })}
          onSave={() => { setUserModal({ open: false, user: null }); refreshUsers() }}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: 8 }}>Delete User?</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 20 }}>This action cannot be undone. The user will lose all access.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteUser(deleteConfirm)} style={{ flex: 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
