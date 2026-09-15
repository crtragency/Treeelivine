import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { supabase } from '@/lib/supabase'
import { signToken, cookieOptions } from '@/lib/auth'
import { cookies } from 'next/headers'

const DEMO_EMAIL = 'demo@treeelivine.com'

export async function POST(_req: NextRequest) {
  try {
    const { data: existing, error: lookupError } = await supabase
      .from('users')
      .select('*')
      .eq('email', DEMO_EMAIL)
      .maybeSingle()

    if (lookupError) throw lookupError

    let demoUser = existing
    if (!demoUser) {
      const password = await bcrypt.hash(randomUUID(), 10)
      const { data, error } = await supabase.from('users').insert({
        email: DEMO_EMAIL,
        password,
        name: 'Demo Admin',
        role: 'admin',
        is_active: true,
        is_demo: true,
      }).select().single()
      if (error) throw error
      demoUser = data
    } else if (!demoUser.is_active || !demoUser.is_demo || demoUser.role !== 'admin') {
      const { data, error } = await supabase.from('users').update({
        name: 'Demo Admin',
        role: 'admin',
        is_active: true,
        is_demo: true,
      }).eq('id', demoUser.id).select().single()
      if (error) throw error
      demoUser = data
    }

    if (!demoUser) throw new Error('Unable to prepare demo account')

    const token = signToken(demoUser.id)
    cookies().set('treeelivine_session', token, cookieOptions())

    return Response.json({ success: true })
  } catch (error) {
    console.error('Demo session error:', error)
    return Response.json({ success: false }, { status: 500 })
  }
}
