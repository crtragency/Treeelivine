import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, invalidateSettingsCache } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()

  const { data } = await supabase.from('settings').select('currencies').limit(1).single()
  return Response.json({ success: true, data: data?.currencies || [] })
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'settings.write')) return forbiddenResponse()

  const { currencies } = await req.json()
  const { data: settings } = await supabase.from('settings').select('id').limit(1).single()
  if (!settings) return Response.json({ success: false, message: 'Settings not found' }, { status: 500 })

  const { data, error } = await supabase.from('settings').update({ currencies }).eq('id', settings.id).select('currencies').single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  invalidateSettingsCache()
  return Response.json({ success: true, data: data?.currencies })
}
