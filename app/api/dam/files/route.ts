import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

/** DAM library listing — latest version per group, filterable by folder,
 *  filename search and tags. */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'dam.read')) return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const folderId = searchParams.get('folderId')
  const search = searchParams.get('search')
  const tag = searchParams.get('tag')
  const versionGroup = searchParams.get('versionGroup')

  let query = supabase.from('attachments')
    .select('*').eq('entity_type', 'dam').eq('is_demo', !!user.isDemo)
    .order('created_at', { ascending: false })
  if (versionGroup) {
    // full history of one file
    const { data, error } = await supabase.from('attachments')
      .select('*').eq('version_group', versionGroup).order('version', { ascending: false })
    if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
    return Response.json({ success: true, data: toApi(data || []) })
  }
  if (folderId) query = query.eq('folder_id', folderId)
  else if (searchParams.get('root') === '1') query = query.is('folder_id', null)
  if (search) query = query.ilike('file_name', `%${search}%`)
  if (tag) query = query.contains('tags', [tag])

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  // collapse to the latest version per group
  const byGroup = new Map<string, { latest: any; count: number }>()
  for (const a of data || []) {
    const key = a.version_group || a.id
    const cur = byGroup.get(key)
    if (!cur) byGroup.set(key, { latest: a, count: 1 })
    else {
      cur.count++
      if ((Number(a.version) || 1) > (Number(cur.latest.version) || 1)) cur.latest = a
    }
  }
  const rows = Array.from(byGroup.values()).map(({ latest, count }) => ({
    ...(toApi(latest) as any), versionCount: count,
  }))
  rows.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  return Response.json({ success: true, data: rows })
}
