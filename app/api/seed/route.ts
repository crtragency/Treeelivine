import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/lib/supabase'
import { signToken, cookieOptions } from '@/lib/auth'
import { cookies } from 'next/headers'

const DEMO_EMAIL = 'demo@treeelivine.com'
const DEMO_PASSWORD = 'demo1234'

export async function POST(_req: NextRequest) {
  try {
    // Clean up existing demo data
    for (const table of ['tasks','invoices','expenses','quotations','support_tickets','projects','templates','employees','customers','users']) {
      await supabase.from(table).delete().eq('is_demo', true)
    }

    // Create demo admin user
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10)
    const { data: demoUser } = await supabase.from('users').insert({
      email: DEMO_EMAIL, password: hash, name: 'Demo Admin', role: 'admin',
      is_active: true, is_demo: true
    }).select().single()
    if (!demoUser) throw new Error('Failed to create demo user')

    // Create demo employees
    const empInserts = [
      { name: 'أحمد المالكي', email: 'ahmed@treeelivine.com', phone: '0501111111', internal_role: 'account_manager', salary: 8000, is_demo: true },
      { name: 'سارة الشهري', email: 'sara@treeelivine.com', phone: '0502222222', internal_role: 'designer', salary: 6000, is_demo: true },
      { name: 'محمد العتيبي', email: 'mohammed@treeelivine.com', phone: '0503333333', internal_role: 'content_writer', salary: 5000, is_demo: true },
      { name: 'نورة القحطاني', email: 'noura@treeelivine.com', phone: '0504444444', internal_role: 'project_manager', salary: 9000, is_demo: true },
    ]
    const { data: employees } = await supabase.from('employees').insert(empInserts).select()

    // Create demo customers
    const custInserts = [
      { name: 'شركة النجوم للتقنية', company: 'النجوم للتقنية', email: 'info@stars-tech.sa', phone: '0501234567', status: 'active', priority: 'high', is_demo: true },
      { name: 'مؤسسة الريادة', company: 'الريادة', email: 'contact@riyadah.sa', phone: '0509876543', status: 'prospect', priority: 'medium', is_demo: true },
      { name: 'شركة المستقبل الرقمي', company: 'المستقبل الرقمي', email: 'hello@future-digital.sa', phone: '0551234567', status: 'active', priority: 'high', is_demo: true },
      { name: 'مجموعة الإبداع', company: 'الإبداع', email: 'info@ibdaa.sa', phone: '0561234567', status: 'negotiation', priority: 'urgent', is_demo: true },
    ]
    const { data: customers } = await supabase.from('customers').insert(custInserts).select()

    // Create demo projects
    if (customers?.length && employees?.length) {
      const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString()
      const projInserts = [
        { name: 'حملة التواصل الاجتماعي', customer_id: customers[0].id, status: 'active', assigned_employee_ids: [employees[0].id, employees[1].id], task_progress_percent: 65, due_date: inDays(12), is_demo: true },
        { name: 'هوية الريادة البصرية', customer_id: customers[1].id, status: 'active', assigned_employee_ids: [employees[1].id], task_progress_percent: 38, due_date: inDays(-3), is_demo: true },
        { name: 'استراتيجية المستقبل 2025', customer_id: customers[2].id, status: 'planning', assigned_employee_ids: [employees[3].id], task_progress_percent: 10, due_date: inDays(30), is_demo: true },
      ]
      const { data: projects } = await supabase.from('projects').insert(projInserts).select()

      // Create demo tasks
      if (projects?.length) {
        await supabase.from('tasks').insert([
          { title: 'تصميم بوست إنستغرام', project_id: projects[0].id, current_assignee_id: employees[1].id, status: 'in_progress', priority: 'high', due_date: inDays(2), is_demo: true },
          { title: 'كتابة كابشن الأسبوع', project_id: projects[0].id, current_assignee_id: employees[2].id, status: 'pending', priority: 'medium', due_date: inDays(5), is_demo: true },
          { title: 'تصميم الشعار', project_id: projects[1].id, current_assignee_id: employees[1].id, status: 'in_review', priority: 'high', due_date: inDays(-2), is_demo: true },
          { title: 'مراجعة دليل الهوية', project_id: projects[1].id, current_assignee_id: employees[3].id, status: 'pending', priority: 'urgent', due_date: inDays(-1), is_demo: true },
          { title: 'اجتماع استراتيجي', project_id: projects[2].id, current_assignee_id: employees[3].id, status: 'pending', priority: 'medium', due_date: inDays(7), is_demo: true },
        ])
      }

      // Create demo invoices
      await supabase.from('invoices').insert([
        { invoice_number: 'INV-2024-001', customer_id: customers[0].id, project_id: projects?.[0]?.id, status: 'paid', amount: 15000, paid_amount: 15000, remaining_amount: 0, subtotal: 13043, tax_rate: 15, tax_amount: 1957, currency: 'SAR', is_demo: true },
        { invoice_number: 'INV-2024-002', customer_id: customers[2].id, project_id: projects?.[2]?.id, status: 'unpaid', amount: 22000, paid_amount: 0, remaining_amount: 22000, subtotal: 19130, tax_rate: 15, tax_amount: 2870, currency: 'SAR', is_demo: true },
        { invoice_number: 'INV-2024-003', customer_id: customers[1].id, project_id: projects?.[1]?.id, status: 'partial', amount: 8000, paid_amount: 4000, remaining_amount: 4000, subtotal: 6957, tax_rate: 15, tax_amount: 1043, currency: 'SAR', is_demo: true },
      ])
    }

    // Create demo expenses
    if (employees?.length) {
      await supabase.from('expenses').insert([
        { description: 'راتب أحمد المالكي', category: 'salary', amount: 8000, employee_id: employees[0].id, is_recurring_salary: true, salary_next_due_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(), is_demo: true },
        { description: 'راتب سارة الشهري', category: 'salary', amount: 6000, employee_id: employees[1].id, is_recurring_salary: true, salary_next_due_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(), is_demo: true },
        { description: 'فاتورة الإنترنت', category: 'utilities', amount: 500, is_demo: true },
        { description: 'اشتراك Adobe Creative Cloud', category: 'software', amount: 350, is_demo: true },
      ])
    }

    // Create demo support tickets
    if (customers?.length && employees?.length) {
      await supabase.from('support_tickets').insert([
        { ticket_number: 'TKT-0001', title: 'موقع الشركة لا يعمل', description: 'الصفحة الرئيسية لا تستجيب منذ اليوم الصباح', customer_id: customers[0].id, assigned_to: employees[0].id, status: 'open', priority: 'urgent', is_demo: true },
        { ticket_number: 'TKT-0002', title: 'طلب تعديل على الشعار', description: 'نحتاج تعديل في لون الشعار وفق الهوية الجديدة', customer_id: customers[1].id, assigned_to: employees[1].id, status: 'in_progress', priority: 'medium', is_demo: true },
        { ticket_number: 'TKT-0003', title: 'مشكلة في التقارير الشهرية', description: 'التقارير لا تعكس الأرقام الصحيحة للشهر الماضي', customer_id: customers[2].id, assigned_to: employees[3].id, status: 'resolved', priority: 'high', is_demo: true },
        { ticket_number: 'TKT-0004', title: 'طلب تدريب على النظام', description: 'نحتاج جلسة تدريبية للموظفين الجدد', customer_id: customers[0].id, assigned_to: null, status: 'open', priority: 'low', is_demo: true },
        { ticket_number: 'TKT-0005', title: 'خطأ في فاتورة INV-2024-002', description: 'المبلغ في الفاتورة يختلف عما تم الاتفاق عليه', customer_id: customers[2].id, assigned_to: employees[0].id, status: 'in_progress', priority: 'high', is_demo: true },
      ])
    }

    // Create demo quotations
    if (customers?.length) {
      const validDate = new Date()
      validDate.setDate(validDate.getDate() + 30)
      const validStr = validDate.toISOString()
      await supabase.from('quotations').insert([
        {
          quote_number: 'QT-2024-001', customer_id: customers[0].id,
          status: 'accepted', currency: 'SAR',
          items: [{ description: 'إدارة السوشيال ميديا - 3 أشهر', qty: 3, price: 4000 }, { description: 'تصميم محتوى بصري', qty: 1, price: 2000 }],
          subtotal: 14000, tax_rate: 15, tax_amount: 2100, total: 16100,
          valid_until: validStr, notes: 'يشمل 3 منصات تواصل اجتماعي', is_demo: true,
        },
        {
          quote_number: 'QT-2024-002', customer_id: customers[1].id,
          status: 'sent', currency: 'SAR',
          items: [{ description: 'تصميم الهوية البصرية الكاملة', qty: 1, price: 12000 }, { description: 'دليل استخدام الهوية', qty: 1, price: 3000 }],
          subtotal: 15000, tax_rate: 15, tax_amount: 2250, total: 17250,
          valid_until: validStr, is_demo: true,
        },
        {
          quote_number: 'QT-2024-003', customer_id: customers[3].id,
          status: 'draft', currency: 'SAR',
          items: [{ description: 'استراتيجية تسويق رقمي - سنة', qty: 1, price: 35000 }],
          subtotal: 35000, tax_rate: 15, tax_amount: 5250, total: 40250,
          valid_until: validStr, is_demo: true,
        },
      ])
    }

    // Create demo templates
    await supabase.from('templates').insert([
      { name: 'بريف إدارة السوشيال ميديا', type: 'brief', category: 'social_media', content: 'اسم العميل:\nالمنصات المطلوبة:\nعدد المنشورات أسبوعياً:\nالهوية البصرية:', created_by: demoUser.id, is_demo: true },
      { name: 'بريف تصميم الهوية', type: 'brief', category: 'branding', content: 'اسم الشركة:\nقطاع النشاط:\nالألوان المفضلة:\nالرسالة الأساسية:', created_by: demoUser.id, is_demo: true },
    ])

    // Auto-login demo user
    const token = signToken(demoUser.id)
    const cookieStore = cookies()
    cookieStore.set('treeelivine_session', token, cookieOptions())

    return Response.json({
      success: true,
      message: 'Demo data created',
      user: { _id: demoUser.id, email: demoUser.email, name: demoUser.name, role: demoUser.role }
    })
  } catch (e) {
    console.error('Seed error:', e)
    return Response.json({ success: false, message: 'Seed failed' }, { status: 500 })
  }
}
