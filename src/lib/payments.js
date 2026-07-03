import { supabase } from './supabase';

// Master switch for built-in card payments (Stripe Connect). OFF by default:
// all card-payment UI is hidden and curators get paid through their own
// pasted links (Stripe payment link, CashApp, Venmo) instead. To activate,
// set VITE_ENABLE_CARD_PAYMENTS=true in .env, complete STRIPE_SETUP.md,
// and redeploy.
export const CARD_PAYMENTS_ENABLED = import.meta.env.VITE_ENABLE_CARD_PAYMENTS === 'true';

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
