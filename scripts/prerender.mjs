// Runs after `vite build`. Writes a copy of index.html per public page with
// that page's title, description, share card and structured data baked in,
// so Google and link previews (iMessage, Facebook, X) see real content.
// Also writes sitemap.xml. Storefronts and announced market dates come from
// Supabase with the public anon key; if it's unreachable, static pages still build.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { loadEnv } from 'vite';
import {
  SITE_URL, SITE_NAME, DEFAULT_IMAGE, ROUTE_META, INDEXED_ROUTES, BUSINESS, curatorMeta,
  COLLECTIVE_URL, COLLECTIVE_NAME, COLLECTIVE_IMAGE, COLLECTIVE_META,
} from '../src/lib/seo.js';

const dist = join(process.cwd(), 'dist');
const template = readFileSync(join(dist, 'index.html'), 'utf8');
const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const SB_URL = env.VITE_SUPABASE_URL;
const SB_KEY = env.VITE_SUPABASE_ANON_KEY;

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

function render({ title, description, image = DEFAULT_IMAGE, path, noindex, ld = [], origin = SITE_URL, base = template }) {
  const url = `${origin}${path}`;
  let html = base
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
  contactPoint: [{
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
  { '@type': 'ContactPoint', contactType: 'vendor support', email: 'vendor@p31market.com', availableLanguage: 'English' },
  { '@type': 'ContactPoint', contactType: 'partnerships', email: 'grants@p31market.com', availableLanguage: 'English' },
  { '@type': 'ContactPoint', contactType: 'marketing', email: 'marketing@p31market.com', availableLanguage: 'English' }],
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
  'favorites', 'login', 'register', 'unsubscribe', 'dashboard', 'systems', 'offline', 'sw', 'sitemap', 'robots', 'manifest',
  'mentorship', 'portal', 'enroll', 'academy', 'studio', 'verify', 'c']);
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
  mkdirSync(dirname(join(dist, file)), { recursive: true });
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


// ── The Proverbs 31 Collective (www.thep31collective.org) ────────────────
// Same app, its own head: icons, install manifest, share card and structured
// data. middleware.js serves these files on the Collective's domain.
const C = COLLECTIVE_URL;
const collectiveTemplate = template
  .replace(/\s*<link rel="shortcut icon"[^>]*>/, '')
  .replace(/<link rel="icon"[^>]*>/, [
    '<link rel="icon" type="image/png" sizes="32x32" href="/c/icons/favicon-32.png" />',
    '<link rel="icon" type="image/png" sizes="96x96" href="/c/icons/favicon-96.png" />',
    '<link rel="shortcut icon" href="/c/favicon.ico" />',
  ].join('\n    '))
  .replace(/<link rel="apple-touch-icon"[^>]*>/, '<link rel="apple-touch-icon" href="/c/icons/apple-touch-icon.png" />')
  .replace(/<link rel="manifest"[^>]*>/, '<link rel="manifest" href="/c/manifest.webmanifest" />')
  .replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/, '$1P31 Collective$2')
  .replace(/(<meta property="og:site_name" content=")[^"]*(")/, `$1${COLLECTIVE_NAME}$2`);

const melanie = {
  '@type': 'Person',
  '@id': `${C}/#melanie`,
  name: 'Melanie JC',
  jobTitle: 'Founder & CEO',
  description: 'Servant of God, visionary, mentor and entrepreneur; founder of Not Easily Broken Apart (NEBA) Women’s Ministry and the visionary behind Proverbs 31 Marketplace and The P31 Collective by NEBA.',
  image: `${C}/c/melanie.webp`,
  url: `${C}/#melanie`,
  email: 'founder@thep31collective.org',
  worksFor: [
    { '@id': `${C}/#organization` },
    { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    { '@type': 'Organization', name: 'Not Easily Broken Apart (NEBA) Women’s Ministry', foundingDate: '2019' },
    { '@type': 'Organization', name: 'Incandescent Lily Collection', foundingDate: '2023' },
  ],
  knowsAbout: ['business mentorship', 'faith-based mentorship', 'women entrepreneurs', 'emotional intelligence', 'leadership', 'women’s ministry', 'community building'],
};
// The team directory, as people who work for the Collective.
const team = [
  ['Savannah Campbell', 'Executive Assistant', 'secretary@thep31collective.org'],
  ['Yanni Bratcher', 'Marketing Strategist', 'marketing@p31market.com'],
  ['Alexia Thomas', 'Member Liaison', 'members@thep31collective.org'],
  ['Shanay Prince', 'Support Coordinator', 'coordinator@thep31collective.org'],
  ['Anthony Carr', 'Marketplace Tech Support', 'vendor@p31market.com'],
].map(([name, jobTitle, email]) => ({ '@type': 'Person', name, jobTitle, email }));
const collectiveOrg = {
  '@context': 'https://schema.org',
  '@type': 'EducationalOrganization',
  '@id': `${C}/#organization`,
  name: COLLECTIVE_NAME,
  alternateName: ['The P31 Collective by NEBA', 'P31 Collective', 'Proverbs 31 Collective'],
  url: C,
  logo: `${C}/c/icons/icon-512.png`,
  image: COLLECTIVE_IMAGE,
  description: COLLECTIVE_META['/'].description,
  email: 'members@thep31collective.org',
  telephone: BUSINESS.phone,
  founder: melanie,
  employee: team,
  contactPoint: [
    { '@type': 'ContactPoint', contactType: 'membership', email: 'members@thep31collective.org', telephone: BUSINESS.phone, availableLanguage: 'English' },
    { '@type': 'ContactPoint', contactType: 'customer support', email: 'coordinator@thep31collective.org', availableLanguage: 'English' },
  ],
  parentOrganization: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL },
  sameAs: BUSINESS.sameAs.filter((u) => !u.includes('maps.google')),
  areaServed: { '@type': 'Country', name: 'United States' },
  knowsAbout: ['Christian business mentorship', 'faith-based mentorship', 'women entrepreneurs', 'Proverbs 31 woman'],
};
const collectiveSite = { '@context': 'https://schema.org', '@type': 'WebSite', name: COLLECTIVE_NAME, url: C, publisher: { '@id': `${C}/#organization` } };
const programLd = (slug) => {
  const m = ROUTE_META[`/mentorship/${slug}`];
  return [{
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: slug === 'business' ? 'Proverbs 31 Business Mentorship' : 'Faith-Based Mentorship',
    serviceType: 'Mentorship',
    description: m.description,
    url: `${C}/mentorship/${slug}`,
    provider: { '@id': `${C}/#organization` },
    audience: { '@type': 'Audience', audienceType: 'Faith-driven women and women entrepreneurs' },
    areaServed: { '@type': 'Country', name: 'United States' },
  }, {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: COLLECTIVE_NAME, item: C },
      { '@type': 'ListItem', position: 2, name: 'Mentorship', item: `${C}/mentorship` },
      { '@type': 'ListItem', position: 3, name: m.title.split(' — ')[0], item: `${C}/mentorship/${slug}` },
    ],
  }];
};

