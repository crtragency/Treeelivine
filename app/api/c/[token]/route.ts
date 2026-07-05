import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

/** Public contract-signing endpoint — the unguessable token IS the capability.
 *  No session required; only share-safe fields are returned. */
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const { data: contract } = await supabase.from('contracts')
    .select('id, contract_number, title, status, value, currency, start_date, end_date, body, signed_at, signed_by_name, created_at, customer:customers(name,company)')
    .eq('public_token', params.token).single()
  if (!contract) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  if (contract.status === 'draft') return Response.json({ success: false, message: 'Not available' }, { status: 404 })

  const { data: settings } = await supabase.from('settings').select('company_name, company_address').limit(1).single()

  return Response.json({
    success: true,
    data: { ...toApi(contract), company: { name: settings?.company_name || 'Treeelivine', address: settings?.company_address || null } },
  })
}

/** Client signs the contract with their name (+ optional drawn signature). */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const { name, email, signatureData } = await req.json()
  if (!name) return Response.json({ success: false, message: 'Name is required' }, { status: 400 })

  const { data: contract } = await supabase.from('contracts')
    .select('id, status, end_date').eq('public_token', params.token).single()
  if (!contract || contract.status === 'draft') return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  if (['signed', 'active'].includes(contract.status)) {
    return Response.json({ success: false, message: 'Already signed' }, { status: 409 })
  }
  if (['expired', 'cancelled', 'renewed'].includes(contract.status)) {
    return Response.json({ success: false, message: 'Contract is no longer open for signing' }, { status: 410 })
  }

  const { data, error } = await supabase.from('contracts').update({
    status: 'signed',
    signed_at: new Date().toISOString(),
    signed_by_name: name,
    signer_email: email || null,
    signature_data: signatureData || null,
  }).eq('id', contract.id).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  await logActivity({ entityType: 'contract', entityId: contract.id, action: 'signed', detail: { by: name } })
  return Response.json({ success: true, data: toApi(data) })
}
