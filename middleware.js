// Vercel Routing Middleware: one app serves two domains.
//   www.p31market.com         → untouched (passes straight through)
//   www.thep31collective.org  → its own HTML head (icons, install manifest, share card,
//                               structured data), robots.txt and sitemap.xml, built into
//                               dist/c/ by scripts/prerender.mjs.
// Any error falls through to the normal site rather than failing the request.

export const config = {
  matcher: [
    '/', '/mentorship/:path*', '/verify/:path*', '/portal/:path*', '/academy/:path*', '/studio/:path*',
    '/systems/:path*', '/enroll/:path*', '/robots.txt', '/sitemap.xml', '/favicon.ico', '/favicon.png', '/manifest.webmanifest',
  ],
};

const COLLECTIVE = /(^|\.)thep31collective\.org$/i;

const PAGES = {
  '/': '/c/home',
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

const next = () => new Response(null, { headers: { 'x-middleware-next': '1' } });
const rewrite = (url) => new Response(null, { headers: { 'x-middleware-rewrite': String(url) } });

export default function middleware(request) {
  try {
    const url = new URL(request.url);
    if (!COLLECTIVE.test(url.hostname)) return next();
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const dest = FILES[path] || PAGES[path] || (path.startsWith('/verify/') ? '/c/verify' : '/c/app');
    return rewrite(new URL(dest + url.search, url));
  } catch {
    return next();
  }
}
