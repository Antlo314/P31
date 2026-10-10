// Site-wide health scan of the LIVE sites and services. Read-only: page loads, headers,
// unauthenticated probes and lookups. It never signs in, submits a form or writes data.
//
//   npm run scan            (needs .env / .env.local for the Supabase public key; Zernio is optional)
import puppeteer from 'puppeteer-core';
import tls from 'node:tls';
import { readFileSync, existsSync } from 'node:fs';

const env = {};
for (const f of ['.env', '.env.local']) {
  try { for (const l of readFileSync(f, 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, '').trim(); } } catch { /* optional */ }
}
const SB = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
const MK = 'https://www.p31market.com';
const CL = 'https://www.thep31collective.org';
const CHROME = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => existsSync(p));

const results = []; // [section, check, ok|warn|fail, detail]
const add = (section, check, status, detail = '') => results.push([section, check, status, detail]);
const ms = (t) => `${Math.round(t)} ms`;

async function get(url, opts = {}) {
  const t = performance.now();
  const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000), ...opts });
  const body = opts.method === 'HEAD' ? '' : await r.text();
  return { r, body, time: performance.now() - t };
}

// ── 1. Domains, routing and headers ─────────────────────────
async function routing() {
  const S = 'Routing';
  const redirects = [
    ['http://p31market.com/', MK], ['https://p31market.com/', MK], ['http://www.p31market.com/', MK],
    ['https://thep31collective.org/', CL], ['http://www.thep31collective.org/', CL],
    [`${MK}/mentorship`, `${CL}/mentorship`], [`${MK}/portal`, `${CL}/portal`], [`${MK}/systems`, `${CL}/systems`],
    [`${MK}/academy/business`, `${CL}/academy/business`],
  ];
  for (const [from, to] of redirects) {
    let url = from; let hops = 0; let last;
    while (hops < 5) {
      last = await get(url, { method: 'HEAD' });
      const loc = last.r.headers.get('location');
      if (!(last.r.status >= 300 && last.r.status < 400) || !loc) break;
      url = new URL(loc, url).href; hops += 1;
    }
    const landed = url.replace(/\/$/, '');
    add(S, `${from} → ${to.replace('https://', '')}`, landed === to.replace(/\/$/, '') && last.r.status === 200 ? 'ok' : 'fail',
      `lands on ${landed} (${last.r.status}, ${hops} hop${hops === 1 ? '' : 's'})`);
  }

  // Each Collective page must get the Collective's own title (served by middleware.js).
  const pages = [
    [MK, '/', /Proverbs 31 Marketplace/], [MK, '/shop', /Shop/], [MK, '/directory', /Curators|Marketplace/], [MK, '/calendar', /Market|dates/i],
    [MK, '/about', /Story|About/i], [MK, '/services', /Services|Vendor Booths/], [MK, '/partner', /Partner/], [MK, '/login', /./],
    [CL, '/', /Collective/], [CL, '/mentorship', /Mentorship/], [CL, '/mentorship/business', /Business/], [CL, '/mentorship/faith', /Faith/],
    [CL, '/verify', /Verify/], [CL, '/portal', /Collective/], [CL, '/academy/business', /Collective/], [CL, '/studio', /Collective/],
  ];
  for (const [base, path, want] of pages) {
    const { r, body, time } = await get(base + path);
    const title = (body.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    const ok = r.status === 200 && want.test(title);
    add(S, `${base.replace('https://www.', '')}${path}`, !ok ? 'fail' : time > 1500 ? 'warn' : 'ok', `${r.status} · ${ms(time)} · “${title.slice(0, 70)}”`);
  }

  for (const [path, want] of [['/join', /Join P31 Collective/], ['/academy', /P31 Academy/], ['/systems', /P31 Systems/]]) {
    const { r, body } = await get(CL + path);
    const title = (body.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
    add('Routing', `thep31collective.org${path}`, r.status === 200 && want.test(title) ? 'ok' : 'warn',
      want.test(title) ? `${r.status} · “${title.slice(0, 60)}”` : 'not live yet (goes live with the next merge)');
  }

  for (const [base, files] of [[MK, ['/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/favicon.ico', '/og-image.jpg', '/sw.js']],
    [CL, ['/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/favicon.ico', '/c/og-image.jpg']]]) {
    for (const f of files) {
      const { r, body } = await get(base + f);
      let detail = `${r.status} ${r.headers.get('content-type') || ''}`;
      let ok = r.status === 200;
      if (f === '/sitemap.xml') { const n = (body.match(/<loc>/g) || []).length; detail += ` · ${n} URLs`; ok = ok && n > 0 && body.includes(base); }
      if (f === '/robots.txt') { ok = ok && /Sitemap:/i.test(body) && body.includes(base); }
      add('Files', `${base.replace('https://www.', '')}${f}`, ok ? 'ok' : 'fail', detail);
    }
  }

  const { r } = await get(MK + '/');
  const h = (k) => r.headers.get(k) || '';
  add('Headers', 'HTTPS everywhere (HSTS)', /max-age=\d{7,}/.test(h('strict-transport-security')) ? 'ok' : 'warn', h('strict-transport-security') || 'missing');
  add('Headers', 'Clickjacking / sniffing protection', h('x-frame-options') && h('x-content-type-options') ? 'ok' : 'warn', `${h('x-frame-options')} · ${h('x-content-type-options')}`);
  add('Headers', 'Camera & mic allowed (live classes)', /camera=\*/.test(h('permissions-policy')) ? 'ok' : 'fail', h('permissions-policy'));
}

// ── 2. Certificates ──────────────────────────────────────────
function certDays(host) {
  return new Promise((res) => {
    const s = tls.connect(443, host, { servername: host, timeout: 10000 }, () => {
      const c = s.getPeerCertificate(); s.end();
      res(Math.round((new Date(c.valid_to) - Date.now()) / 864e5));
    });
    s.on('error', () => res(null)); s.on('timeout', () => { s.destroy(); res(null); });
  });
}
async function certs() {
  for (const host of ['www.p31market.com', 'p31market.com', 'www.thep31collective.org', 'thep31collective.org']) {
    const d = await certDays(host);
    add('Security', `SSL certificate ${host}`, d == null ? 'fail' : d < 14 ? 'warn' : 'ok', d == null ? 'could not connect' : `valid for ${d} more days (auto-renews)`);
  }
}

// ── 3. Email & DNS ───────────────────────────────────────────
async function dns() {
  const q = async (name, type) => ((await (await fetch(`https://dns.google/resolve?name=${name}&type=${type}`)).json()).Answer || []).map((a) => a.data);
  for (const d of ['p31market.com', 'thep31collective.org']) {
    const mx = await q(d, 'MX'); const txt = await q(d, 'TXT'); const dmarc = await q(`_dmarc.${d}`, 'TXT'); const dkim = await q(`default._domainkey.${d}`, 'TXT');
    const spf = txt.filter((t) => t.includes('v=spf1'));
    add('Email', `${d} mail server`, mx.length ? 'ok' : 'fail', mx.join(', ') || 'no MX record');
    add('Email', `${d} SPF / DKIM / DMARC`, spf.length === 1 && dkim.length && dmarc.length ? 'ok' : 'fail',
      `SPF ${spf.length === 1 ? 'ok' : spf.length + ' records'} · DKIM ${dkim.length ? 'ok' : 'missing'} · DMARC ${dmarc.length ? dmarc[0].replace(/"/g, '') : 'missing'}`);
  }
}

// ── 4. Database: what a visitor can read ─────────────────────
async function database() {
  if (!SB || !KEY) return add('Database', 'Supabase', 'warn', 'no .env key, skipped');
  const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' };
  const t = performance.now();
  const ping = await fetch(`${SB}/rest/v1/academy_programs?select=id&limit=1`, { headers: H });
  add('Database', 'Supabase reachable', ping.ok ? 'ok' : 'fail', `${ping.status} · ${ms(performance.now() - t)}`);
  const PUBLIC = new Set(['academy_programs', 'market_events', 'curator_data', 'products', 'discount_codes']);
  const tables = [];
  for (const f of ['setup.sql', ...(await import('node:fs')).readdirSync('.').filter((x) => /^storefront_v\d+.*\.sql$|^[a-z_]+\.sql$/.test(x))]) {
    try { for (const m of readFileSync(f, 'utf8').matchAll(/create table (?:if not exists )?(?:public\.)?"?([a-z_0-9]+)/gi)) tables.push(m[1].toLowerCase()); } catch { /* skip */ }
  }
  const leaks = [];
  for (const tb of [...new Set(tables)]) {
    const r = await fetch(`${SB}/rest/v1/${tb}?select=*&limit=1`, { headers: H });
    const n = Number((r.headers.get('content-range') || '').split('/')[1] || 0);
    if (r.ok && n > 0 && !PUBLIC.has(tb)) leaks.push(`${tb} (${n})`);
  }
  add('Database', `Private tables hidden from visitors (${new Set(tables).size} checked)`, leaks.length ? 'fail' : 'ok', leaks.length ? `readable: ${leaks.join(', ')}` : 'only programs, markets, approved curators and their products are public');
  // Each migration's newest piece is present.
  const probes = [['v22 CRM', 'crm_contacts'], ['v23 live rooms', 'academy_session_joins'], ['v24 personal classroom', 'academy_student_files'],
    ['v27 Collective applications', 'collective_applications'], ['v28 error log', 'app_errors']];
  for (const [label, tb] of probes) {
    const r = await fetch(`${SB}/rest/v1/${tb}?select=*&limit=0`, { headers: H });
    add('Database', `${label} installed`, r.ok ? 'ok' : 'fail', r.ok ? 'present' : `${r.status} ${(await r.text()).slice(0, 80)}`);
  }
}

// ── 5. Edge functions: deployed, and refusing strangers ──────
async function functions() {
  if (!SB) return;
  const H = { apikey: KEY, 'Content-Type': 'application/json' };
  // Expected answer to an unsigned, signed-out, empty request. Anything 2xx would mean an open door; 404 = not deployed.
  const list = {
    'daily-room': [401], 'daily-webhook': [401, 503], 'dm-agent': [401], 'studio-zernio': [401], 'zoom-meetings': [401, 503], 'zoom-webhook': [400, 401, 503],
    'academy-checkout': [401], 'academy-billing': [401, 503], 'academy-webhook': [400, 401, 500, 503], 'ai-assist': [401], 'send-campaign': [401],
    'social-search': [401], 'systems-admin': [401], 'stripe-connect': [401, 500], 'stripe-account-status': [401, 500], 'stripe-webhook': [400, 500],
    'stripe-checkout': [400, 500], 'order-request': [400],
  };
  for (const [fn, want] of Object.entries(list)) {
    const r = await fetch(`${SB}/functions/v1/${fn}`, { method: 'POST', headers: H, body: '{}', signal: AbortSignal.timeout(20000) }).catch((e) => ({ status: 0, text: async () => e.message }));
    const text = (await r.text()).slice(0, 90).replace(/\s+/g, ' ');
    // Card payments are planned last, so their functions not being deployed yet is expected.
    const planned = /^stripe-/.test(fn);
    const status = r.status === 404 ? (planned ? 'warn' : 'fail') : want.includes(r.status) ? 'ok' : r.status >= 200 && r.status < 300 ? 'fail' : 'warn';
    add('Functions', fn, status, r.status === 404 ? `NOT DEPLOYED${planned ? ' (Stripe is planned last)' : ''}` : `${r.status} ${text}`);
  }
}

// ── 6. Outside services ──────────────────────────────────────
async function services() {
  const links = {
    'Calendly intro call': 'https://calendly.com/nebamentorship/neba-mentorship-intro-call',
    'Calendly private session': 'https://calendly.com/purposefullydriven7/privatementorship',
    'Calendly connect call': 'https://calendly.com/mjeffers031/connectcall',
    'Join form (Google, fallback)': 'https://docs.google.com/forms/d/e/1FAIpQLSfBZkXVjzeqjq_h5k0Np3ueFZbiYzp19ettlL5CF5uBHYjBTw/viewform',
    'Curator application form': 'https://forms.gle/vmkK7fhgwiYNYEa38',
    'Instagram profile': 'https://www.instagram.com/proverbs31market/',
  };
  for (const [name, url] of Object.entries(links)) {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) }).catch(() => ({ status: 0 }));
    add('Services', name, r.status === 200 ? 'ok' : r.status === 429 || r.status === 403 ? 'warn' : 'fail', `${r.status}`);
  }
  if (env.ZERNIO_API_KEY) {
    const r = await fetch('https://zernio.com/api/v1/accounts', { headers: { Authorization: `Bearer ${env.ZERNIO_API_KEY}` } });
    const { accounts = [] } = r.ok ? await r.json() : {};
    for (const a of accounts.filter((x) => ['instagram', 'facebook', 'googlebusiness'].includes(x.platform))) {
      const days = a.tokenExpiresAt ? Math.round((new Date(a.tokenExpiresAt) - Date.now()) / 864e5) : null;
      const bad = a.needsReconnection || a.isActive === false;
      add('Services', `Zernio · ${a.platform} @${a.username || a.displayName || ''}`, bad ? 'fail' : days != null && days < 14 ? 'warn' : 'ok',
        `${bad ? 'needs reconnecting' : 'connected'}${days != null ? ` · connection valid ${days} more days` : ''}`);
    }
  }
}

// ── 7. Real browser pass over the live public pages ──────────
async function browser() {
  if (!CHROME) return add('Browser', 'Chrome', 'warn', 'not found, skipped');
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
  const pages = [[MK, '/'], [MK, '/shop'], [MK, '/directory'], [MK, '/calendar'], [MK, '/about'], [MK, '/services'], [MK, '/partner'], [MK, '/login'],
    [CL, '/'], [CL, '/mentorship'], [CL, '/mentorship/business'], [CL, '/mentorship/faith'], [CL, '/verify'], [CL, '/portal']];
  for (const vp of [{ width: 1366, height: 860, label: 'desktop' }, { width: 390, height: 844, isMobile: true, hasTouch: true, label: 'phone' }]) {
    for (const [base, path] of pages) {
      // A fresh profile per page (first-visit numbers); retry once if Chrome isn't ready yet.
      const ctx = await b.createBrowserContext().catch(async () => { await new Promise((r) => setTimeout(r, 1500)); return b.createBrowserContext(); });
      const p = await ctx.newPage();
      const errs = []; const failed = [];
      p.on('pageerror', (e) => errs.push(e.message));
      p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
      p.on('response', (r) => { if (r.status() >= 400 && !/google|facebook|calendly|doubleclick|analytics/.test(r.url())) failed.push(`${r.status()} ${r.url().replace(base, '').slice(0, 60)}`); });
      await p.setViewport(vp);
      await p.evaluateOnNewDocument(() => { try { sessionStorage.setItem('p31_lead_popup_seen', '1'); } catch { /* ignore */ } });
      const t = performance.now();
      try {
        await p.goto(base + path, { waitUntil: 'load', timeout: 45000 });
        const loaded = performance.now() - t;
        const painted = await p.evaluate(() => new Promise((res) => {
          let v = 0;
          new PerformanceObserver((l) => { for (const e of l.getEntries()) v = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => res(Math.round(v)), 1200);
        }));
        const info = await p.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          brokenImgs: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith('data:')).map((i) => i.src.split('/').pop()).slice(0, 3),
          blank: document.body.innerText.trim().length < 40,
          crashed: /Something went wrong/.test(document.body.innerText),
          weight: Math.round(performance.getEntriesByType('resource').reduce((s, e) => s + (e.transferSize || 0), 0) / 1024),
        }));
        const problems = [
          info.crashed && 'error screen', info.blank && 'blank', info.overflow && 'sideways scroll', info.brokenImgs.length && `broken images: ${info.brokenImgs.join(', ')}`,
          errs.length && `errors: ${errs[0].slice(0, 80)}`, failed.length && `failed: ${failed.slice(0, 2).join('; ')}`,
        ].filter(Boolean);
        add(`Browser (${vp.label})`, `${base.replace('https://www.', '')}${path}`,
          problems.some((x) => /error screen|blank|errors:|broken|failed/.test(x)) ? 'fail' : problems.length || painted > 4000 || info.weight > 4000 ? 'warn' : 'ok',
          `${problems.join(' · ') || 'clean'} · content shown at ${ms(painted)} · ${info.weight} KB first visit`);
      } catch (e) {
        add(`Browser (${vp.label})`, `${base.replace('https://www.', '')}${path}`, 'fail', e.message.slice(0, 100));
      }
      await ctx.close();
    }
  }
  await b.close();
}

const started = Date.now();
await routing(); await certs(); await dns(); await database(); await functions(); await services(); await browser();
const icon = { ok: '✓', warn: '!', fail: '✗' };
let section = '';
for (const [s, check, st, detail] of results) {
  if (s !== section) { console.log(`\n── ${s}`); section = s; }
  console.log(`  ${icon[st]} ${check}${detail ? `  —  ${detail}` : ''}`);
}
const count = (st) => results.filter((r) => r[2] === st).length;
console.log(`\n${results.length} checks in ${Math.round((Date.now() - started) / 1000)}s: ${count('ok')} ok, ${count('warn')} to look at, ${count('fail')} failing`);
process.exit(count('fail') ? 1 : 0);
