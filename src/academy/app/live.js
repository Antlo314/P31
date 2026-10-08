import { supabase } from '../../lib/supabase';

/** Admin switch: register the call-tracking webhook with Daily (daily-room install-webhook). */
export async function installCallTracking() {
  const { data, error } = await supabase.functions.invoke('daily-room', { body: { action: 'install-webhook' } });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context?.json())?.error || msg; } catch { /* keep message */ }
    return { error: msg };
  }
  return data;
}
