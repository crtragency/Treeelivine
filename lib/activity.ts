import { supabase } from './supabase'

/** Append a row to the generic activity timeline. Never throws — timeline
 *  logging must not break the main mutation. */
export async function logActivity(opts: {
  entityType: 'lead' | 'customer' | 'project' | 'task' | 'quotation' | 'invoice' | 'contract' | 'ticket'
  entityId: string
  action: string
  detail?: Record<string, unknown>
  user?: { id?: string; _id?: string; name?: string; email?: string; isDemo?: boolean } | null
}) {
  try {
    await supabase.from('activities').insert({
      entity_type: opts.entityType,
      entity_id: opts.entityId,
      action: opts.action,
      detail: opts.detail || {},
      actor_id: opts.user?.id || opts.user?._id || null,
      actor_name: opts.user?.name || opts.user?.email || null,
      is_demo: !!opts.user?.isDemo,
    })
  } catch (e) {
    console.error('logActivity failed:', e)
  }
}
