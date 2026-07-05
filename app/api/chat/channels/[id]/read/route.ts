import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

/** Mark the channel read for me (unread badge reset). */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'chat.use')) return forbiddenResponse()

  const { error } = await supabase.from('channel_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('channel_id', params.id).eq('user_id', user.id)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true })
}