const crumb = (name, path) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: COLLECTIVE_NAME, item: C },
    { '@type': 'ListItem', position: 2, name, item: `${C}${path}` },
  ],
});

const collectivePages = [
  { file: 'home', path: '/', ...COLLECTIVE_META['/'], ld: [collectiveOrg, collectiveSite, { '@context': 'https://schema.org', ...melanie }] },
  { file: 'mentorship', path: '/mentorship', ...ROUTE_META['/mentorship'], ld: [collectiveOrg] },
  { file: 'mentorship/business', path: '/mentorship/business', ...ROUTE_META['/mentorship/business'], ld: programLd('business') },
  { file: 'mentorship/faith', path: '/mentorship/faith', ...ROUTE_META['/mentorship/faith'], ld: programLd('faith') },
  { file: 'academy', path: '/academy', ...COLLECTIVE_META['/academy'], ld: [collectiveOrg, crumb('The P31 Academy', '/academy')] },
  { file: 'join', path: '/join', ...COLLECTIVE_META['/join'], ld: [collectiveOrg, crumb('Join P31 Collective', '/join')] },
  { file: 'systems', path: '/systems', ...COLLECTIVE_META['/systems'], ld: [collectiveOrg, crumb('P31 Systems', '/systems')] },
  { file: 'verify', path: '/verify', ...COLLECTIVE_META['/verify'] },
  // Every other Collective route (portal, classrooms, Studio, Systems): the app shell, not indexed.
  { file: 'app', path: '/portal', title: COLLECTIVE_NAME, description: COLLECTIVE_META['/'].description, noindex: true },
];
for (const page of collectivePages) {
  const out = join(dist, 'c', `${page.file}.html`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, render({ ...page, origin: C, image: COLLECTIVE_IMAGE, base: collectiveTemplate }));
}
const cUrls = ['/', '/join', '/academy', '/mentorship', '/mentorship/business', '/mentorship/faith', '/systems'];
writeFileSync(join(dist, 'c', 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${cUrls.map((p) => `  <url><loc>${esc(`${C}${p}`)}</loc><priority>${p === '/' ? '1.0' : '0.9'}</priority></url>`).join('\n')}
</urlset>
`);
console.log(`prerender: ${collectivePages.length} Collective pages, sitemap with ${cUrls.length} URLs`);
