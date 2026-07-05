import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

/** My channels with unread counts, member names and last message. */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'chat.use')) return forbiddenResponse()

  const { data: memberships } = await supabase.from('channel_members')
    .select('channel_id, last_read_at').eq('user_id', user.id)
  if (!memberships?.length) return Response.json({ success: true, data: [] })

  const ids = memberships.map(m => m.channel_id)
  const lastRead = new Map(memberships.map(m => [m.channel_id, m.last_read_at]))

  const [{ data: channels }, { data: allMembers }] = await Promise.all([
    supabase.from('channels').select('*, project:projects(id,name)').in('id', ids),
    supabase.from('channel_members').select('channel_id, user_id, member:users(id,name,email)').in('channel_id', ids),
  ])

  const membersByChannel = new Map<string, any[]>()
  for (const m of allMembers || []) {
    if (!membersByChannel.has(m.channel_id)) membersByChannel.set(m.channel_id, [])
    membersByChannel.get(m.channel_id)!.push({
      id: m.user_id,
      name: (m as any).member?.name || (m as any).member?.email || '—',
    })
  }

  // one query for unread counts + previews across all channels (no N+1):
  // recent messages are enough — unread badges cap out visually anyway
  const { data: recent } = await supabase.from('messages')
    .select('channel_id, author_id, author_name, body, created_at')
    .in('channel_id', ids).order('created_at', { ascending: false }).limit(400)

  const lastByChannel = new Map<string, any>()
  const unreadByChannel = new Map<string, number>()
  for (const m of recent || []) {
    if (!lastByChannel.has(m.channel_id)) lastByChannel.set(m.channel_id, m)
    const readAt = lastRead.get(m.channel_id) || new Date(0).toISOString()
    if (m.created_at > readAt && m.author_id !== user.id) {
      unreadByChannel.set(m.channel_id, (unreadByChannel.get(m.channel_id) || 0) + 1)
    }
  }

  const result = (channels || []).map(ch => {
    const members = membersByChannel.get(ch.id) || []
    const others = members.filter(m => m.id !== user.id)
    const name = ch.type === 'dm'
      ? (others[0]?.name || '—')
      : ch.type === 'project' ? ((ch as any).project?.name || ch.name || '—') : (ch.name || '—')
    const last = lastByChannel.get(ch.id)
    return {
      _id: ch.id, id: ch.id, type: ch.type, name,
      projectId: ch.project_id || null,
      members,
      unread: unreadByChannel.get(ch.id) || 0,
      lastMessage: last ? { body: last.body, authorName: last.author_name, createdAt: last.created_at } : null,
    }
  })

  result.sort((a, b) => (b.lastMessage?.createdAt || '').localeCompare(a.lastMessage?.createdAt || ''))
  return Response.json({ success: true, data: result })
}

/** Create (or return) a channel: dm {userId} | team {name, memberIds} | project {projectId, memberIds} */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'chat.use')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  const type = body.type || 'dm'

  if (type === 'dm') {
    if (!body.userId) return Response.json({ success: false, message: 'userId is required' }, { status: 400 })
    const { data: other } = await supabase.from('users').select('id, role, is_active').eq('id', body.userId).single()
    if (!other || !other.is_active || other.role === 'client') {
      return Response.json({ success: false, message: 'User not found' }, { status: 404 })
    }
    const dmKey = [user.id, other.id].sort().join(':')
    const { data: existing } = await supabase.from('channels').select('id').eq('dm_key', dmKey).single()
    if (existing) return Response.json({ success: true, data: { _id: existing.id, id: existing.id } })

    const { data: ch, error } = await supabase.from('channels').insert({
      type: 'dm', dm_key: dmKey, created_by: user.id, is_demo: !!user.isDemo,
    }).select().single()
    if (error) {
      // race: unique dm_key index — someone created it between our check and insert
      const { data: retry } = await supabase.from('channels').select('id').eq('dm_key', dmKey).single()
      if (retry) return Response.json({ success: true, data: { _id: retry.id, id: retry.id } })
      return Response.json({ success: false, message: error.message }, { status: 500 })
    }
    await supabase.from('channel_members').insert([
      { channel_id: ch.id, user_id: user.id },
      { channel_id: ch.id, user_id: other.id },
    ])
    return Response.json({ success: true, data: { _id: ch.id, id: ch.id } }, { status: 201 })
  }

  if (type === 'project') {
    if (!body.projectId) return Response.json({ success: false, message: 'projectId is required' }, { status: 400 })
    const { data: existing } = await supabase.from('channels').select('id').eq('project_id', body.projectId).single()
    if (existing) {
      // ensure the caller is a member
      const { data: mem } = await supabase.from('channel_members')
        .select('user_id').eq('channel_id', existing.id).eq('user_id', user.id).single()
      if (!mem) await supabase.from('channel_members').insert({ channel_id: existing.id, user_id: user.id })
      return Response.json({ success: true, data: { _id: existing.id, id: existing.id } })
    }
    const { data: project } = await supabase.from('projects').select('id, name').eq('id', body.projectId).single()
    if (!project) return Response.json({ success: false, message: 'Project not found' }, { status: 404 })
    const { data: ch, error } = await supabase.from('channels').insert({
      type: 'project', project_id: project.id, name: project.name, created_by: user.id, is_demo: !!user.isDemo,
    }).select().single()
    if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
    const memberIds: string[] = Array.from(new Set([user.id, ...(body.memberIds || [])]))
    await supabase.from('channel_members').insert(memberIds.map(uid => ({ channel_id: ch.id, user_id: uid })))
    return Response.json({ success: true, data: { _id: ch.id, id: ch.id } }, { status: 201 })
  }

  // team channel
  if (!body.name?.trim()) return Response.json({ success: false, message: 'Name is required' }, { status: 400 })
  const { data: ch, error } = await supabase.from('channels').insert({
    type: 'team', name: body.name.trim(), created_by: user.id, is_demo: !!user.isDemo,
  }).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  const memberIds: string[] = Array.from(new Set([user.id, ...(body.memberIds || [])]))
  await supabase.from('channel_members').insert(memberIds.map(uid => ({ channel_id: ch.id, user_id: uid })))
  return Response.json({ success: true, data: { _id: ch.id, id: ch.id } }, { status: 201 })
}
