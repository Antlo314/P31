import { createClient } from '@supabase/supabase-js';
import { demoClient } from '../dev/demo';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Development only: ?demo=admin|student|faith swaps in sample data for walkthrough
// screenshots (?demo=off to stop). Production builds compile this branch away.
const demoMode = (() => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  try {
    const q = new URLSearchParams(window.location.search).get('demo');
    if (q === 'off') sessionStorage.removeItem('p31_demo'); else if (q) sessionStorage.setItem('p31_demo', q);
    return sessionStorage.getItem('p31_demo');
  } catch { return null; }
})();

// Defensive check to prevent app-wide crash
export const supabase = (import.meta.env.DEV && demoMode)
  ? demoClient(demoMode)
  : (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

if (!supabase) {
  console.warn("Supabase credentials missing. Some features may be disabled.");
}
