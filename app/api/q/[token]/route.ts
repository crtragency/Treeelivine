import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

/** Public proposal endpoint — the unguessable token IS the capability.
 *  No session required; only share-safe fields are returned. */
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const { data: quote } = await supabase.from('quotations')
    .select('id, quote_number, status, currency, items, subtotal, tax_rate, tax_amount, discount_type, discount_value, total, valid_until, notes, viewed_at, responded_at, accepted_by_name, created_at, customer:customers(name,company)')
    .eq('public_token', params.token).single()
  if (!quote) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  if (quote.status === 'draft') return Response.json({ success: false, message: 'Not available' }, { status: 404 })

  // first open marks it viewed
  if (quote.status === 'sent') {
    await supabase.from('quotations')
      .update({ status: 'viewed', viewed_at: quote.viewed_at || new Date().toISOString() })
      .eq('id', quote.id)
    await logActivity({ entityType: 'quotation', entityId: quote.id, action: 'viewed' })
    ;(quote as any).status = 'viewed'
  }

  // fetch company branding
  const { data: settings } = await supabase.from('settings').select('company_name, company_address').limit(1).single()

  return Response.json({
    success: true,
    data: { ...toApi(quote), company: { name: settings?.company_name || 'Treeelivine', address: settings?.company_address || null } },
  })
}

/** Client responds: accept or reject, with their name. */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const { action, name } = await req.json()
  if (!['accept', 'reject'].includes(action)) {
    return Response.json({ success: false, message: 'Invalid action' }, { status: 400 })
  }

  const { data: quote } = await supabase.from('quotations')
    .select('id, status, valid_until').eq('public_token', params.token).single()
  if (!quote || quote.status === 'draft') return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  if (['accepted', 'rejected'].includes(quote.status)) {
    return Response.json({ success: false, message: 'Already responded' }, { status: 409 })
  }
  if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
    await supabase.from('quotations').update({ status: 'expired' }).eq('id', quote.id)
    return Response.json({ success: false, message: 'Quotation expired' }, { status: 410 })
  }

  const status = action === 'accept' ? 'accepted' : 'rejected'
  const { data, error } = await supabase.from('quotations').update({
    status,
    responded_at: new Date().toISOString(),
    accepted_by_name: name || null,
  }).eq('id', quote.id).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  await logActivity({ entityType: 'quotation', entityId: quote.id, action: status, detail: { by: name || 'client' } })
  return Response.json({ success: true, data: toApi(data) })
}
