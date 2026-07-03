import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'
import { supabase } from './supabase'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET || 'treeelivine-secret-dev'
const COOKIE_NAME = 'treeelivine_session'

export function signToken(userId: string) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' })
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { userId: string }
}

export function getPermissionsForRole(role: string, settings: any): string[] {
  const roleObj = (settings?.roles || []).find((r: any) => r.role === role)
  return roleObj?.permissions || []
}

export function getEffectivePermissions(user: any, settings: any): string[] {
  let perms = getPermissionsForRole(user.role, settings)
  // Per-user extra permissions granted from Settings → Permissions
  const userPerms: string[] = user.effective_permissions || user.effectivePermissions || []
  if (userPerms.length) {
    perms = perms.concat(userPerms).filter((v, i, a) => a.indexOf(v) === i)
  }
  const override = (settings?.userPermissionOverrides || []).find(
    (o: any) => o.userId === user.id
  )
  if (override) {
    const merged = perms.concat(override.permissions || [])
    perms = merged.filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
    perms = perms.filter(p => !(override.deniedPermissions || []).includes(p))
  }
  return perms
}

export async function getAuthUser(req?: NextRequest) {
  try {
    let token: string | undefined
    if (req) {
      token = req.cookies.get(COOKIE_NAME)?.value
    } else {
      const cookieStore = cookies()
      token = cookieStore.get(COOKIE_NAME)?.value
    }
    if (!token) return null

    const decoded = verifyToken(token)

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single()

    if (!user || !user.is_active) return null

    const { data: settingsRow } = await supabase.from('settings').select('*').limit(1).single()
    const settings = settingsRow ? {
      roles: settingsRow.roles,
      permissions: settingsRow.permissions,
      userPermissionOverrides: settingsRow.user_permission_overrides || [],
    } : {}

    // Build camelCase user object with MongoDB compat
    const userObj = {
      _id: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.is_active,
      isDemo: user.is_demo,
      effectivePermissions: getEffectivePermissions(user, settings),
    }
    return userObj
  } catch {
    return null
  }
}

export function hasPermission(user: any, perm: string) {
  if (!user) return false
  if (user.role === 'admin') return true
  return (user.effectivePermissions || []).includes(perm)
}

export function unauthorizedResponse() {
  return Response.json({ success: false, message: 'Not authenticated' }, { status: 401 })
}

export function forbiddenResponse() {
  return Response.json({ success: false, message: 'Permission denied' }, { status: 403 })
}

export function demoReadOnlyResponse() {
  return Response.json({ success: false, message: 'Demo mode is read-only. Create a free account to make changes.' }, { status: 403 })
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60,
    path: '/',
  }
}
