// Runs after `vite build`. Writes a copy of index.html per public page with
// that page's title, description, share card and structured data baked in,
// so Google and link previews (iMessage, Facebook, X) see real content.
// Also writes sitemap.xml. Storefronts and announced market dates come from
// Supabase with the public anon key; if it's unreachable, static pages still build.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from 'vite';
import { SITE_URL, SITE_NAME, DEFAULT_IMAGE, ROUTE_META, INDEXED_ROUTES, BUSINESS, curatorMeta } from '../src/lib/seo.js';

const dist = join(process.cwd(), 'dist');
const template = readFileSync(join(dist, 'index.html'), 'utf8');
const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const SB_URL = env.VITE_SUPABASE_URL;
const SB_KEY = env.VITE_SUPABASE_ANON_KEY;

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

function render({ title, description, image = DEFAULT_IMAGE, path, noindex, ld = [] }) {
  const url = `${SITE_URL}${path}`;
  let html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(url)}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(image)}$2`);
  const extra = [
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta name="robots" content="${noindex ? 'noindex' : 'index, follow'}" />`,
    ...ld.map(jsonLd),
  ].join('\n    ');
  html = html.replace('</head>', `    ${extra}\n  </head>`);
  // A plain summary for crawlers that don't run JavaScript.
  html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    <noscript><h1>${esc(title)}</h1><p>${esc(description)}</p></noscript>`);
  return html;
}

async function select(table, query) {
  if (!SB_URL || !SB_KEY) return [];
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return await res.json();
  } catch (e) {
    console.warn(`prerender: couldn't read ${table} (${e.message}) — skipping`);
    return [];
  }
}

const today = new Date().toISOString().slice(0, 10);
const [curators, events] = await Promise.all([
  select('curator_data', 'select=slug,business_name,tagline,bio,logo_url,banner_url,location&status=eq.approved&is_published=eq.true&slug=not.is.null'),
  select('market_events', `select=*&event_date=gte.${today}&order=event_date.asc`),
]);

// A service-area business (no storefront), so areaServed instead of an address.
const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: SITE_NAME,
  alternateName: ['P31 Marketplace', 'P31 Market', 'Proverbs 31 Markets'],
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512.png`,
  image: DEFAULT_IMAGE,
  description: ROUTE_META['/'].description,
  slogan: 'Where her gifts make room.',
  telephone: BUSINESS.phone,
  email: BUSINESS.email,
  founder: { '@type': 'Person', name: BUSINESS.founder },
  hasMap: BUSINESS.googleMaps,
  sameAs: BUSINESS.sameAs,
  areaServed: BUSINESS.areaServed.map((name) => ({ '@type': 'Place', name })),
  knowsAbout: ['women-owned businesses', 'pop-up markets', 'handmade goods', 'women entrepreneurs', 'vendor markets'],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    telephone: BUSINESS.phone,
    email: BUSINESS.email,
    areaServed: 'US',
    availableLanguage: 'English',
    hoursAvailable: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '10:00',
      closes: '18:00',
    },
  },
};
const website = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { '@id': `${SITE_URL}/#organization` },
};

// Only markets whose date has been announced get structured event data.
const publicEvents = events.filter((e) => e.date_public && e.is_published !== false);
const eventLd = publicEvents.map((e) => ({
  '@context': 'https://schema.org',
  '@type': 'Event',
  name: e.title || e.name,
  startDate: e.event_date,
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  eventStatus: 'https://schema.org/EventScheduled',
  location: { '@type': 'Place', name: e.venue || e.location || 'Atlanta, GA', address: e.address || e.location || 'Atlanta, GA' },
  image: e.image_url || DEFAULT_IMAGE,
  description: e.description || undefined,
  organizer: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  url: `${SITE_URL}/calendar`,
}));

const pages = Object.keys(ROUTE_META).map((path) => ({
  ...ROUTE_META[path],
  path,
  ld: path === '/' ? [organization, website] : path === '/calendar' ? eventLd : [],
}));

// Slugs that would collide with real files or app routes are left to the SPA.
const RESERVED = new Set(['index', 'assets', 'icons', 'shop', 'directory', 'calendar', 'about', 'services', 'partner',
  'favorites', 'login', 'register', 'unsubscribe', 'dashboard', 'systems', 'offline', 'sw', 'sitemap', 'robots', 'manifest']);
const safeSlug = (s) => /^[a-z0-9][a-z0-9_-]{0,80}$/i.test(s || '') && !RESERVED.has(s.toLowerCase());

const shops = curators.filter((c) => safeSlug(c.slug) && c.business_name);
for (const c of shops) {
  const m = curatorMeta(c);
  pages.push({
    ...m,
    ld: [{
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: c.business_name,
      description: m.description,
      image: m.image,
      url: `${SITE_URL}${m.path}`,
      address: c.location ? { '@type': 'PostalAddress', addressLocality: c.location } : undefined,
    }],
  });
}

// "/shop" → dist/shop.html, served at /shop (vercel.json cleanUrls).
for (const page of pages) {
  const file = page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`;
  writeFileSync(join(dist, file), render(page));
}

const urls = [
  ...INDEXED_ROUTES.map((p) => ({ loc: `${SITE_URL}${p}`, priority: p === '/' ? '1.0' : '0.8' })),
  ...shops.map((c) => ({ loc: `${SITE_URL}/${c.slug}`, priority: '0.7' })),
];
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u.loc)}</loc><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`);

console.log(`prerender: ${pages.length} pages (${shops.length} storefronts, ${publicEvents.length} announced events), sitemap with ${urls.length} URLs`);
