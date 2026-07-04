import { supabase } from './supabase'

/** Resolve the employee record linked to a user account. */
export async function employeeForUser(userId: string) {
  const { data } = await supabase.from('employees').select('id, name').eq('user_id', userId).single()
  return data
}
