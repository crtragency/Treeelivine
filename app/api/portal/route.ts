import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role !== 'client') {
    return Response.json({ success: false, message: 'Forbidden' }, { status: 403 })
  }

  const { data: customer } = await supabase.from('customers').select('*').eq('user_id', user.id).single()
  if (!customer) {
    return Response.json({
      success: true,
      data: { customer: { name: user.name || user.email }, projects: [], invoices: [], quotations: [], contracts: [], files: [], activity: [] },
    })
  }

  const [{ data: projects }, { data: invoices }, { data: quotations }, { data: contracts }] = await Promise.all([
    supabase.from('projects').select('*').eq('customer_id', customer.id).order('updated_at', { ascending: false }),
    supabase.from('invoices').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }),
    supabase.from('quotations').select('id, quote_number, status, currency, total, valid_until, public_token, created_at').eq('customer_id', customer.id).order('created_at', { ascending: false }),
    supabase.from('contracts').select('id, contract_number, title, status, value, currency, start_date, end_date, signed_at, created_at').eq('customer_id', customer.id).order('created_at', { ascending: false }),
  ])

  const projectIds = (projects || []).map(p => p.id)
  const contractIds = (contracts || []).map(c => c.id)
  const invoiceIds = (invoices || []).map(i => i.id)
  const quoteIds = (quotations || []).map(q => q.id)

  // client-visible files on the customer or any of their projects/contracts/invoices
  const { data: allFiles } = await supabase.from('attachments').select('*').eq('client_visible', true)
  const files = (allFiles || []).filter(f =>
    (f.entity_type === 'customer' && f.entity_id === customer.id) ||
    (f.entity_type === 'project' && projectIds.includes(f.entity_id)) ||
    (f.entity_type === 'contract' && contractIds.includes(f.entity_id)) ||
    (f.entity_type === 'invoice' && invoiceIds.includes(f.entity_id))
  )

  // activity across everything the client owns
  const { data: allActivity } = await supabase.from('activities').select('*')
    .order('created_at', { ascending: false }).limit(300)
  const activity = (allActivity || []).filter(a =>
    (a.entity_type === 'customer' && a.entity_id === customer.id) ||
    (a.entity_type === 'project' && projectIds.includes(a.entity_id)) ||
    (a.entity_type === 'contract' && contractIds.includes(a.entity_id)) ||
    (a.entity_type === 'invoice' && invoiceIds.includes(a.entity_id)) ||
    (a.entity_type === 'quotation' && quoteIds.includes(a.entity_id))
  ).filter(a => a.action !== 'note_added').slice(0, 30)

  return Response.json({
    success: true,
    data: {
      customer: toApi(customer),
      projects: toApi(projects || []),
      invoices: toApi(invoices || []),
      quotations: toApi(quotations || []),
      contracts: toApi(contracts || []),
      files: toApi(files),
      activity: toApi(activity),
    },
  })
}
