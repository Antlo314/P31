// Supabase Edge Function: merch (p31market.com/merch, printed and shipped by Printful)
//   POST { action: 'status' }    is Printful connected? the store name; registers the shipping webhook once
//   POST { action: 'photos' }    makes the next missing product photos with Printful's mockup generator
//                                (a few per call; up to five per item and colour: model, lifestyle, flat),
//                                saves them in the public merch bucket and merch_mockups.gallery (v51)
//   POST { action: 'checkout', items: [{ item, color, size, quantity }] }
//                                a Stripe Checkout link on the Market account (address collected there);
//                                stripe-webhook places the paid order with Printful (_shared/merch-printful.ts)
//   POST ?printful=1             Printful's shipping updates (checked against Printful before use)
// Secrets: PRINTFUL_API_KEY, MARKET_STRIPE_SECRET_KEY (see _shared/stripe.ts)
// Deploy: supabase functions deploy merch --no-verify-jwt
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { stripeKey } from '../_shared/stripe.ts';
import { pf, printfulReady, printAreas, photoGroups, position, printfulEvent, MERCH_WEBHOOK_URL } from '../_shared/merch-printful.ts';

// The photo styles to ask Printful for, in order of preference (only those the product offers are used).
const STYLES: Record<string, string[]> = {
  apparel: ["Women's", 'Lifestyle', 'Flat', 'Folded', 'Front'],
  mug: ['Lifestyle', 'Front view', 'Handle on right', 'Handle on left', 'Front'],
  other: ['Lifestyle', 'Flat', 'Front', 'Product details'],
};
const MAX_PHOTOS = 5;
import { ITEMS, TYPES, SHIPPING, SITE, itemById, itemName, priceFor, printFile, variantFor } from '../_shared/merch-catalog.js';

