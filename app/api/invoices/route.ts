import { NextRequest } from 'next/server'
import { getAuthUser, hasPermission, unauthorizedResponse, forbiddenResponse, demoReadOnlyResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { toApi } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'finance.read')) return forbiddenResponse()

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const customerId = searchParams.get('customerId')
  const projectId = searchParams.get('projectId')

  let query = supabase.from('invoices')
    .select('*, customer:customers(id,name,email,company), project:projects(id,name)')
    .order('created_at', { ascending: false })

  query = query.eq('is_demo', !!user.isDemo)
  if (status) query = query.eq('status', status)
  if (customerId) query = query.eq('customer_id', customerId)
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data || []) })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'finance.write')) return forbiddenResponse()
  if (user.isDemo) return demoReadOnlyResponse()

  const body = await req.json()
  const customerId = body.customerId || body.customer_id
  if (!customerId) return Response.json({ success: false, message: 'Customer is required' }, { status: 400 })

  let invoiceNumber = body.invoiceNumber || body.invoice_number
  if (!invoiceNumber) {
    const { count } = await supabase.from('invoices').select('*', { count: 'exact', head: true })
    invoiceNumber = `INV-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(3, '0')}`
  }

  const { data, error } = await supabase.from('invoices').insert({
    invoice_number: invoiceNumber,
    customer_id: customerId,
    project_id: body.projectId || body.project_id || null,
    status: body.status || 'unpaid',
    currency: body.currency || 'SAR',
    tax_rate: body.taxRate ?? body.tax_rate ?? 0,
    tax_amount: body.taxAmount ?? body.tax_amount ?? 0,
    subtotal: body.subtotal ?? 0,
    amount: body.amount ?? 0,
    paid_amount: body.paidAmount ?? body.paid_amount ?? 0,
    remaining_amount: body.remainingAmount ?? body.remaining_amount ?? (body.amount ?? 0),
    issue_date: body.issueDate || body.issue_date || new Date().toISOString(),
    due_date: body.dueDate || body.due_date || null,
    notes: body.notes,
    items: body.items || [],
  }).select().single()

  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: toApi(data) }, { status: 201 })
}
