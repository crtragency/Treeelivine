import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'resources.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  const updates: any = {}
  if (body.percent !== undefined) {
    const percent = Number(body.percent)
    if (percent <= 0 || percent > 100) return Response.json({ success: false, message: 'Percent must be between 1 and 100' }, { status: 400 })
    updates.percent = percent
  }
  if (body.startDate !== undefined) updates.start_date = body.startDate
  if (body.endDate !== undefined) updates.end_date = body.endDate || null
  if (body.notes !== undefined) updates.notes = body.notes || null
  if (body.projectId !== undefined) updates.project_id = body.projectId

  const { data, error } = await supabase.from('allocations').update(updates).eq('id', params.id)
    .select('*, employee:employees(id,name), project:projects(id,name)').single()
  if (error || !data) return Response.json({ success: false, message: error?.message || 'Not found' }, { status: error ? 500 : 404 })
  return Response.json({ success: true, data: toApi(data) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'resources.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { error } = await supabase.from('allocations').delete().eq('id', params.id)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true })
}
