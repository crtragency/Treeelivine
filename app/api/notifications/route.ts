import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const unreadOnly = searchParams.get('unread') === '1'
  const countOnly = searchParams.get('count') === '1'
  const before = searchParams.get('before')

  if (countOnly) {
    const { count, error } = await supabase.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).is('read_at', null)
    if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
    return Response.json({ success: true, data: { unread: count || 0 } })
  }

  let query = supabase.from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)
  if (unreadOnly) query = query.is('read_at', null)
  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

// PUT — mark all my notifications read
export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()

  const { error } = await supabase.from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id).is('read_at', null)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true })
}
