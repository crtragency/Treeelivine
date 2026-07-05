import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

/** Directory of staff accounts you can chat with. */
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'chat.use')) return forbiddenResponse()

  const { data, error } = await supabase.from('users')
    .select('id, name, email, role')
    .eq('is_active', true).eq('is_demo', !!user.isDemo)
    .neq('role', 'client')
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  return Response.json({
    success: true,
    data: (data || []).filter(u => u.id !== user.id)
      .map(u => ({ _id: u.id, id: u.id, name: u.name || u.email, email: u.email, role: u.role })),
  })
}
