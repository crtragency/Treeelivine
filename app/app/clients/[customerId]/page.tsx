'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ActivityTimeline from '@/components/entity/ActivityTimeline'
import NotesPanel from '@/components/entity/NotesPanel'
import AttachmentsPanel from '@/components/entity/AttachmentsPanel'

const TABS = ['overview', 'projects', 'quotations', 'invoices', 'contracts', 'files', 'activity', 'internalNotes'] as const
type Tab = typeof TABS[number]

const STATUSES = ['lead', 'prospect', 'negotiation', 'active', 'inactive', 'churned']
const PRIORITIES = ['low', 'medium', 'high', 'urgent']
const CONTRACT_STATUSES = ['draft', 'sent', 'signed', 'expired', 'cancelled']

function Field({ label, value, ltr }: { label: string; value?: any; ltr?: boolean }) {
  return (
    <div>
      <div className="label" style={{ marginBottom: 2 }}>{label}</div>
      <div className={ltr ? 'ltr-num' : undefined} style={{ fontSize: 'var(--fs-base)', color: value ? 'var(--fg-1)' : 'var(--fg-5)' }}>
        {value || '—'}
      </div>
    </div>
  )
}

export default function CustomerProfilePage() {
  const { customerId } = useParams<{ customerId: string }>()
  const { t, lang, hasPermission, settings } = useApp()
  const isAr = lang === 'ar'
  const cur = settings?.defaultCurrency || 'SAR'

  const [tab, setTab] = useState<Tab>('overview')
  const [customer, setCustomer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tabData, setTabData] = useState<Record<string, any[]>>({})
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  // contracts modal
  const [contractOpen, setContractOpen] = useState(false)
  const [contractForm, setContractForm] = useState<any>({})
  const [contractEditing, setContractEditing] = useState<any>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/customers/${customerId}`)
    const data = await res.json()
    if (data.success) setCustomer(data.data)
    setLoading(false)
  }, [customerId])

  useEffect(() => { load() }, [load])

  const loadTab = useCallback(async (which: Tab) => {
    const endpoints: Partial<Record<Tab, string>> = {
      projects: `/api/projects?customerId=${customerId}`,
      quotations: `/api/quotations?customerId=${customerId}`,
      invoices: `/api/invoices?customerId=${customerId}`,
      contracts: `/api/contracts?customerId=${customerId}`,
    }
    const url = endpoints[which]
    if (!url) return
    const res = await fetch(url)
    const data = await res.json()
    if (data.success) setTabData(p => ({ ...p, [which]: data.data }))
  }, [customerId])

  useEffect(() => { loadTab(tab) }, [tab, loadTab])

  function openEdit() {
    setForm({ ...customer, tags: (customer.tags || []).join(', ') })
    setEditOpen(true)
  }

  async function saveProfile() {
    setSaving(true)
    const body = { ...form, tags: String(form.tags || '').split(',').map((s: string) => s.trim()).filter(Boolean) }
    const res = await fetch(`/api/customers/${customerId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.success) { setEditOpen(false); load() }
    setSaving(false)
  }

  async function saveContract() {
    setSaving(true)
    const url = contractEditing ? `/api/contracts/${contractEditing._id}` : '/api/contracts'
    const res = await fetch(url, {
      method: contractEditing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...contractForm, customerId }),
    })
    const data = await res.json()
    if (data.success) { setContractOpen(false); loadTab('contracts') }
    setSaving(false)
  }

  const fmt = (n: number) => (n || 0).toLocaleString('en-US')
  const dstr = (d?: string) => d ? new Date(d).toLocaleDateString(isAr ? 'ar-u-ca-gregory' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
  const tp = (k: string) => t[`crmProfile.${k}`] || k

  if (loading) return <LoadingSpinner />
  if (!customer) return <div className="page-content"><p style={{ color: 'var(--fg-4)' }}>Not found</p></div>

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="av av-lg">{(customer.name || '?')[0]}</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1>{customer.name}</h1>
              <StatusBadge status={customer.status || 'lead'} />
              <StatusBadge status={customer.priority || 'medium'} />
            </div>
            <div className="sub">
              <Link href="/app/clients" style={{ color: 'var(--fg-link)' }}>{tp('backToClients')}</Link>
              {customer.company ? ` · ${customer.company}` : ''}
              {(customer.tags || []).length > 0 && ` · ${(customer.tags || []).join(' · ')}`}
            </div>
          </div>
        </div>
        <div className="actions">
          {hasPermission('crm.write') && <button className="btn btn-secondary" onClick={openEdit}>{tp('editProfile')}</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="seg">
        {TABS.map(tb => (
          <button key={tb} className={tab === tb ? 'on' : ''} onClick={() => setTab(tb)}>{tp(tb)}</button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="card-surface" style={{ padding: 'var(--space-6)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-5)' }}>
            <Field label={t.company} value={customer.company} />
            <Field label={tp('contactPerson')} value={customer.contactPerson} />
            <Field label={t.email} value={customer.email} ltr />
            <Field label={t.phone} value={customer.phone} ltr />
            <Field label={tp('whatsapp')} value={customer.whatsapp} ltr />
            <Field label={tp('industry')} value={customer.industry} />
            <Field label={tp('country')} value={customer.country} />
            <Field label={tp('address')} value={customer.address} />
            <Field label={tp('website')} value={customer.website} ltr />
            <Field label={tp('taxNumber')} value={customer.taxNumber} ltr />
            <Field label={t.createdAt} value={dstr(customer.createdAt)} />
          </div>
          {customer.notes && (
            <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-1)' }}>
              <div className="label" style={{ marginBottom: 4 }}>{t.notes}</div>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{customer.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Projects ── */}
      {tab === 'projects' && (
        <div className="card-surface table-scroll">
          <table className="t-table">
            <thead><tr><th>{t.project}</th><th>{t.status}</th><th>{t.dueDate}</th><th></th></tr></thead>
            <tbody>
              {(tabData.projects || []).map(p => (
                <tr key={p._id}>
                  <td className="td-name">{p.name}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td style={{ color: 'var(--fg-3)' }}>{dstr(p.dueDate)}</td>
                  <td style={{ textAlign: 'end' }}><Link href={`/app/projects/${p._id}/brief`} className="btn btn-ghost btn-sm">{t.brief}</Link></td>
                </tr>
              ))}
              {!(tabData.projects || []).length && <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--fg-4)' }}>{t.noProjects}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Quotations ── */}
      {tab === 'quotations' && (
        <div className="card-surface table-scroll">
          <table className="t-table">
            <thead><tr><th>#</th><th>{t.status}</th><th style={{ textAlign: 'end' }}>{t.amount}</th><th>{t.date}</th></tr></thead>
            <tbody>
              {(tabData.quotations || []).map(q => (
                <tr key={q._id}>
                  <td className="td-name ltr-num">{q.quoteNumber}</td>
                  <td><StatusBadge status={q.status} /></td>
                  <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)' }}>{q.currency} {fmt(q.total)}</td>
                  <td style={{ color: 'var(--fg-3)' }}>{dstr(q.createdAt)}</td>
                </tr>
              ))}
              {!(tabData.quotations || []).length && <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--fg-4)' }}>—</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Invoices ── */}
      {tab === 'invoices' && (
        <div className="card-surface table-scroll">
          <table className="t-table">
            <thead><tr><th>#</th><th>{t.status}</th><th style={{ textAlign: 'end' }}>{t.amount}</th><th style={{ textAlign: 'end' }}>{t.paidAmount}</th><th></th></tr></thead>
            <tbody>
              {(tabData.invoices || []).map(inv => (
                <tr key={inv._id}>
                  <td className="td-name ltr-num">{inv.invoiceNumber}</td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)' }}>{inv.currency} {fmt(inv.amount)}</td>
                  <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)', color: 'var(--success-600)' }}>{inv.currency} {fmt(inv.paidAmount)}</td>
                  <td style={{ textAlign: 'end' }}><Link href={`/app/finance/invoices/${inv._id}/pdf`} className="btn btn-ghost btn-sm">PDF</Link></td>
                </tr>
              ))}
              {!(tabData.invoices || []).length && <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--fg-4)' }}>—</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Contracts ── */}
      {tab === 'contracts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {hasPermission('contracts.write') && (
            <div>
              <button className="btn btn-primary" onClick={() => { setContractForm({ status: 'draft', currency: cur }); setContractEditing(null); setContractOpen(true) }}>
                + {t['contractsPage.addContract']}
              </button>
            </div>
          )}
          <div className="card-surface table-scroll">
            <table className="t-table">
              <thead><tr><th>#</th><th>{t['contractsPage.contractTitle']}</th><th>{t.status}</th><th style={{ textAlign: 'end' }}>{t['contractsPage.contractValue']}</th><th>{t['contractsPage.startDate']}</th><th>{t['contractsPage.endDate']}</th><th></th></tr></thead>
              <tbody>
                {(tabData.contracts || []).map(c => (
                  <tr key={c._id}>
                    <td className="td-name ltr-num">{c.contractNumber}</td>
                    <td>{c.title}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="ltr-num" style={{ textAlign: 'end', fontFamily: 'var(--font-mono)' }}>{c.currency} {fmt(c.value)}</td>
                    <td style={{ color: 'var(--fg-3)' }}>{dstr(c.startDate)}</td>
                    <td style={{ color: 'var(--fg-3)' }}>{dstr(c.endDate)}</td>
                    <td style={{ textAlign: 'end' }}>
                      {hasPermission('contracts.write') && (
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          setContractForm({ ...c, startDate: c.startDate?.substring(0, 10) || '', endDate: c.endDate?.substring(0, 10) || '' })
                          setContractEditing(c); setContractOpen(true)
                        }}>{t.edit}</button>
                      )}
                    </td>
                  </tr>
                ))}
                {!(tabData.contracts || []).length && <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--fg-4)' }}>{t['contractsPage.noContracts']}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Files / Activity / Notes ── */}
      {tab === 'files' && (
        <div className="card-surface" style={{ padding: 'var(--space-5)' }}>
          <AttachmentsPanel entityType="customer" entityId={customerId} />
        </div>
      )}
      {tab === 'activity' && (
        <div className="card-surface" style={{ padding: '4px var(--space-5) var(--space-4)' }}>
          <ActivityTimeline entityType="customer" entityId={customerId} />
        </div>
      )}
      {tab === 'internalNotes' && (
        <div className="card-surface" style={{ padding: 'var(--space-5)' }}>
          <NotesPanel entityType="customer" entityId={customerId} />
        </div>
      )}

      {/* ── Edit profile modal ── */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={tp('editProfile')} width={640}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div><label className="label">{t.name} *</label><input className="input" value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} /></div>
            <div><label className="label">{t.company}</label><input className="input" value={form.company || ''} onChange={e => setForm((p: any) => ({ ...p, company: e.target.value }))} /></div>
            <div><label className="label">{tp('contactPerson')}</label><input className="input" value={form.contactPerson || ''} onChange={e => setForm((p: any) => ({ ...p, contactPerson: e.target.value }))} /></div>
            <div><label className="label">{t.email}</label><input className="input" value={form.email || ''} onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} /></div>
            <div><label className="label">{t.phone}</label><input className="input" value={form.phone || ''} onChange={e => setForm((p: any) => ({ ...p, phone: e.target.value }))} /></div>
            <div><label className="label">{tp('whatsapp')}</label><input className="input" value={form.whatsapp || ''} onChange={e => setForm((p: any) => ({ ...p, whatsapp: e.target.value }))} /></div>
            <div><label className="label">{tp('industry')}</label><input className="input" value={form.industry || ''} onChange={e => setForm((p: any) => ({ ...p, industry: e.target.value }))} /></div>
            <div><label className="label">{tp('country')}</label><input className="input" value={form.country || ''} onChange={e => setForm((p: any) => ({ ...p, country: e.target.value }))} /></div>
            <div><label className="label">{tp('website')}</label><input className="input" value={form.website || ''} onChange={e => setForm((p: any) => ({ ...p, website: e.target.value }))} /></div>
            <div><label className="label">{tp('taxNumber')}</label><input className="input" value={form.taxNumber || ''} onChange={e => setForm((p: any) => ({ ...p, taxNumber: e.target.value }))} /></div>
            <div>
              <label className="label">{t.status}</label>
              <select className="input" value={form.status || 'lead'} onChange={e => setForm((p: any) => ({ ...p, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.priority}</label>
              <select className="input" value={form.priority || 'medium'} onChange={e => setForm((p: any) => ({ ...p, priority: e.target.value }))}>
                {PRIORITIES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">{tp('address')}</label><input className="input" value={form.address || ''} onChange={e => setForm((p: any) => ({ ...p, address: e.target.value }))} /></div>
          <div>
            <label className="label">{tp('tags')}</label>
            <input className="input" value={form.tags || ''} placeholder={tp('tagsHint')} onChange={e => setForm((p: any) => ({ ...p, tags: e.target.value }))} />
          </div>
          <div><label className="label">{t.notes}</label><textarea className="input" rows={2} value={form.notes || ''} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setEditOpen(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>{saving ? '…' : t.save}</button>
          </div>
        </div>
      </Modal>

      {/* ── Contract modal ── */}
      <Modal open={contractOpen} onClose={() => setContractOpen(false)} title={contractEditing ? t['contractsPage.editContract'] : t['contractsPage.addContract']} width={620}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div><label className="label">{t['contractsPage.contractTitle']} *</label><input className="input" value={contractForm.title || ''} onChange={e => setContractForm((p: any) => ({ ...p, title: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="label">{t.status}</label>
              <select className="input" value={contractForm.status || 'draft'} onChange={e => setContractForm((p: any) => ({ ...p, status: e.target.value }))}>
                {CONTRACT_STATUSES.map(s => <option key={s} value={s}>{t[`status.${s}`] || s}</option>)}
              </select>
            </div>
            <div><label className="label">{t['contractsPage.contractValue']}</label><input className="input" type="number" value={contractForm.value ?? ''} onChange={e => setContractForm((p: any) => ({ ...p, value: Number(e.target.value) }))} /></div>
            <div><label className="label">{t.currency}</label><input className="input" value={contractForm.currency || cur} onChange={e => setContractForm((p: any) => ({ ...p, currency: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div><label className="label">{t['contractsPage.startDate']}</label><input className="input" type="date" value={contractForm.startDate || ''} onChange={e => setContractForm((p: any) => ({ ...p, startDate: e.target.value }))} /></div>
            <div><label className="label">{t['contractsPage.endDate']}</label><input className="input" type="date" value={contractForm.endDate || ''} onChange={e => setContractForm((p: any) => ({ ...p, endDate: e.target.value }))} /></div>
          </div>
          <div><label className="label">{t['contractsPage.contractBody']}</label><textarea className="input" rows={4} value={contractForm.body || ''} onChange={e => setContractForm((p: any) => ({ ...p, body: e.target.value }))} /></div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setContractOpen(false)}>{t.cancel}</button>
            <button className="btn btn-primary" onClick={saveContract} disabled={saving}>{saving ? '…' : t.save}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
