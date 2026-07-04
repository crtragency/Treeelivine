import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse, demoReadOnlyResponse, forbiddenResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { data: note } = await supabase.from('notes').select('author_id').eq('id', params.id).single()
  if (!note) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  if (note.author_id !== user.id && user.role !== 'admin') return forbiddenResponse()

  const body = await req.json()
  const updates: any = {}
  if (body.body !== undefined) updates.body = body.body
  if (body.pinned !== undefined) updates.pinned = body.pinned

  const { data, error } = await supabase.from('notes').update(updates).eq('id', params.id).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { data: note } = await supabase.from('notes').select('author_id').eq('id', params.id).single()
  if (!note) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  if (note.author_id !== user.id && user.role !== 'admin') return forbiddenResponse()

  const { error } = await supabase.from('notes').delete().eq('id', params.id)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true })
}
