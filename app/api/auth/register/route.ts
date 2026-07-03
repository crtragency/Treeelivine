import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'
import { signToken, cookieOptions } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, phone, company } = await req.json()
    if (!email || !password) return Response.json({ success: false, message: 'Missing fields' }, { status: 400 })

    const { data: existing } = await supabase.from('users').select('id').eq('email', email.toLowerCase()).single()
    if (existing) return Response.json({ success: false, message: 'Email already exists' }, { status: 409 })

    const hash = await bcrypt.hash(password, 10)
    // Self-registration always creates a client account — staff accounts are created from Settings
    const userRole = 'client'
    const { data: user, error } = await supabase.from('users').insert({
      email: email.toLowerCase(), password: hash, name, role: userRole
    }).select().single()

    if (error || !user) return Response.json({ success: false, message: 'Failed to create user' }, { status: 500 })

    /* Auto-create a customer record for client accounts */
    if (userRole === 'client') {
      await supabase.from('customers').insert({
        user_id: user.id,
        name: name || email,
        email: email.toLowerCase(),
        phone: phone || null,
        company: company || null,
        status: 'active',
        priority: 'medium',
      })
    }

    const token = signToken(user.id)
    const cookieStore = cookies()
    cookieStore.set('treeelivine_session', token, cookieOptions())

    return Response.json({
      success: true,
      user: { _id: user.id, id: user.id, email: user.email, name: user.name, role: user.role, effectivePermissions: [] }
    })
  } catch (e) {
    console.error(e)
    return Response.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}
