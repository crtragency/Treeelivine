import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'
import { logActivity } from '@/lib/activity'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.role === 'client') return forbiddenResponse()
  if (!hasPermission(user, 'contracts.read')) return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customerId')
  const status = searchParams.get('status')

  let query = supabase.from('contracts')
    .select('*, customer:customers(id,name,company), project:projects(id,name)')
    .eq('is_demo', !!user.isDemo)
    .order('created_at', { ascending: false })
  if (customerId) query = query.eq('customer_id', customerId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'contracts.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  if (!body.title) return Response.json({ success: false, message: 'Title is required' }, { status: 400 })

  let contractNumber = body.contractNumber
  if (!contractNumber) {
    const { count } = await supabase.from('contracts').select('*', { count: 'exact', head: true })
    contractNumber = `CT-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
  }

  const { data, error } = await supabase.from('contracts').insert({
    contract_number: contractNumber,
    title: body.title,
    customer_id: body.customerId || null,
    project_id: body.projectId || null,
    status: body.status || 'draft',
    value: body.value ?? 0,
    currency: body.currency || 'SAR',
    start_date: body.startDate || null,
    end_date: body.endDate || null,
    body: body.body || null,
  }).select('*, customer:customers(id,name,company)').single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })

  await logActivity({ entityType: 'contract', entityId: data.id, action: 'created', user })
  if (body.customerId) await logActivity({ entityType: 'customer', entityId: body.customerId, action: 'contract_created', detail: { contractNumber }, user })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
