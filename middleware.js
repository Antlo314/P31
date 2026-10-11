// Vercel Routing Middleware: one app serves two domains, and shop links preview properly.
//   www.thep31collective.org  → its own HTML head (icons, install manifest, share card,
//                               structured data), robots.txt and sitemap.xml, built into
//                               dist/c/ by scripts/prerender.mjs.
//   www.p31market.com         → passes straight through, except for link crawlers
//                               (Instagram, Facebook, iMessage, X, WhatsApp, Google…) opening
//                               a storefront (/her-shop) or a product (/her-shop?p=123): they
//                               get the page with that shop's or product's own title, photo,
//                               price and description, so every share looks like the thing
//                               being sold. People get the normal app.
// Any error falls through to the normal site rather than failing the request.
/* global process */

export const config = {
  matcher: [
    '/', '/join', '/today', '/mentorship/:path*', '/verify/:path*', '/portal/:path*', '/academy/:path*', '/studio/:path*',
    '/systems/:path*', '/enroll/:path*', '/robots.txt', '/sitemap.xml', '/favicon.ico', '/favicon.png', '/manifest.webmanifest',
    '/:slug',
  ],
};

const COLLECTIVE = /(^|\.)thep31collective\.org$/i;
const SITE_NAME = 'Proverbs 31 Marketplace';

const PAGES = {
  '/': '/c/home',
  '/academy': '/c/academy',
  '/join': '/c/join',
  '/systems': '/c/systems',
  '/mentorship': '/c/mentorship',
  '/mentorship/business': '/c/mentorship/business',
  '/mentorship/faith': '/c/mentorship/faith',
  '/verify': '/c/verify',
};
const FILES = {
  '/robots.txt': '/c/robots.txt',
  '/sitemap.xml': '/c/sitemap.xml',
  '/favicon.ico': '/c/favicon.ico',
  '/favicon.png': '/c/favicon.png',
  '/manifest.webmanifest': '/c/manifest.webmanifest',
};

// Paths that are app routes or files, never a shop (mirrors scripts/prerender.mjs).
const RESERVED = new Set(['index', 'assets', 'icons', 'shop', 'directory', 'calendar', 'about', 'services', 'partner',
  'favorites', 'login', 'register', 'unsubscribe', 'dashboard', 'systems', 'offline', 'sw', 'sitemap', 'robots', 'manifest',
  'mentorship', 'portal', 'enroll', 'academy', 'studio', 'verify', 'c', 'apply', 'join', 'today', 'onboarding-exclusive', 'community', 'fonts',
  'vendors', 'volunteer']);
const safeSlug = (s) => /^[a-z0-9][a-z0-9_-]{0,80}$/i.test(s || '') && !RESERVED.has(s.toLowerCase());

// Link-preview and search crawlers (iMessage and Instagram identify as Facebook's).
const CRAWLER = /facebookexternalhit|facebot|twitterbot|linkedinbot|pinterest|slackbot|discordbot|whatsapp|telegrambot|googlebot|bingbot|applebot|duckduckbot|redditbot|embedly|iframely|skypeuripreview|snapchat|google-inspectiontool|yandex|baiduspider|quora link preview|vkshare|outbrain|flipboard|nuzzel|qwantify|bitlybot|tumblr|mastodon|bluesky|cardyb/i;

const next = () => new Response(null, { headers: { 'x-middleware-next': '1' } });
const rewrite = (url) => new Response(null, { headers: { 'x-middleware-rewrite': String(url) } });

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clean = (s = '', max = 180) => String(s).replace(/\s+/g, ' ').trim().slice(0, max);
const money = (n) => `$${Number(n).toFixed(Number(n) % 1 ? 2 : 0)}`;
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
// A crawler waits a few seconds at most; past that it gets the normal page.
const timeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };

async function select(table, query) {
  const base = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !key) return [];
  const res = await fetch(`${base}/rest/v1/${table}?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: timeout(4000),
  });
  if (!res.ok) return [];
  return res.json();
}

/** The storefront page with this shop's (or product's) own share card and structured data. */
async function shareHead(request, url, slug) {
  const [shop] = await select('curator_data',
    `select=id,slug,business_name,tagline,bio,logo_url,banner_url,location&slug=eq.${encodeURIComponent(slug)}&status=eq.approved&limit=1`);
  if (!shop?.business_name) return null;

  const pid = Number(url.searchParams.get('p'));
  const [product] = pid > 0
    ? await select('products', `select=id,name,price,compare_at_price,description,image_url,badge,stock_status&id=eq.${pid}&curator_id=eq.${shop.id}&limit=1`)
    : [];

  const origin = `${url.protocol}//${url.host}`;
  const defaultImage = `${origin}/og-image.jpg?v=2`;
  const shopUrl = `${origin}/${shop.slug}`;
  const page = product
    ? {
      title: `${product.name} · ${money(product.price)} — ${shop.business_name}`,
      description: clean(product.description) || `Shop ${product.name} from ${shop.business_name} on ${SITE_NAME}.`,
      image: product.image_url || shop.banner_url || shop.logo_url || defaultImage,
      url: `${shopUrl}?p=${product.id}`,
      type: 'product',
      ld: {
        '@context': 'https://schema.org', '@type': 'Product', name: product.name, description: clean(product.description, 500) || undefined,
        image: product.image_url || undefined, url: `${shopUrl}?p=${product.id}`,
        brand: { '@type': 'Brand', name: shop.business_name },
        offers: {
          '@type': 'Offer', price: Number(product.price).toFixed(2), priceCurrency: 'USD', url: `${shopUrl}?p=${product.id}`,
          availability: product.stock_status === 'out_of_stock' ? 'https://schema.org/OutOfStock'
            : product.stock_status === 'pre_order' ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock',
          seller: { '@type': 'Organization', name: shop.business_name },
        },
      },
    }
    : {
      title: `${shop.business_name} — ${SITE_NAME}`,
      description: clean(shop.tagline || shop.bio) || `Shop ${shop.business_name} on ${SITE_NAME}.`,
      image: shop.banner_url || shop.logo_url || defaultImage,
      url: shopUrl,
      type: 'website',
      ld: {
        '@context': 'https://schema.org', '@type': 'Store', name: shop.business_name, description: clean(shop.tagline || shop.bio, 500) || undefined,
        image: shop.banner_url || shop.logo_url || undefined, url: shopUrl,
        address: shop.location ? { '@type': 'PostalAddress', addressLocality: shop.location } : undefined,
      },
    };

  // The built app shell, then its head swapped for this page.
  const res = await fetch(new URL('/', request.url), { headers: { 'x-p31-internal': '1', accept: 'text/html' }, signal: timeout(4000) });
  if (!res.ok) return null;
  let html = await res.text();
  const ownImage = page.image !== defaultImage;
  html = html
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, '')
    .replace(/\s*<link rel="canonical"[^>]*>/g, '')
    .replace(/\s*<meta name="robots"[^>]*>/g, '')
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(page.title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(page.description)}$2`)
    .replace(/(<meta property="og:type" content=")[^"]*(")/, `$1${page.type}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(page.title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(page.description)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${esc(page.url)}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(page.image)}$2`);
  if (ownImage) html = html.replace(/\s*<meta property="og:image:(?:width|height)"[^>]*>/g, '');
  const extra = [
    `<link rel="canonical" href="${esc(page.url)}" />`,
    '<meta name="robots" content="index, follow" />',
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${esc(page.image)}" />`,
    ...(product ? [
      `<meta property="product:price:amount" content="${Number(product.price).toFixed(2)}" />`,
      '<meta property="product:price:currency" content="USD" />',
    ] : []),
    jsonLd(page.ld),
  ].join('\n    ');
  html = html.replace('</head>', `    ${extra}\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root"></div>\n    <noscript><h1>${esc(page.title)}</h1><p>${esc(page.description)}</p></noscript>`);
  return html;
}

export default async function middleware(request) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (COLLECTIVE.test(url.hostname)) {
      // Real files (sw.js, images, fonts) pass through untouched.
      if (/\.[a-z0-9]+$/i.test(path) && !FILES[path]) return next();
      const dest = FILES[path] || PAGES[path] || (path.startsWith('/verify/') ? '/c/verify' : '/c/app');
      return rewrite(new URL(dest + url.search, url));
    }

    // Market: crawlers opening a shop or product link get its own share card.
    const slug = path.slice(1);
    const crawler = CRAWLER.test(request.headers.get('user-agent') || '') || url.searchParams.has('_share');
    if (!crawler || request.headers.get('x-p31-internal') || path.includes('/') && path !== `/${slug}` || !safeSlug(slug)) return next();
    const html = await shareHead(request, url, slug);
    if (!html) return next();
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400', 'x-p31-share': '1' },
    });
  } catch {
    return next();
  }
}