const env = (k: string) => Deno.env.get(k) || '';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
// deno-lint-ignore no-explicit-any
type Any = any;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));

  // Printful's shipping updates.
  if (url.searchParams.get('printful') === '1') {
    try { return json(await printfulEvent(db, body)); } catch (e) { console.error('merch printful event', e); return json({ ok: false }, 500); }
  }

  try {
    if (body.action === 'status') {
      if (!printfulReady()) return json({ connected: false, reason: 'PRINTFUL_API_KEY is not set' });
      // The store's name needs the stores_list scope; a token without it still proves itself on orders.
      let store: Any = null;
      try { store = await pf('/store'); } catch { await pf('/orders?limit=1'); }
      // Shipping updates: register this function with Printful once.
      let webhook = 'already set';
      try {
        const current = await pf('/webhooks');
        if (current?.url !== MERCH_WEBHOOK_URL()) {
          await pf('/webhooks', { method: 'POST', body: JSON.stringify({ url: MERCH_WEBHOOK_URL(), types: ['package_shipped', 'order_failed', 'order_canceled', 'order_put_hold'] }) });
          webhook = 'registered now';
        }
      } catch (e) { webhook = `not set: ${(e as Error).message}`; }
      const { count: photos } = await db.from('merch_mockups').select('item', { count: 'exact', head: true });
      const wanted = ITEMS.reduce((n: number, i: Any) => n + i.colors.length, 0);
      return json({ connected: true, store: store?.name || null, store_id: store?.id || null, webhook, photos: photos || 0, photos_wanted: wanted, stripe: !!stripeKey('market') });
    }

    if (body.action === 'photos') {
      if (!printfulReady()) return json({ error: 'Printful is not connected yet.' }, 503);
      const { data: have } = await db.from('merch_mockups').select('item, color');
      const done = new Set((have || []).map((r: Any) => `${r.item}|${r.color}`));
      const todo = ITEMS.flatMap((i: Any) => i.colors.map((c: string) => ({ i, c }))).filter(({ i, c }: Any) => !done.has(`${i.id}|${c}`));
      const batch = todo.slice(0, Math.min(Number(body.limit) || 2, 4));
      const made: string[] = []; const failed: Record<string, string> = {};
      for (const { i, c } of batch) {
        try {
          const t = TYPES[i.type as keyof typeof TYPES];
          const f = printFile(i, c)!;
          const areas = await printAreas(t.printful);
          const area = areas[t.placement];
          const variant = variantFor(i, c, t.sizes[Math.min(1, t.sizes.length - 1)])!;
          const file: Any = { placement: t.placement, image_url: f.url };
          if (area) file.position = position(i.type, area, f);
          const offered = await photoGroups(t.printful);
          const wanted = STYLES[['tee', 'crew', 'hoodie'].includes(i.type) ? 'apparel' : i.type === 'mug' ? 'mug' : 'other'];
          const groups = wanted.filter((g) => offered.includes(g)).slice(0, 3);
          const task = await pf(`/mockup-generator/create-task/${t.printful}`, { method: 'POST', body: JSON.stringify({ variant_ids: [variant], format: 'jpg', files: [file], ...(groups.length ? { option_groups: groups } : {}) }) });
          let result: Any = null;
          for (let n = 0; n < 20 && !result; n++) {
            await wait(2500);
            const r = await pf(`/mockup-generator/task?task_key=${encodeURIComponent(task.task_key)}`);
            if (r.status === 'completed') result = r;
            else if (r.status === 'failed') throw new Error(r.error || 'mockup failed');
          }
          if (!result) throw new Error('Printful took too long; it will be tried again.');
          // Every photo Printful made (main shots and extras), model and lifestyle shots first.
          const shots: { url: string; group: string }[] = [];
          for (const m of result.mockups || []) {
            shots.push({ url: m.mockup_url, group: m.option_group || '' });
            for (const x of m.extra || []) shots.push({ url: x.url, group: x.option_group || '' });
          }
          const rank = (g: string) => (/women/i.test(g) ? 0 : /lifestyle/i.test(g) ? 1 : 2);
          const unique = [...new Map(shots.filter((x) => x.url).map((x) => [x.url, x])).values()].sort((a, b) => rank(a.group) - rank(b.group)).slice(0, MAX_PHOTOS);
          if (!unique.length) throw new Error('Printful returned no photos.');
          const gallery: string[] = [];
          const base = `mockups/${i.id}-${c.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
          for (const [n, shot] of unique.entries()) {
            const bytes = new Uint8Array(await (await fetch(shot.url)).arrayBuffer());
            const path = `${base}-${n + 1}.jpg`;
            const up = await db.storage.from('merch').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
            if (up.error) throw new Error(up.error.message);
            gallery.push(db.storage.from('merch').getPublicUrl(path).data.publicUrl);
          }
          await db.from('merch_mockups').upsert({ item: i.id, color: c, url: gallery[0], gallery, updated_at: new Date().toISOString() });
          made.push(`${i.id} ${c}`);
        } catch (e) { failed[`${i.id} ${c}`] = (e as Error).message; }
      }
      return json({ made, failed, remaining: todo.length - made.length });
    }

    // The success page asks whether the payment really cleared (only the state, nothing personal).
    if (body.action === 'order') {
      const ref = String(body.ref || '').toUpperCase();
      if (!/^M[0-9A-F]{7}$/.test(ref)) return json({ error: 'Unknown order.' }, 404);
      const { data: order } = await db.from('merch_orders').select('status, stripe_session_id').eq('ref', ref).maybeSingle();
      if (!order) return json({ error: 'Unknown order.' }, 404);
      let status = order.status;
      // The Stripe webhook may still be on its way: ask Stripe directly.
      if (status === 'checkout' && order.stripe_session_id && stripeKey('market')) {
        try {
          const session = await new Stripe(stripeKey('market')).checkout.sessions.retrieve(order.stripe_session_id);
          if (session.payment_status === 'paid') status = 'paid';
          else if (session.status === 'expired') status = 'expired';
        } catch (e) { console.error('merch order lookup', e); }
      }
      // Every later state (paid, sent, in production, shipped, or a Printful problem the team fixes) means the card was charged.
      return json({ status, paid: !['checkout', 'expired'].includes(status) });
    }

    if (body.action === 'checkout') {
      const key = stripeKey('market');
      if (!key) return json({ error: 'Merch checkout opens soon. Please check back shortly.' }, 503);
      const lines = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
      if (!lines.length) return json({ error: 'Your bag is empty.' }, 400);
      const items: Any[] = [];
      for (const l of lines) {
        const item = itemById(String(l.item || ''));
        const quantity = Math.max(1, Math.min(20, Math.floor(Number(l.quantity) || 1)));
        if (!item || !variantFor(item, String(l.color), String(l.size))) return json({ error: 'One item in your bag is no longer available. Please remove it and try again.' }, 400);
        items.push({ item: item.id, name: itemName(item), color: String(l.color), size: String(l.size), quantity, price_cents: priceFor(item, String(l.size)) });
      }
      const subtotal = items.reduce((s, l) => s + l.price_cents * l.quantity, 0);
      const shipping = subtotal >= SHIPPING.freeOverCents ? 0 : SHIPPING.cents;
      const { data: order, error } = await db.from('merch_orders').insert({ items, subtotal_cents: subtotal, shipping_cents: shipping, total_cents: subtotal + shipping }).select('id, ref').single();
      if (error) throw new Error(error.message);
      const { data: photos } = await db.from('merch_mockups').select('item, color, url');
      const photo = (l: Any) => (photos || []).find((p: Any) => p.item === l.item && p.color === l.color)?.url;
      const stripe = new Stripe(key);
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: items.map((l) => ({
          quantity: l.quantity,
          price_data: { currency: 'usd', unit_amount: l.price_cents, product_data: { name: l.name, description: [l.color, l.size !== 'One size' ? l.size : null].filter(Boolean).join(' · '), ...(photo(l) ? { images: [photo(l)] } : {}) } },
        })),
        shipping_address_collection: { allowed_countries: ['US'] },
        shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', display_name: shipping ? 'Standard shipping' : 'Free shipping', fixed_amount: { amount: shipping, currency: 'usd' }, delivery_estimate: { minimum: { unit: 'business_day', value: 5 }, maximum: { unit: 'business_day', value: 12 } } } }],
        phone_number_collection: { enabled: true },
        metadata: { kind: 'merch', order_id: order.id, ref: order.ref },
        payment_intent_data: { metadata: { kind: 'merch', order_id: order.id, ref: order.ref }, statement_descriptor_suffix: 'P31 MERCH' },
        success_url: `${SITE}/merch?order=${order.ref}&status=success`,
        cancel_url: `${SITE}/merch?order=${order.ref}&status=cancelled`,
      });
      await db.from('merch_orders').update({ stripe_session_id: session.id }).eq('id', order.id);
      return json({ url: session.url, ref: order.ref });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error('merch', body?.action, e);
    return json({ error: (e as Error).message }, 500);
  }
});
