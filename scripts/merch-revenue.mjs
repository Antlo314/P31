// The merch revenue sheet: what each P31 merch product brings in after Printful and Stripe.
// Printful's own prices come live from the merch function (action costs, read only), so the sheet
// matches what Printful charges today. Writes docs/guide/P31-Merch-Revenue.html and prints it to
// docs/P31-Merch-Revenue.pdf.
//   node scripts/merch-revenue.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ITEMS, TYPES, SHIPPING, itemName, priceFor } from '../supabase/functions/_shared/merch-catalog.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FN = 'https://xsnhxjttdizljaawpumz.supabase.co/functions/v1/merch';
// --costs file.json reads a saved answer instead (for checking the layout).
const saved = process.argv.indexOf('--costs');
const res = saved > 0 ? null : await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'costs' }) });
const live = saved > 0 ? JSON.parse(readFileSync(process.argv[saved + 1], 'utf8')) : await res.json();
if (!live.types) { console.error('Printful costs are not available:', live.error || res?.status); process.exit(1); }

// Stripe's standard US card price; Klarna and Afterpay cost more per sale.
const STRIPE = { pct: 0.029, fixed: 30 };
const fee = (cents) => Math.round(cents * STRIPE.pct + STRIPE.fixed);
const $ = (c) => (c == null ? '–' : `${c < 0 ? '−' : ''}$${(Math.abs(c) / 100).toFixed(2)}`);
const pct = (n) => `${Math.round(n * 100)}%`;

/** Printful's cost for an item in one size: the dearest of its colours, so the sheet never overstates profit. */
const costFor = (item, size) => {
  const per = live.types[item.type]?.costs || {};
  const all = item.colors.map((c) => per[c]?.[size]).filter((x) => typeof x === 'number');
  return all.length ? { hi: Math.max(...all), lo: Math.min(...all) } : null;
};
const baseSize = (t) => (t.sizes.includes('M') ? 'M' : t.sizes[0]);

// By product type: base size, and the bigger sizes that cost more.
const typeRows = Object.entries(TYPES).map(([key, t]) => {
  const sample = ITEMS.find((i) => i.type === key);
  const sizes = t.sizes.includes('M') ? ['M', '2XL', '3XL'].filter((s) => t.sizes.includes(s)) : t.sizes;
  return sizes.map((size) => {
    const price = priceFor(sample, size);
    const c = costFor(sample, size);
    const profit = c ? price - c.hi - fee(price) : null;
    return { type: t.name, size: t.sizes.length > 1 ? (size === 'M' ? 'S to XL' : size) : '', price, cost: c, fee: fee(price), profit, margin: profit != null ? profit / price : null };
  });
}).flat();

const itemRows = ITEMS.map((item) => {
  const t = TYPES[item.type];
  const size = baseSize(t);
  const price = priceFor(item, size);
  const c = costFor(item, size);
  const profit = c ? price - c.hi - fee(price) : null;
  return { name: itemName(item), colors: item.colors.length, price, cost: c, fee: fee(price), profit, margin: profit != null ? profit / price : null };
});

// One-piece orders: what she pays, shipping we charge against Printful's shipping, and what is left.
const orderRows = Object.entries(TYPES).map(([key, t]) => {
  const sample = ITEMS.find((i) => i.type === key);
  const price = priceFor(sample, baseSize(t));
  const c = costFor(sample, baseSize(t));
  const shipIn = price >= SHIPPING.freeOverCents ? 0 : SHIPPING.cents;
  const shipOut = live.types[key]?.shipping_cents;
  const paid = price + shipIn;
  const left = c && shipOut != null ? paid - c.hi - shipOut - fee(paid) : null;
  return { name: t.name, price, shipIn, paid, cost: c?.hi ?? null, shipOut, fee: fee(paid), left };
});

