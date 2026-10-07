// Pages that open on the dark brand hero. The top bar sits clear over them
// and the page starts at the very top (the hero makes room for the bar).
const FLUSH = new Set([
  '/', '/shop', '/favorites', '/directory', '/calendar', '/about', '/services', '/partner',
  '/login', '/register', '/unsubscribe', '/onboarding-exclusive',
]);

export const isFlushRoute = (pathname) => FLUSH.has(pathname.replace(/\/+$/, '') || '/');
