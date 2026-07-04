import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return Response.json({ success: false, message: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const entityId = searchParams.get('entityId')
  const limit = Math.min(Number(searchParams.get('limit')) || 30, 100)
  const before = searchParams.get('before')

  let query = supabase.from('activities').select('*')
    .eq('is_demo', !!user.isDemo)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (entityType) query = query.eq('entity_type', entityType)
  if (entityId) query = query.eq('entity_id', entityId)
  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}
