import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'dam.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  const updates: any = {}
  if (body.name !== undefined) updates.name = String(body.name).trim()
  if (body.parentId !== undefined) {
    if (body.parentId === params.id) return Response.json({ success: false, message: 'Folder cannot be its own parent' }, { status: 400 })
    updates.parent_id = body.parentId || null
  }
  if (body.customerId !== undefined) updates.customer_id = body.customerId || null
  if (body.projectId !== undefined) updates.project_id = body.projectId || null

  const { data, error } = await supabase.from('folders').update(updates).eq('id', params.id).select().single()
  if (error || !data) return Response.json({ success: false, message: error?.message || 'Not found' }, { status: error ? 500 : 404 })
  return Response.json({ success: true, data: toApi(data) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'dam.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  // files inside keep existing (folder_id → NULL via FK); subfolders cascade
  const { error } = await supabase.from('folders').delete().eq('id', params.id)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true })
}
