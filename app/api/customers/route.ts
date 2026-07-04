import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'crm.read')) return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const search = searchParams.get('search')
  const archived = searchParams.get('archived') === 'true'

  let query = supabase
    .from('customers')
    .select('*, assigned_employee:employees(id,name)')
    .order('updated_at', { ascending: false })

  query = query.eq('is_demo', !!user.isDemo)

  if (archived) {
    query = query.not('archived_at', 'is', null)
  } else {
    query = query.is('archived_at', null)
  }
  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  let results = data || []
  if (search) {
    const s = search.toLowerCase()
    results = results.filter(c =>
      c.name?.toLowerCase().includes(s) ||
      c.company?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s)
    )
  }

  return Response.json({ success: true, data: toApi(results) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'crm.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { force, ...body } = await req.json()
  if (!body.name) return Response.json({ success: false, message: 'Name is required' }, { status: 400 })
  if (!body.phone && !body.email) return Response.json({ success: false, message: 'Phone or email required' }, { status: 400 })

  if (!force) {
    const orFilters: string[] = []
    if (body.email) orFilters.push(`email.eq.${body.email}`)
    if (body.phone) orFilters.push(`phone.eq.${body.phone}`)
    if (body.company) orFilters.push(`company.eq.${body.company}`)
    if (orFilters.length) {
      const { data: dups } = await supabase.from('customers').select('*').or(orFilters.join(','))
      if (dups?.length) return Response.json({ success: false, message: 'Possible duplicate', duplicates: toApi(dups) }, { status: 409 })
    }
  }

  const { data, error } = await supabase.from('customers').insert({
    name: body.name,
    email: body.email,
    phone: body.phone,
    company: body.company,
    status: body.status || 'lead',
    priority: body.priority || 'medium',
    notes: body.notes,
    assigned_to: body.assignedTo || null,
    contact_person: body.contactPerson || null,
    whatsapp: body.whatsapp || null,
    industry: body.industry || null,
    country: body.country || null,
    address: body.address || null,
    website: body.website || null,
    tax_number: body.taxNumber || null,
    tags: Array.isArray(body.tags) ? body.tags : [],
  }).select().single()

  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
