// Page titles, descriptions and share cards — one source for the live app
// (applyMeta on route change) and the build step (scripts/prerender.mjs),
// which bakes them into static HTML so search engines and link previews see them.
// www is the host Vercel serves; the bare domain redirects here.
export const SITE_URL = 'https://www.p31market.com';
export const SITE_NAME = 'Proverbs 31 Marketplace';
// The mentorships, member portal and classrooms live on their own domain
// (same app, same Supabase): see src/lib/site.js.
export const COLLECTIVE_URL = 'https://www.thep31collective.org';
export const COLLECTIVE_NAME = 'The Proverbs 31 Collective';
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

// The business as Google knows it — the Google Business Profile and socials,
// linked from structured data so search ties the site to the listing.
export const BUSINESS = {
  phone: '+1-470-562-2852',
  email: 'proverbs31markets@gmail.com',
  founder: 'Melanie Jeffers-Cameron',
  googleMaps: 'https://maps.google.com/maps?cid=13044396625073029690',
  sameAs: [
    'https://www.instagram.com/proverbs31market',
    'https://www.facebook.com/profile.php?id=61586620469891',
    'https://www.tiktok.com/@p31marketplace',
    'https://maps.google.com/maps?cid=13044396625073029690',
  ],
  areaServed: ['Atlanta, GA', 'Gwinnett County, GA', 'Fulton County, GA', 'Duluth, GA', 'Lawrenceville, GA',
    'Suwanee, GA', 'Buford, GA', 'Norcross, GA', 'Snellville, GA', 'Lilburn, GA', 'Peachtree Corners, GA'],
};

export const ROUTE_META = {
  '/': {
    title: `${SITE_NAME} — Atlanta Market for Women Vendors`,
    description: 'Where her gifts make room: a curated, traveling marketplace for women creatives and faith-driven entrepreneurs. Shop women-owned brands and join seasonal pop-up markets in Atlanta and Gwinnett.',
  },
  '/shop': {
    title: `Shop Women-Owned Brands — ${SITE_NAME}`,
    description: 'Handmade goods, beauty, fashion, art and more from women-owned small businesses around Atlanta, hand-selected by Proverbs 31 Marketplace.',
  },
  '/directory': {
    title: `Women Vendors & Makers in Atlanta — ${SITE_NAME}`,
    description: 'Meet the curators of Proverbs 31 Marketplace: Atlanta-area women makers, artists, stylists and founders building with excellence.',
  },
  '/calendar': {
    title: `Pop-Up Market Dates in Atlanta — ${SITE_NAME}`,
    description: 'Upcoming Proverbs 31 Marketplace pop-up markets in Metro Atlanta and Gwinnett. Shop women-owned brands; all are welcome. Get notified when dates and venues are announced.',
  },
  '/about': {
    title: `Our Story — ${SITE_NAME}`,
    description: 'Inspired by Proverbs 31, founder Melanie Jeffers-Cameron built a traveling Atlanta marketplace and community for women creatives, rooted in faith and excellence.',
  },
  '/services': {
    title: `Vendor Booths, Storefronts & Coaching for Women — ${SITE_NAME}`,
    description: 'Become a curator: an online storefront, a booth at our Atlanta-area markets, brand curation and one-on-one coaching for women-owned brands.',
  },
  '/partner': {
    title: `Sponsor & Partner With Us — ${SITE_NAME}`,
    description: 'Sponsors, venues and brands: partner with Proverbs 31 Marketplace through financial, in-kind or strategic support and reach Atlanta’s women creatives.',
  },
  '/mentorship': {
    origin: COLLECTIVE_URL,
    title: `Mentorship — The Proverbs 31 Collective`,
    description: 'Private business and faith-based mentorship for faith-driven women. Begin with an intro call.',
  },
  '/mentorship/business': {
    origin: COLLECTIVE_URL,
    title: `Proverbs 31 Business Mentorship — Strategy, Structure, Accountability`,
    description: 'Private business mentorship with Melanie JC: weekly or biweekly 60-minute sessions, action plans, launch support and priority access. Book an intro call.',
  },
  '/mentorship/faith': {
    origin: COLLECTIVE_URL,
    title: `Faith-Based Mentorship — The Proverbs 31 Collective`,
    description: 'Grow in faith, identity and calling with a mentor who walks alongside you. Book an intro call.',
  },
  '/portal': { title: `Member portal — ${SITE_NAME}`, description: 'Sign in to your mentorship classroom or the Content Studio.', noindex: true },
  '/favorites': { title: `Your favorites — ${SITE_NAME}`, description: 'Pieces you’ve saved from the collective.', noindex: true },
  '/login': { title: `Sign in — ${SITE_NAME}`, description: 'Curator sign in.', noindex: true },
  '/register': { title: `Join — ${SITE_NAME}`, description: 'Create your curator account.', noindex: true },
  '/unsubscribe': { title: `Unsubscribe — ${SITE_NAME}`, description: 'Manage your email preferences.', noindex: true },
};

// Pages that are worth listing in p31market.com's sitemap (Collective pages live on their own domain).
export const INDEXED_ROUTES = Object.keys(ROUTE_META).filter((p) => !ROUTE_META[p].noindex && !ROUTE_META[p].origin);

export const curatorMeta = (c) => ({
  title: `${c.business_name} — ${SITE_NAME}`,
  description: (c.tagline || c.bio || `Shop ${c.business_name} on ${SITE_NAME}.`).replace(/\s+/g, ' ').slice(0, 180),
  image: c.banner_url || c.logo_url || DEFAULT_IMAGE,
  path: `/${c.slug}`,
});

/** Update <head> in the browser for the current page. */
export function applyMeta({ title, description, image, path, noindex, origin } = {}) {
  if (typeof document === 'undefined') return;
  const set = (selector, attr, value) => {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
      const [, k, v] = selector.match(/\[(\w+(?::\w+)?)="([^"]+)"\]/) || [];
      if (k) el.setAttribute(k, v);
      document.head.appendChild(el);
    }
    el.setAttribute(attr, value);
  };
  const url = `${origin || SITE_URL}${path ?? window.location.pathname}`;
  if (title) {
    document.title = title;
    set('meta[property="og:title"]', 'content', title);
  }
  if (description) {
    set('meta[name="description"]', 'content', description);
    set('meta[property="og:description"]', 'content', description);
  }
  set('meta[property="og:image"]', 'content', image || DEFAULT_IMAGE);
  set('meta[property="og:url"]', 'content', url);
  set('link[rel="canonical"]', 'href', url);
  set('meta[name="robots"]', 'content', noindex ? 'noindex' : 'index, follow');
}
