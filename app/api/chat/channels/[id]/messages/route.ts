import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { notify } from '@/lib/notify'

async function requireMembership(channelId: string, userId: string) {
  const { data } = await supabase.from('channel_members')
    .select('user_id').eq('channel_id', channelId).eq('user_id', userId).single()
  return !!data
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'chat.use')) return forbiddenResponse()
  if (!(await requireMembership(params.id, user.id))) return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const before = searchParams.get('before')

  let query = supabase.from('messages')
    .select('*').eq('channel_id', params.id)
    .order('created_at', { ascending: false }).limit(50)
  if (before) query = query.lt('created_at', before)

  const { data: rows, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  const messages = (rows || []).reverse()
  const ids = messages.map(m => m.id)
  let reactions: any[] = []
  if (ids.length) {
    const { data: rx } = await supabase.from('message_reactions').select('*').in('message_id', ids)
    reactions = rx || []
  }
  const rxByMsg = new Map<string, { emoji: string; userIds: string[] }[]>()
  for (const r of reactions) {
    if (!rxByMsg.has(r.message_id)) rxByMsg.set(r.message_id, [])
    const list = rxByMsg.get(r.message_id)!
    const found = list.find(x => x.emoji === r.emoji)
    if (found) found.userIds.push(r.user_id)
    else list.push({ emoji: r.emoji, userIds: [r.user_id] })
  }

  return Response.json({
    success: true,
    data: messages.map(m => ({ ...toApi(m), reactions: rxByMsg.get(m.id) || [] })),
  })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'chat.use')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()
  if (!(await requireMembership(params.id, user.id))) return forbiddenResponse()

  const body = await req.json()
  if (!body.body?.trim() && !body.attachmentId) {
    return Response.json({ success: false, message: 'Message body required' }, { status: 400 })
  }

  const mentions: string[] = Array.isArray(body.mentions) ? body.mentions : []

  const { data, error } = await supabase.from('messages').insert({
    channel_id: params.id,
    author_id: user.id,
    author_name: user.name || user.email,
    body: body.body?.trim() || null,
    attachment_id: body.attachmentId || null,
    reply_to_id: body.replyToId || null,
    mentions,
    is_demo: !!user.isDemo,
  }).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  // side effects run in parallel — the sender shouldn't wait on fan-out
  const preview = (body.body || '').slice(0, 120)
  const [, { data: ch }, { data: members }] = await Promise.all([
    // sender has obviously read up to their own message
    supabase.from('channel_members').update({ last_read_at: new Date().toISOString() })
      .eq('channel_id', params.id).eq('user_id', user.id),
    supabase.from('channels').select('type').eq('id', params.id).single(),
    supabase.from('channel_members').select('user_id').eq('channel_id', params.id),
  ])

  const notifJobs: Promise<void>[] = []
  if (mentions.length) {
    notifJobs.push(notify(mentions, 'mention', `${user.name || user.email} أشار إليك في محادثة`,
      { body: preview, entityType: 'channel', entityId: params.id, link: '/app/chat', isDemo: !!user.isDemo, excludeUserId: user.id }))
  }
  // DMs also ping the other side (mentions already covered above)
  if (ch?.type === 'dm') {
    const others = (members || []).map(m => m.user_id).filter(id => id !== user.id && !mentions.includes(id))
    notifJobs.push(notify(others, 'chat_message', `رسالة جديدة من ${user.name || user.email}`,
      { body: preview, entityType: 'channel', entityId: params.id, link: '/app/chat', isDemo: !!user.isDemo }))
  }
  if (notifJobs.length) await Promise.all(notifJobs)

  return Response.json({ success: true, data: { ...toApi(data), reactions: [] } }, { status: 201 })
}
