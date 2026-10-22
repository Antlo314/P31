// Site info an admin edits in Systems > Site info (v63), read by both public sites without a deploy.
// DEFAULTS are today's values and the one copy of them in the code: pages render with these at once,
// then the app_settings row 'site_public' (only the fields an admin changed) is merged over them.
// If the row or its read policy is missing, everything keeps working on the defaults.
// seo.js and scripts/prerender.mjs (build time) use DEFAULTS only, so search-engine text follows on the next deploy.
// Node imports this file too (prerender via seo.js), so it must not import supabase or Vite-only code at the top.
import React from 'react';

export const DEFAULTS = {
  // Contact
  phone: '(470) 562-2852',
  hours: 'Monday–Friday, 10am–6pm',
  mailingLine1: '1475 Buford Drive #403-777',
  mailingLine2: 'Lawrenceville, GA 30043',
  // Social links
  marketInstagram: 'https://www.instagram.com/proverbs31market',
  // The footer and menu link. seo.js used https://www.facebook.com/profile.php?id=61586620469891 until v63.
  marketFacebook: 'https://www.facebook.com/share/1LEtAu9AJD/?mibextid=wwXIfr',
  marketTiktok: 'https://www.tiktok.com/@p31marketplace',
  collectiveInstagram: 'https://www.instagram.com/the.p31collective',
  collectiveFacebook: 'https://www.facebook.com/share/1LEtAu9AJD/?mibextid=wwXIfr',
  // Booking links (Calendly)
  calendlyIntro: 'https://calendly.com/nebamentorship/neba-mentorship-intro-call',
  calendlySession: 'https://calendly.com/purposefullydriven7/privatementorship',
  calendlySession90: 'https://calendly.com/p31collectiveofficial/30min',
  calendlyConnect: 'https://calendly.com/mjeffers031/connectcall',
  // Giving & links
  donateUrl: 'https://www.paypal.com/donate/?hosted_button_id=WY2ZX3TXDMF5Y',
  linktree: 'https://linktr.ee/p31marketplaceandcollective',
  googleReviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJ1TZlBgq_9YgROkLISp4BB7U',
  joinFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfBZkXVjzeqjq_h5k0Np3ueFZbiYzp19ettlL5CF5uBHYjBTw/viewform?pli=1',
  vendorFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSd01zHJUEqZV59puRf5YRrBsg05bT__mAsefYuy6bhQ5ef-oA/viewform',
  // Podcast (an empty link shows the platform as a badge only)
  podcastListen: 'https://melaniejcpodcast.buzzsprout.com/',
  podcastApple: 'https://podcasts.apple.com/us/podcast/neba-womens-ministrys-podcast/id1609875088',
  podcastSpotify: 'https://open.spotify.com/show/6NrJlx0dDts2cfUKP6ZIiE',
  podcastIheart: '',
  podcastAudible: '',
  podcastYoutube: '',
  podcastInstagram: 'https://www.instagram.com/the.p31podcast',
  podcastFacebook: 'https://www.facebook.com/share/1DaWb4crTC/',
  // Membership (dollars per month)
  membershipMonthly: 27,
};

/** Every editable field, grouped for the admin page. kind: text | phone | url | calendly | price. */
export const FIELD_GROUPS = [
  { id: 'contact', label: 'Contact', fields: [
    { key: 'phone', label: 'Phone', kind: 'phone' },
    { key: 'hours', label: 'Office hours', kind: 'text' },
    { key: 'mailingLine1', label: 'Mailing address, line 1', kind: 'text' },
    { key: 'mailingLine2', label: 'Mailing address, line 2', kind: 'text' },
  ] },
  { id: 'social', label: 'Social links', fields: [
    { key: 'marketInstagram', label: 'Marketplace Instagram', kind: 'url' },
    { key: 'marketFacebook', label: 'Marketplace Facebook', kind: 'url' },
    { key: 'marketTiktok', label: 'Marketplace TikTok', kind: 'url' },
    { key: 'collectiveInstagram', label: 'Collective Instagram', kind: 'url' },
    { key: 'collectiveFacebook', label: 'Collective Facebook', kind: 'url' },
  ] },
  { id: 'booking', label: 'Booking links', fields: [
    { key: 'calendlyIntro', label: 'Mentorship intro call (30 min)', kind: 'calendly' },
    { key: 'calendlySession', label: 'Mentorship & coaching session (60 min)', kind: 'calendly' },
    { key: 'calendlySession90', label: 'Couples & hybrid coaching session (90 min)', kind: 'calendly' },
    { key: 'calendlyConnect', label: 'Connect / collab call with Melanie JC (30 min)', kind: 'calendly' },
  ] },
  { id: 'giving', label: 'Giving & links', fields: [
    { key: 'donateUrl', label: 'Donate link (PayPal)', kind: 'url' },
    { key: 'linktree', label: 'Linktree', kind: 'url', optional: true },
    { key: 'googleReviewUrl', label: 'Google review link', kind: 'url' },
    { key: 'joinFormUrl', label: 'Collective join form, Google Form fallback', kind: 'url' },
    { key: 'vendorFormUrl', label: 'Vendor application, Google Form fallback', kind: 'url' },
  ] },
  { id: 'podcast', label: 'Podcast', fields: [
    { key: 'podcastListen', label: 'Listen link (main)', kind: 'url' },
    { key: 'podcastApple', label: 'Apple Podcasts', kind: 'url', optional: true },
    { key: 'podcastSpotify', label: 'Spotify', kind: 'url', optional: true },
    { key: 'podcastIheart', label: 'iHeartRadio', kind: 'url', optional: true },
    { key: 'podcastAudible', label: 'Audible', kind: 'url', optional: true },
    { key: 'podcastYoutube', label: 'YouTube', kind: 'url', optional: true },
    { key: 'podcastInstagram', label: 'Podcast Instagram', kind: 'url', optional: true },
    { key: 'podcastFacebook', label: 'Podcast Facebook', kind: 'url', optional: true },
  ] },
  { id: 'membership', label: 'Membership', fields: [
    { key: 'membershipMonthly', label: 'Collective membership, dollars per month (shown on the site only)', kind: 'price' },
  ] },
];
export const FIELDS = Object.fromEntries(FIELD_GROUPS.flatMap((g) => g.fields).map((f) => [f.key, f]));

