import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthUser(req)
  if (!user) return unauthorizedResponse()

  const { text } = await req.json()
  if (!text?.trim()) return Response.json({ success: false, message: 'Comment text required' }, { status: 400 })

  const { data: project } = await supabase.from('projects').select('brief_comments, customer_id').eq('id', params.id).single()
  if (!project) return Response.json({ success: false, message: 'Not found' }, { status: 404 })

  // Clients may only comment on their own projects
  if (user.role === 'client') {
    const { data: customer } = project.customer_id
      ? await supabase.from('customers').select('user_id').eq('id', project.customer_id).single()
      : { data: null }
    if (customer?.user_id !== user.id) {
      return Response.json({ success: false, message: 'Forbidden' }, { status: 403 })
    }
  }

  const existingComments = Array.isArray(project.brief_comments) ? project.brief_comments : []
  const newComment = { authorId: user.id, authorName: user.name || user.email, text, createdAt: new Date().toISOString() }
  const updatedComments = [...existingComments, newComment]

  const { error } = await supabase.from('projects').update({ brief_comments: updatedComments }).eq('id', params.id)
  if (error) return Response.json({ success: false, message: error.message }, { status: 500 })
  return Response.json({ success: true, data: updatedComments })
}
