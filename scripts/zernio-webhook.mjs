// One-time setup: points Zernio's inbox events for P31's Instagram and
// Facebook at the dm-agent function (Miss Ruth). Reads the Zernio key and the
// webhook secret from .env.local; prints the result, never the keys.
//   node scripts/zernio-webhook.mjs
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '').trim()]),
);
for (const k of ['ZERNIO_API_KEY', 'ZERNIO_WEBHOOK_SECRET']) {
  if (!env[k]) { console.error(`${k} is missing from .env.local`); process.exit(1); }
}

const res = await fetch('https://zernio.com/api/v1/webhooks/settings', {
  method: 'POST',
  headers: { Authorization: `Bearer ${env.ZERNIO_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Miss Ruth (dm-agent)',
    url: 'https://xsnhxjttdizljaawpumz.supabase.co/functions/v1/dm-agent',
    secret: env.ZERNIO_WEBHOOK_SECRET,
    events: ['message.received', 'message.sent'],
    // P31 Instagram (@proverbs31market) and Facebook page
    accountIds: ['6ac6716d90b16e751447d7fe', '6ac67950507b603704a87454'],
  }),
});
const body = await res.json();
console.log(res.ok ? `Webhook created: ${body.webhook?._id}` : `Failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
