import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

/** Mark a quotation as sent and return its public share URL. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { data: quote } = await supabase.from('quotations').select('id, status, public_token').eq('id', params.id).single()
  if (!quote) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  const updates: any = {}
  if (['draft', 'expired'].includes(quote.status)) updates.status = 'sent'

  let updated = quote
  if (Object.keys(updates).length) {
    const { data, error } = await supabase.from('quotations').update(updates).eq('id', params.id).select().single()
    if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
    updated = data
    await logActivity({ entityType: 'quotation', entityId: params.id, action: 'sent', user })
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  return Response.json({
    success: true,
    data: { ...toApi(updated), shareUrl: `${base}/q/${quote.public_token}` },
  })
}
