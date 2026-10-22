// Calendly scheduling for the Collective. The widget script loads only when a
// calendar is actually shown or opened, and every booking is logged for the CRM.
import { supabase } from './supabase';
import { DEFAULTS, getSiteInfo, isCalendlyUrl, loadSiteInfo } from './siteInfo';

// The links themselves are site info (Systems > Site info), so an admin can change them without a deploy.
// Only https://calendly.com/ links are used; anything else falls back to the default.
const LINK_KEYS = { intro: 'calendlyIntro', session: 'calendlySession', session90: 'calendlySession90', connect: 'calendlyConnect' };
const linkFor = (kind) => {
  const key = LINK_KEYS[kind];
  const saved = getSiteInfo()[key];
  return isCalendlyUrl(saved) ? saved : DEFAULTS[key];
};

export const CALENDLY = {
  intro: {
    get url() { return linkFor('intro'); },
    label: 'Private Mentorship Intro Call',
    length: '30 min',
  },
  session: {
    get url() { return linkFor('session'); },
    label: 'Private Mentorship & Business Coaching Session',
    length: '60 min',
  },
  session90: {
    get url() { return linkFor('session90'); },
    label: 'Couples Private Mentorship & Hybrid Business Coaching Session',
    length: '90 min',
  },
  connect: {
    get url() { return linkFor('connect'); },
    label: 'Connect / Collab Call with Melanie JC',
    length: '30 min',
  },
};

// 90-minute sessions: Couples Private Mentorship, and the two Hybrid Business Coaching options.
const LONG_PACKAGES = ['Option 2', 'Option 4'];
export const sessionKind = (programSlug, planPackage) =>
  (programSlug === 'couples' || LONG_PACKAGES.includes(planPackage) ? 'session90' : 'session');

let loading = null;
export function loadCalendly() {
  if (window.Calendly) return Promise.resolve(window.Calendly);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://assets.calendly.com/assets/external/widget.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://assets.calendly.com/assets/external/widget.js';
    js.async = true;
    js.onload = () => resolve(window.Calendly);
    js.onerror = () => { loading = null; reject(new Error('Calendly could not load')); };
    document.head.appendChild(js);
  });
  return loading;
}

/** Calendly link with our colors and the visitor's details filled in. */
export function calendlyUrl(kind, { name, email, source } = {}) {
  const u = new URL(CALENDLY[kind].url);
  u.searchParams.set('hide_gdpr_banner', '1');
  u.searchParams.set('primary_color', '5e2a8c');
  u.searchParams.set('text_color', '201431');
  u.searchParams.set('background_color', 'fcfbfe');
  if (name) u.searchParams.set('name', name);
  if (email) u.searchParams.set('email', email);
  u.searchParams.set('utm_source', window.location.hostname.includes('collective') ? 'thep31collective' : 'p31market');
  if (source) u.searchParams.set('utm_content', source);
  return u.toString();
}

/** Open a Calendly booking popup (falls back to a new tab). */
export async function openCalendly(kind, details = {}) {
  watchBookings();
  pending = { kind, ...details };
  // Use the saved booking link if it arrives quickly; the default otherwise.
  await Promise.race([loadSiteInfo(), new Promise((r) => { setTimeout(r, 800); })]);
  const url = calendlyUrl(kind, details);
  try {
    const C = await loadCalendly();
    C.initPopupWidget({ url });
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

// ── Log every booking for the CRM ────────────────────────────
let pending = null;
let watching = false;
export function watchBookings(context) {
  if (context) pending = context;
  if (watching) return;
  watching = true;
  window.addEventListener('message', (e) => {
    if (e.origin !== 'https://calendly.com' || e.data?.event !== 'calendly.event_scheduled') return;
    const p = e.data.payload || {};
    const ctx = pending || {};
    supabase.rpc('crm_log_booking', {
      p_kind: ctx.kind || 'unknown',
      p_event_uri: p.event?.uri || null,
      p_invitee_uri: p.invitee?.uri || null,
      p_name: ctx.name || null,
      p_email: ctx.email || null,
      p_page: `${window.location.host}${window.location.pathname}`,
    }).then(() => {}, () => {});
  });
}
