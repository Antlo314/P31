import { supabase } from './supabase';

// Calls a Supabase Edge Function (in supabase/functions/). The current auth
// token — or the anon key when signed out — is attached automatically, so both
// vendor-only endpoints and the public checkout endpoint work through this.
export async function invokePayment(fnName, body = {}) {
  if (!supabase) throw new Error('Backend is not configured.');

  const { data, error } = await supabase.functions.invoke(fnName, { body });

  if (error) {
    // FunctionsHttpError carries the raw Response; surface its { error } message.
    let message = error.message || 'Payment request failed.';
    try {
      const ctx = await error.context?.json?.();
      if (ctx?.error) message = ctx.error;
    } catch {
      // keep the default message
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
