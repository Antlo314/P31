// Start downloading a page's code the moment someone shows intent (pointer over a link, a touch,
// keyboard focus), so the click lands on code that is already here. Each page loads once.
const started = new Set();

/**
 * routes: [[RegExp, loader]] in match order; loader is the same `() => import(...)` given to React.lazy.
 * Returns a cleanup function.
 */
export function startIntentPreload(routes) {
  if (typeof document === 'undefined') return () => {};
  const conn = navigator.connection;
  if (conn?.saveData || /2g/.test(conn?.effectiveType || '')) return () => {}; // respect data saver and slow links

  const preload = (href) => {
    let url;
    try { url = new URL(href, window.location.href); } catch { return; }
    if (url.origin !== window.location.origin) return;
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const hit = routes.find(([test]) => test.test(path));
    if (!hit || started.has(hit[1])) return;
    started.add(hit[1]);
    hit[1]().catch(() => started.delete(hit[1])); // a failed fetch can try again later
  };
  const onIntent = (e) => {
    const a = e.target?.closest?.('a[href]');
    if (a && !a.target) preload(a.getAttribute('href'));
  };
  document.addEventListener('pointerover', onIntent, { passive: true });
  document.addEventListener('touchstart', onIntent, { passive: true });
  document.addEventListener('focusin', onIntent);
  return () => {
    document.removeEventListener('pointerover', onIntent);
    document.removeEventListener('touchstart', onIntent);
    document.removeEventListener('focusin', onIntent);
  };
}
