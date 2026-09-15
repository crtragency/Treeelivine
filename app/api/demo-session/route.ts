import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { supabase } from '@/lib/supabase'
import { signToken, cookieOptions } from '@/lib/auth'
import { cookies } from 'next/headers'

const DEMO_EMAIL = 'demo@treeelivine.com'

async function ensureDemoData(demoUserId: string) {
  const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString()

  let { data: employees } = await supabase
    .from('employees')
    .select('*')
    .eq('is_demo', true)
    .order('created_at')

  if (!employees?.length) {
    const result = await supabase.from('employees').insert([
      { name: 'أحمد المالكي', email: 'ahmed.demo@treeelivine.com', phone: '0501111111', internal_role: 'account_manager', salary: 8000, is_demo: true },
      { name: 'سارة الشهري', email: 'sara.demo@treeelivine.com', phone: '0502222222', internal_role: 'designer', salary: 6000, is_demo: true },
      { name: 'محمد العتيبي', email: 'mohammed.demo@treeelivine.com', phone: '0503333333', internal_role: 'content_writer', salary: 5000, is_demo: true },
      { name: 'نورة القحطاني', email: 'noura.demo@treeelivine.com', phone: '0504444444', internal_role: 'project_manager', salary: 9000, is_demo: true },
    ]).select()
    if (result.error) throw result.error
    employees = result.data
  }

  if (employees?.[0]?.id && employees[0].user_id !== demoUserId) {
    await supabase.from('employees').update({ user_id: demoUserId }).eq('id', employees[0].id)
  }

  let { data: customers } = await supabase
    .from('customers')
    .select('*')
    .eq('is_demo', true)
    .order('created_at')

  if (!customers?.length) {
    const result = await supabase.from('customers').insert([
      { name: 'شركة النجوم للتقنية', company: 'النجوم للتقنية', email: 'demo-stars@treeelivine.com', phone: '0501234567', status: 'active', priority: 'high', is_demo: true },
      { name: 'مؤسسة الريادة', company: 'الريادة', email: 'demo-riyadah@treeelivine.com', phone: '0509876543', status: 'prospect', priority: 'medium', is_demo: true },
      { name: 'شركة المستقبل الرقمي', company: 'المستقبل الرقمي', email: 'demo-future@treeelivine.com', phone: '0551234567', status: 'active', priority: 'high', is_demo: true },
      { name: 'مجموعة الإبداع', company: 'الإبداع', email: 'demo-ibdaa@treeelivine.com', phone: '0561234567', status: 'negotiation', priority: 'urgent', is_demo: true },
    ]).select()
    if (result.error) throw result.error
    customers = result.data
  }

  if (!employees?.length || !customers?.length) return

  let { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('is_demo', true)
    .order('created_at')

  if (!projects?.length) {
    const result = await supabase.from('projects').insert([
      { name: 'حملة التواصل الاجتماعي', customer_id: customers[0].id, status: 'active', assigned_employee_ids: [employees[0].id, employees[1].id], task_progress_percent: 65, due_date: inDays(12), is_demo: true },
      { name: 'هوية الريادة البصرية', customer_id: customers[1].id, status: 'active', assigned_employee_ids: [employees[1].id], task_progress_percent: 38, due_date: inDays(-3), is_demo: true },
      { name: 'استراتيجية المستقبل الرقمي', customer_id: customers[2].id, status: 'planning', assigned_employee_ids: [employees[3].id], task_progress_percent: 10, due_date: inDays(30), is_demo: true },
    ]).select()
    if (result.error) throw result.error
    projects = result.data
  }

  if (!projects?.length) return

  const { data: demoTasks } = await supabase.from('tasks').select('id').eq('is_demo', true).limit(1)
  if (!demoTasks?.length) {
    const result = await supabase.from('tasks').insert([
      { title: 'تصميم بوست إنستغرام', project_id: projects[0].id, current_assignee_id: employees[1].id, status: 'in_progress', priority: 'high', due_date: inDays(2), is_demo: true },
      { title: 'كتابة محتوى الأسبوع', project_id: projects[0].id, current_assignee_id: employees[2].id, status: 'pending', priority: 'medium', due_date: inDays(5), is_demo: true },
      { title: 'تصميم الشعار', project_id: projects[1].id, current_assignee_id: employees[1].id, status: 'in_review', priority: 'high', due_date: inDays(-2), is_demo: true },
      { title: 'مراجعة دليل الهوية', project_id: projects[1].id, current_assignee_id: employees[3].id, status: 'pending', priority: 'urgent', due_date: inDays(-1), is_demo: true },
    ])
    if (result.error) throw result.error
  }

  const { data: demoInvoices } = await supabase.from('invoices').select('id').eq('is_demo', true).limit(1)
  if (!demoInvoices?.length) {
    const result = await supabase.from('invoices').insert([
      { invoice_number: 'DEMO-INV-001', customer_id: customers[0].id, project_id: projects[0].id, status: 'paid', amount: 15000, paid_amount: 15000, remaining_amount: 0, subtotal: 13043, tax_rate: 15, tax_amount: 1957, currency: 'SAR', is_demo: true },
      { invoice_number: 'DEMO-INV-002', customer_id: customers[2].id, project_id: projects[2].id, status: 'unpaid', amount: 22000, paid_amount: 0, remaining_amount: 22000, subtotal: 19130, tax_rate: 15, tax_amount: 2870, currency: 'SAR', is_demo: true },
      { invoice_number: 'DEMO-INV-003', customer_id: customers[1].id, project_id: projects[1].id, status: 'partial', amount: 8000, paid_amount: 4000, remaining_amount: 4000, subtotal: 6957, tax_rate: 15, tax_amount: 1043, currency: 'SAR', is_demo: true },
    ])
    if (result.error) throw result.error
  }

  const { data: demoExpenses } = await supabase.from('expenses').select('id').eq('is_demo', true).limit(1)
  if (!demoExpenses?.length) {
    const result = await supabase.from('expenses').insert([
      { description: 'راتب أحمد المالكي', category: 'salary', amount: 8000, employee_id: employees[0].id, is_demo: true },
      { description: 'راتب سارة الشهري', category: 'salary', amount: 6000, employee_id: employees[1].id, is_demo: true },
      { description: 'اشتراك البرامج الإبداعية', category: 'software', amount: 350, is_demo: true },
    ])
    if (result.error) throw result.error
  }

  const { data: demoQuotes } = await supabase.from('quotations').select('id').eq('is_demo', true).limit(1)
  if (!demoQuotes?.length) {
    const result = await supabase.from('quotations').insert([
      {
        quote_number: 'DEMO-QT-001', customer_id: customers[0].id, status: 'accepted', currency: 'SAR',
        items: [{ description: 'إدارة السوشيال ميديا - 3 أشهر', qty: 3, price: 4000 }],
        subtotal: 12000, tax_rate: 15, tax_amount: 1800, total: 13800,
        valid_until: inDays(30), is_demo: true,
      },
      {
        quote_number: 'DEMO-QT-002', customer_id: customers[1].id, status: 'sent', currency: 'SAR',
        items: [{ description: 'تصميم الهوية البصرية الكاملة', qty: 1, price: 15000 }],
        subtotal: 15000, tax_rate: 15, tax_amount: 2250, total: 17250,
        valid_until: inDays(30), is_demo: true,
      },
    ])
    if (result.error) throw result.error
  }

  const { data: demoTickets } = await supabase.from('support_tickets').select('id').eq('is_demo', true).limit(1)
  if (!demoTickets?.length) {
    const result = await supabase.from('support_tickets').insert([
      { ticket_number: 'DEMO-TKT-001', title: 'مراجعة الصفحة الرئيسية', description: 'مطلوب مراجعة التعديلات الأخيرة', customer_id: customers[0].id, assigned_to: employees[0].id, status: 'open', priority: 'high', is_demo: true },
      { ticket_number: 'DEMO-TKT-002', title: 'تعديل على الهوية', description: 'تحديث لون من ألوان الهوية', customer_id: customers[1].id, assigned_to: employees[1].id, status: 'in_progress', priority: 'medium', is_demo: true },
    ])
    if (result.error) throw result.error
  }
}

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

    await ensureDemoData(demoUser.id)

    const token = signToken(demoUser.id)
    cookies().set('treeelivine_session', token, cookieOptions())

    return Response.json({ success: true })
  } catch (error) {
    console.error('Demo session error:', error)
    return Response.json({ success: false }, { status: 500 })
  }
}
