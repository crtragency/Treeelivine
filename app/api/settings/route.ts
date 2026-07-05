import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse, invalidateSettingsCache } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

async function getOrCreateSettings() {
  const { data } = await supabase.from('settings').select('*').limit(1).single()
  if (data) return data
  const { data: created } = await supabase.from('settings').insert({}).select().single()
  return created
}

function settingsToApi(row: any) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    companyName: row.company_name,
    companyAddress: row.company_address,
    defaultCurrency: row.default_currency,
    defaultTaxRate: row.default_tax_rate,
    currencies: row.currencies,
    roles: row.roles,
    permissions: row.permissions,
    demoMode: row.demo_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()

  const settings = await getOrCreateSettings()
  return Response.json({ success: true, data: settingsToApi(settings) })
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'settings.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  const settings = await getOrCreateSettings()
  if (!settings) return Response.json({ success: false, message: 'Settings not found' }, { status: 500 })

  const updates: any = {}
  if (body.companyName !== undefined) updates.company_name = body.companyName
  if (body.companyAddress !== undefined) updates.company_address = body.companyAddress
  if (body.defaultCurrency !== undefined) updates.default_currency = body.defaultCurrency
  if (body.defaultTaxRate !== undefined) updates.default_tax_rate = body.defaultTaxRate
  if (body.currencies !== undefined) updates.currencies = body.currencies
  if (body.roles !== undefined) updates.roles = body.roles
  if (body.permissions !== undefined) updates.permissions = body.permissions
  if (body.demoMode !== undefined) updates.demo_mode = body.demoMode

  const { data, error } = await supabase.from('settings').update(updates).eq('id', settings.id).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  invalidateSettingsCache()
  return Response.json({ success: true, data: settingsToApi(data) })
}
