import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  const { data } = await supabase
    .from('quotations')
    .select('*, customer:customers(id,name,company), project:projects(id,name)')
    .eq('id', params.id).single()
  return Response.json({ success: true, data: toApi(data) })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  const { customerId, projectId, status, currency, items, taxRate, validUntil, notes } = body

  const parsedItems: any[] = Array.isArray(items) ? items : []
  const subtotal = parsedItems.reduce((s: number, i: any) => s + (Number(i.qty || 1) * Number(i.price || 0)), 0)
  const discountType = body.discountType === 'percent' || body.discountType === 'fixed' ? body.discountType : 'none'
  const discountValue = Number(body.discountValue || 0)
  const discountAmount = discountType === 'percent' ? subtotal * (discountValue / 100)
    : discountType === 'fixed' ? Math.min(discountValue, subtotal) : 0
  const tr = Number(taxRate || 0)
  const taxAmount = (subtotal - discountAmount) * (tr / 100)
  const total = subtotal - discountAmount + taxAmount

  const { data, error } = await supabase.from('quotations').update({
    discount_type: discountType,
    discount_value: discountValue,
    customer_id: customerId || null,
    project_id: projectId || null,
    status: status || 'draft',
    currency: currency || 'SAR',
    items: parsedItems,
    subtotal,
    tax_rate: tr,
    tax_amount: taxAmount,
    total,
    valid_until: validUntil || null,
    notes: notes || null,
  }).eq('id', params.id).select().single()

  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (user.isDemo) return demoReadOnlyResponse()
  await supabase.from('quotations').delete().eq('id', params.id)
  return Response.json({ success: true })
}
