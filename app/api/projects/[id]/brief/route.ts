import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

async function clientOwnsProject(userId: string, customerId: string | null) {
  if (!customerId) return false
  const { data: customer } = await supabase.from('customers').select('user_id').eq('id', customerId).single()
  return customer?.user_id === userId
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()

  const { data } = await supabase.from('projects')
    .select('id, brief, brief_status, brief_comments, name, customer_id, customer:customers(id,name,email)')
    .eq('id', params.id).single()
  if (!data) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  if (user.role === 'client' && !(await clientOwnsProject(user.id, (data as any).customer_id))) {
    return forbiddenResponse()
  }

  return Response.json({ success: true, data: toApi(data) })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()

  const { data: project } = await supabase.from('projects')
    .select('id, customer_id').eq('id', params.id).single()
  if (!project) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  const isOwningClient = user.role === 'client' && (await clientOwnsProject(user.id, project.customer_id))
  if (user.role === 'client' && !isOwningClient) return forbiddenResponse()

  const { brief, briefStatus, action } = await req.json()
  const updates: any = {}

  // Only staff with projects.write can edit the brief text or set arbitrary statuses
  if (brief !== undefined || briefStatus) {
    if (!hasPermission(user, 'projects.write')) return forbiddenResponse()
    if (brief !== undefined) updates.brief = brief
    if (briefStatus) updates.brief_status = briefStatus
  }

  // Approve / reject: staff with projects.write, or the client who owns the project
  if (action === 'approve' || action === 'reject') {
    if (!hasPermission(user, 'projects.write') && !isOwningClient) return forbiddenResponse()
    if (action === 'approve') {
      updates.brief_status = 'approved'
      updates.brief_approved_at = new Date().toISOString()
      updates.brief_approved_by = user.id
    } else {
      updates.brief_status = 'rejected'
    }
  }

  if (!Object.keys(updates).length) {
    return Response.json({ success: false, message: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase.from('projects').update(updates).eq('id', params.id).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  if (!data) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  return Response.json({ success: true, data: toApi(data) })
}