// ── Validation (shared by the loader and the admin page) ─────
const digitsOf = (s) => String(s || '').replace(/\D/g, '');
/** 10 digits, or 11 starting with 1. */
export const isPhone = (s) => { const d = digitsOf(s); return d.length === 10 || (d.length === 11 && d[0] === '1'); };
/** tel: link target, for example +14705622852. */
export const telOf = (s) => { const d = digitsOf(s); return `+${d.length === 10 ? '1' : ''}${d}`; };
export const isHttpsUrl = (s) => {
  if (typeof s !== 'string' || !s.startsWith('https://') || /\s/.test(s)) return false;
  try { return !!new URL(s).hostname.includes('.'); } catch { return false; }
};
export const isCalendlyUrl = (s) => isHttpsUrl(s) && s.startsWith('https://calendly.com/');

/** Why a value is not allowed for a field, or '' when it is fine. */
export function fieldError(key, value) {
  const f = FIELDS[key];
  if (!f) return 'Unknown field.';
  if (f.kind === 'price') {
    const n = Number(value);
    return value !== '' && Number.isFinite(n) && n > 0 && n <= 10000 ? '' : 'Enter a price in dollars, for example 27.';
  }
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return f.optional ? '' : 'This one cannot be empty. Use Reset to default instead.';
  if (v.length > 500) return 'Too long.';
  if (f.kind === 'phone') return isPhone(v) ? '' : 'Enter a US phone number, for example (470) 562-2852.';
  if (f.kind === 'calendly') return isCalendlyUrl(v) ? '' : 'Must be a Calendly link starting with https://calendly.com/';
  if (f.kind === 'url') return isHttpsUrl(v) ? '' : 'Must be a full link starting with https://';
  return '';
}

/** Keep only known, valid fields from a saved row (anything else falls back to the default). */
export function sanitize(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const key of Object.keys(FIELDS)) {
    if (!(key in raw)) continue;
    const v = FIELDS[key].kind === 'price' ? Number(raw[key]) : (typeof raw[key] === 'string' ? raw[key].trim() : null);
    if (v !== null && !fieldError(key, v)) out[key] = v;
  }
  return out;
}

/** $27 or $27.50 */
export const formatMonthly = (n) => `$${Number.isInteger(Number(n)) ? Number(n) : Number(n).toFixed(2)}`;

// ── Cached loader: one fetch per page load, sessionStorage between pages ─
const CACHE_KEY = 'p31_site_info';
const readCache = () => {
  try { return sanitize(JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null')); } catch { return {}; }
};
let current = typeof window === 'undefined' ? DEFAULTS : { ...DEFAULTS, ...readCache() };
let loading = null;
const listeners = new Set();
const publish = (overrides) => {
  const next = { ...DEFAULTS, ...overrides };
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(overrides)); } catch { /* private mode */ }
  if (Object.keys(next).every((k) => next[k] === current[k])) return;
  current = next;
  listeners.forEach((fn) => fn());
};

/** Fetch the saved site info once per page load. Resolves to the merged values; never rejects. */
export function loadSiteInfo() {
  if (typeof window === 'undefined') return Promise.resolve(current);
  if (!loading) {
    loading = import('./supabase')
      .then(({ supabase }) => (supabase ? supabase.from('app_settings').select('value').eq('key', 'site_public').maybeSingle() : null))
      .then((res) => { if (res && !res.error) publish(sanitize(res.data?.value)); })
      .catch(() => {})
      .then(() => current);
  }
  return loading;
}

/** The current values right now: defaults (or this tab's cache) until the saved row arrives. */
export const getSiteInfo = () => current;

/** After an admin saves: show the new values in this tab straight away. */
export const applySiteInfo = (overrides) => publish(sanitize(overrides));

const subscribe = (fn) => { listeners.add(fn); loadSiteInfo(); return () => listeners.delete(fn); };
const getServer = () => DEFAULTS;

/** The merged site info; re-renders when the saved values arrive. */
export const useSiteInfo = () => React.useSyncExternalStore(subscribe, getSiteInfo, getServer);