const avg = (rows) => { const r = rows.filter((x) => x.margin != null); return r.length ? r.reduce((s, x) => s + x.margin, 0) / r.length : 0; };
const costCell = (c) => (!c ? '–' : c.lo === c.hi ? $(c.hi) : `${$(c.lo)}–${$(c.hi)}`);
const checked = new Date(live.checked_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const src = readFileSync(join(ROOT, 'docs/guide/P31-Coaching-Signup.html'), 'utf8');
const head = src.slice(0, src.indexOf('</style>')).replace(/<title>[^<]*<\/title>/, '<title>P31 merch revenue</title>');
const html = `${head}
  .top { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: end; background: radial-gradient(70% 90% at 100% 0%, rgba(155, 113, 178, 0.4), transparent 70%), var(--plum-3); color: #fff; border-radius: 18px; padding: 18px 24px; margin-bottom: 12px; }
  .top h1 { color: #fff; font-size: 22pt; margin: 2px 0 4px; } .top h1 em { color: var(--gold-2); }
  .top p { margin: 0; color: rgba(255,255,255,0.86); } .top .eyebrow { color: var(--gold-2); margin: 0; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 0 12px; }
  .kpi { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; } .kpi b { display: block; font-family: 'Noto Serif', serif; font-weight: 400; font-size: 18pt; color: var(--plum); }
  .kpi span { font-size: 8.4pt; color: var(--dim); }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td.good { color: var(--green); font-weight: 800; } td.bad { color: #9a2f2f; font-weight: 800; }
  table { font-size: 8.4pt; } td { padding: 4px 7px; }
  .page { break-before: page; }
</style>
</head>
<body>
<div class="top">
  <div>
    <p class="eyebrow">p31market.com/merch · Printed and shipped by Printful</p>
    <h1>What each piece <em>brings in</em></h1>
    <p>Our price, Printful's charge to us, Stripe's fee, and what P31 keeps. Printful prices checked ${checked}.</p>
  </div>
</div>

<div class="kpis">
  <div class="kpi"><b>${pct(avg(itemRows))}</b><span>average kept per piece, after Printful and Stripe</span></div>
  <div class="kpi"><b>${$(Math.min(...itemRows.filter((r) => r.profit != null).map((r) => r.profit)))}–${$(Math.max(...itemRows.filter((r) => r.profit != null).map((r) => r.profit)))}</b><span>kept per piece, smallest to largest</span></div>
  <div class="kpi"><b>${ITEMS.length}</b><span>products in ${Object.keys(TYPES).length} types, ${ITEMS.reduce((n, i) => n + i.colors.length, 0)} colour options</span></div>
</div>

<h2>By product type</h2>
<table>
  <tr><th>Product</th><th>Size</th><th class="num">Our price</th><th class="num">Printful charges us</th><th class="num">Stripe fee</th><th class="num">P31 keeps</th><th class="num">Margin</th></tr>
  ${typeRows.map((r) => `<tr><td>${r.type}</td><td>${r.size}</td><td class="num">${$(r.price)}</td><td class="num">${costCell(r.cost)}</td><td class="num">${$(r.fee)}</td><td class="num ${r.profit > 0 ? 'good' : 'bad'}">${$(r.profit)}</td><td class="num">${r.margin != null ? pct(r.margin) : '–'}</td></tr>`).join('\n  ')}
</table>

<h2>A one-piece order, with shipping</h2>
<table>
  <tr><th>Product</th><th class="num">Price</th><th class="num">Shipping she pays</th><th class="num">She pays</th><th class="num">Printful item</th><th class="num">Printful shipping</th><th class="num">Stripe fee</th><th class="num">P31 keeps</th></tr>
  ${orderRows.map((r) => `<tr><td>${r.name}</td><td class="num">${$(r.price)}</td><td class="num">${r.shipIn ? $(r.shipIn) : 'Free'}</td><td class="num">${$(r.paid)}</td><td class="num">${$(r.cost)}</td><td class="num">${$(r.shipOut)}</td><td class="num">${$(r.fee)}</td><td class="num ${r.left > 0 ? 'good' : 'bad'}">${$(r.left)}</td></tr>`).join('\n  ')}
</table>
<div class="note">
  <p><strong>How to read this</strong></p>
  <ul>
    <li><b>Printful charges us</b> is Printful's price for the blank item with our print, before shipping. Where colours cost different amounts, the sheet uses the dearest one, so real profit is the same or a little higher.</li>
    <li><b>Stripe fee</b> is the standard card rate, 2.9% + 30¢ per payment. Klarna and Afterpay cost more (about 6% + 30¢), and one payment covers the whole bag, so a bag of several pieces pays the 30¢ once.</li>
    <li><b>Shipping:</b> shoppers pay ${$(SHIPPING.cents)} per order, free over ${$(SHIPPING.freeOverCents)}. Printful's shipping above is its standard rate for one piece to Georgia; extra pieces in the same box add only a little.</li>
    <li><b>Not included:</b> sales tax (Printful may add it in some states unless a resale certificate is on file with them) and any returns or reprints.</li>
  </ul>
</div>

<section class="page">
<h2 style="margin-top:0">Every product</h2>
<table>
  <tr><th>Product</th><th class="num">Colours</th><th class="num">Price</th><th class="num">Printful</th><th class="num">Stripe</th><th class="num">P31 keeps</th><th class="num">Margin</th></tr>
  ${itemRows.map((r) => `<tr><td>${r.name}</td><td class="num">${r.colors}</td><td class="num">${$(r.price)}</td><td class="num">${costCell(r.cost)}</td><td class="num">${$(r.fee)}</td><td class="num ${r.profit > 0 ? 'good' : 'bad'}">${$(r.profit)}</td><td class="num">${r.margin != null ? pct(r.margin) : '–'}</td></tr>`).join('\n  ')}
</table>
<p class="small muted">Apparel is shown in sizes S to XL; 2XL and 3XL cost more and are priced higher (see the first table). Mugs are shown at 11 oz.</p>
</section>
</body>
</html>
`;
writeFileSync(join(ROOT, 'docs/guide/P31-Merch-Revenue.html'), html);
execFileSync(process.execPath, [join(ROOT, 'scripts/print-guide.mjs'), 'docs/guide/P31-Merch-Revenue.html', 'docs/P31-Merch-Revenue.pdf', 'P31 merch revenue'], { stdio: 'inherit', cwd: ROOT });
