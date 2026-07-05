import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'dam.read')) return forbiddenResponse()

  const { data, error } = await supabase.from('folders')
    .select('*, customer:customers(id,name), project:projects(id,name)')
    .eq('is_demo', !!user.isDemo).order('name')
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'dam.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  if (!body.name?.trim()) return Response.json({ success: false, message: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase.from('folders').insert({
    name: body.name.trim(),
    parent_id: body.parentId || null,
    customer_id: body.customerId || null,
    project_id: body.projectId || null,
    created_by: user.id,
    is_demo: !!user.isDemo,
  }).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
