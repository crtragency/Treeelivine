import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

/** Mark a contract as sent for signature and return its public signing URL. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'contracts.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json().catch(() => ({}))

  const { data: contract } = await supabase.from('contracts')
    .select('id, status, public_token').eq('id', params.id).single()
  if (!contract) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  const updates: any = {}
  if (['draft', 'pending_approval', 'expired'].includes(contract.status)) updates.status = 'sent'
  if (body.signerEmail) updates.signer_email = body.signerEmail

  let updated: any = contract
  if (Object.keys(updates).length) {
    const { data, error } = await supabase.from('contracts').update(updates).eq('id', params.id).select().single()
    if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
    updated = data
    if (updates.status) await logActivity({ entityType: 'contract', entityId: params.id, action: 'sent', user })
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  return Response.json({
    success: true,
    data: { ...toApi(updated), shareUrl: `${base}/c/${contract.public_token}` },
  })
}
