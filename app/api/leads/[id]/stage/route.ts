import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

const STAGES = ['new', 'contacted', 'meeting_scheduled', 'proposal_sent', 'negotiation', 'won', 'lost']

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'leads.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { stage, lostReason } = await req.json()
  if (!STAGES.includes(stage)) return Response.json({ success: false, message: 'Invalid stage' }, { status: 400 })

  const { data: lead } = await supabase.from('leads').select('id, stage').eq('id', params.id).single()
  if (!lead) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  const updates: any = { stage, position: Date.now() }
  if (stage === 'won') updates.won_at = new Date().toISOString()
  if (stage === 'lost') {
    updates.lost_at = new Date().toISOString()
    if (lostReason) updates.lost_reason = lostReason
  }

  const { data, error } = await supabase.from('leads').update(updates).eq('id', params.id)
    .select('*, assignee:employees(id,name)').single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  await logActivity({
    entityType: 'lead', entityId: params.id, action: 'stage_changed',
    detail: { from: lead.stage, to: stage }, user,
  })
  return Response.json({ success: true, data: toApi(data) })
}
