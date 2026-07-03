import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()

  const { data } = await supabase.from('invoices')
    .select('*, customer:customers(id,name,email,company,phone,user_id), project:projects(id,name)')
    .eq('id', params.id).single()
  if (!data) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  // Clients can only view their own invoices; staff need finance.read
  if (user.role === 'client') {
    if ((data as any).customer?.user_id !== user.id) return forbiddenResponse()
  } else if (!hasPermission(user, 'finance.read')) {
    return forbiddenResponse()
  }

  return Response.json({ success: true, data: toApi(data) })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'finance.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  const updates: any = {}
  if (body.status !== undefined) updates.status = body.status
  if (body.currency !== undefined) updates.currency = body.currency
  if (body.taxRate !== undefined) updates.tax_rate = body.taxRate
  if (body.tax_rate !== undefined) updates.tax_rate = body.tax_rate
  if (body.taxAmount !== undefined) updates.tax_amount = body.taxAmount
  if (body.subtotal !== undefined) updates.subtotal = body.subtotal
  if (body.amount !== undefined) updates.amount = body.amount
  if (body.paidAmount !== undefined) updates.paid_amount = body.paidAmount
  if (body.paid_amount !== undefined) updates.paid_amount = body.paid_amount
  if (body.remainingAmount !== undefined) updates.remaining_amount = body.remainingAmount
  if (body.dueDate !== undefined) updates.due_date = body.dueDate
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.items !== undefined) updates.items = body.items
  if (body.invoiceNumber !== undefined) updates.invoice_number = body.invoiceNumber
  if (body.customerId !== undefined) updates.customer_id = body.customerId
  if (body.projectId !== undefined) updates.project_id = body.projectId

  const { data, error } = await supabase.from('invoices').update(updates).eq('id', params.id).select().single()
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  if (!data) return Response.json({ success: false, message: 'Not found' }, { status: 404 })
  return Response.json({ success: true, data: toApi(data) })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'finance.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const { error } = await supabase.from('invoices').delete().eq('id', params.id)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true })
}
