// Crash reporting: page errors on either site are sent to Systems → Health (app_errors, via log_app_error).
// Production only. Each distinct error is sent once per page load, and at most 10 per visit.
import { supabase } from './supabase';
import { SITE } from './site';
import { CHUNK_ERROR } from './reload';

// Browser extensions, ad blockers and harmless browser quirks — not our bugs.
const NOISE = /ResizeObserver loop|chrome-extension:|moz-extension:|safari-extension:|Script error\.?$|Non-Error promise rejection|AbortError|The operation was aborted/i;

const sent = new Set();
let budget = 10;

export function reportError(error, kind = 'error', extra = {}) {
  if (!import.meta.env.PROD || !supabase) return;
  const message = String(error?.message || error || '').trim();
  if (!message || NOISE.test(message) || NOISE.test(error?.stack || '')) return;
  const key = `${kind}|${message}`;
  if (sent.has(key) || budget <= 0) return;
  sent.add(key);
  budget -= 1;
  const stack = [error?.stack, extra.componentStack].filter(Boolean).join('\n--- component ---\n');
  supabase.rpc('log_app_error', {
    p: {
      kind: CHUNK_ERROR.test(message) ? 'chunk' : kind,
      message,
      stack: stack.slice(0, 4000),
      path: window.location.pathname,
      site: SITE,
      release: import.meta.env.VITE_RELEASE || '',
      user_agent: navigator.userAgent,
    },
  }).then(() => {}, () => {}); // reporting never throws
}

/** Catch errors that happen outside React rendering (event handlers, timers, failed promises). */
export function installErrorReporting() {
  if (!import.meta.env.PROD) return;
  window.addEventListener('error', (e) => {
    // Resource load failures (an image 404) have no error object; skip them.
    if (e.error || e.message) reportError(e.error || e.message, 'error');
  });
  window.addEventListener('unhandledrejection', (e) => reportError(e.reason, 'promise'));
}
