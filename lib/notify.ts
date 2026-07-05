import { supabase } from './supabase'

export type NotificationType =
  | 'mention' | 'task_assigned' | 'task_due' | 'contract_expiring'
  | 'ticket_reply' | 'ticket_escalated' | 'project_update'
  | 'chat_message' | 'reminder' | 'vacation_request' | 'overload'

/** Insert in-app notifications for one or more users. Never throws —
 *  notification fan-out must not break the main mutation. */
export async function notify(
  userIds: (string | null | undefined)[] | string,
  type: NotificationType,
  title: string,
  opts?: {
    body?: string
    entityType?: string
    entityId?: string
    link?: string
    isDemo?: boolean
    excludeUserId?: string
  }
) {
  try {
    const ids = (Array.isArray(userIds) ? userIds : [userIds])
      .filter((id): id is string => !!id)
      .filter((id, i, a) => a.indexOf(id) === i)
      .filter(id => id !== opts?.excludeUserId)
    if (!ids.length) return

    await supabase.from('notifications').insert(ids.map(userId => ({
      user_id: userId,
      type,
      title,
      body: opts?.body || null,
      entity_type: opts?.entityType || null,
      entity_id: opts?.entityId || null,
      link: opts?.link || null,
      is_demo: !!opts?.isDemo,
    })))
  } catch (e) {
    console.error('notify failed:', e)
  }
}
