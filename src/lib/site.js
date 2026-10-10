import { SITE_URL, COLLECTIVE_URL } from './seo';

// One app, two front doors, one Supabase behind both:
//   www.p31market.com         — the marketplace: shop, curators, market dates, curator sign-in
//   www.thep31collective.org  — The Proverbs 31 Collective: mentorships, classrooms, and every
//                               team sign-in (member portal, Content Studio, Systems)
// On localhost and Vercel previews there's only one host, so ?site=collective
// (or ?site=market) picks the side; it sticks for the browser tab.
const COLLECTIVE_HOST = /(^|\.)thep31collective\.org$/i;
const MARKET_HOST = /(^|\.)p31market\.com$/i;

const host = typeof window === 'undefined' ? '' : window.location.hostname;
const production = COLLECTIVE_HOST.test(host) || MARKET_HOST.test(host);

function previewSite() {
  try {
    const q = new URLSearchParams(window.location.search).get('site');
    if (q === 'collective' || q === 'market') sessionStorage.setItem('p31_site', q);
    return sessionStorage.getItem('p31_site') || 'market';
  } catch { return 'market'; }
}

export const SITE = !host ? 'market' : production ? (COLLECTIVE_HOST.test(host) ? 'collective' : 'market') : previewSite();
export const isCollective = SITE === 'collective';

// Which side owns a path. Each side has its own home page at "/".
const COLLECTIVE_PATH = /^\/(mentorship|enroll|academy|portal|studio|systems|verify|join|today)(\/|$)/;
const SHARED_PATH = /^\/(__lab)?\/?$/;
const ownerOf = (pathname) => {
  if (COLLECTIVE_PATH.test(pathname)) return 'collective';
  if (SHARED_PATH.test(pathname)) return null;
  return 'market';
};

// A path on the given side: a full URL in production, or ?site= on previews.
function siteUrl(site, path) {
  if (production) return `${site === 'collective' ? COLLECTIVE_URL : SITE_URL}${path}`;
  const u = new URL(path, window.location.origin);
  u.searchParams.set('site', site);
  return `${u.pathname}${u.search}${u.hash}`;
}

/** Where to send someone who opened a path that belongs to the other side, or null. */
export function crossSiteTarget(pathname, search = '', hash = '') {
  const owner = ownerOf(pathname);
  if (!owner || owner === SITE) return null;
  return siteUrl(owner, `${pathname}${search}${hash}`);
}

/** href for an in-app path: unchanged on this side, a full link to the other side. */
export function hrefFor(path) {
  const owner = ownerOf(path.split(/[?#]/)[0]);
  if (!owner || owner === SITE) return path;
  return siteUrl(owner, path);
}

/** The Collective's member portal, from either side. */
export const collectivePortal = () => (isCollective ? '/portal' : siteUrl('collective', '/portal'));
/** The Collective's home, from either side. */
export const collectiveHome = () => (isCollective ? '/' : siteUrl('collective', '/'));
/** The marketplace home, from either side. */
export const marketHome = () => (isCollective ? siteUrl('market', '/') : '/');
