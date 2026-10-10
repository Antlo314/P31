/* Proverbs 31 Marketplace — service worker.
   - App shell + offline page are pre-cached.
   - Page loads: network first, falling back to the cached shell, then offline.html.
   - Built assets (/assets/*, hashed names): cache first.
   - Google Fonts: stale-while-revalidate.
   - Never cached: Supabase data/storage/functions, Stripe, videos, anything non-GET. */
const VERSION = 'p31-v4';
const SHELL = ['/', '/offline.html', '/icons/icon-192.png', '/manifest.webmanifest'];

// Browsers won't serve a cached *redirected* response to a page load
// (Vercel's clean URLs redirect /offline.html → /offline), so store a plain copy.
const plain = (res) => (res.redirected
  ? new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers })
  : res);
const isPage = (res) => res.ok && (res.headers.get('content-type') || '').includes('text/html');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.all(SHELL.map((u) => fetch(u, { cache: 'reload' }).then((res) => res.ok && c.put(u, plain(res))))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isFont = (url) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Page navigations (any route of the single-page app).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (isPage(res)) {
            const copy = plain(res.clone());
            caches.open(VERSION).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(async () => (await caches.match('/')) || caches.match('/offline.html')),
    );
    return;
  }

  // Hashed build assets — safe to keep forever (skip big media).
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/') && !/\.(mp4|webm|mov)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }

  if (isFont(url)) {
    event.respondWith(
      caches.open(VERSION).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }),
    );
  }
  // Everything else (Supabase, Stripe, videos, AI models) goes straight to the network.
});
