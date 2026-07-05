import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

/** Toggle an emoji reaction on a message. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'chat.use')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { emoji } = await req.json()
  if (!emoji || String(emoji).length > 16) {
    return Response.json({ success: false, message: 'Emoji required' }, { status: 400 })
  }

  const { data: msg } = await supabase.from('messages').select('id, channel_id').eq('id', params.id).single()
  if (!msg) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  const { data: member } = await supabase.from('channel_members')
    .select('user_id').eq('channel_id', msg.channel_id).eq('user_id', user.id).single()
  if (!member) return forbiddenResponse()

  const { data: existing } = await supabase.from('message_reactions')
    .select('emoji').eq('message_id', params.id).eq('user_id', user.id).eq('emoji', emoji).single()
  if (existing) {
    await supabase.from('message_reactions').delete()
      .eq('message_id', params.id).eq('user_id', user.id).eq('emoji', emoji)
    return Response.json({ success: true, data: { toggled: 'off' } })
  }
  const { error } = await supabase.from('message_reactions').insert({
    message_id: params.id, user_id: user.id, emoji,
  })
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: { toggled: 'on' } })
}
