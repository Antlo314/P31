// Supabase Edge Function: google-place
// A shop's Google Business listing on its P31 storefront (v53): star rating, review count, up to five recent
// Google reviews, opening hours, address and the links to see or write a review. Data comes from the
// Google Places API (New) and is refreshed every few days (app_settings 'addons'.google_refresh_days).
//   { action: 'connect', input }  a signed-in vendor: her Google Maps link (or "business name, city");
//                                  finds the listing and saves it on her shop
//   { action: 'disconnect' }       a signed-in vendor: removes it
//   { action: 'refresh' }          the scheduler (daily): updates shops whose copy is older than the refresh days
// Google's terms: reviews are shown as Google sends them, with "Reviews from Google" and the author names.
// Secrets: GOOGLE_MAPS_API_KEY (Google Cloud project with "Places API (New)" switched on and billing set up)
// Deploy: supabase functions deploy google-place --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (k: string) => Deno.env.get(k) || '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const API = 'https://places.googleapis.com/v1';
const DETAILS = 'id,displayName,formattedAddress,rating,userRatingCount,reviews,regularOpeningHours,googleMapsUri,websiteUri,nationalPhoneNumber,businessStatus';

async function places(path: string, init: RequestInit & { fields: string }) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'X-Goog-Api-Key': env('GOOGLE_MAPS_API_KEY'), 'X-Goog-FieldMask': init.fields, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google ${res.status}: ${body?.error?.message || res.statusText}`);
  return body;
}

/** Short links (maps.app.goo.gl, g.page) lead to the full Maps address; follow them by hand. */
async function expand(url: string) {
  let u = url;
  for (let i = 0; i < 5; i++) {
    if (!/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl|g\.page|g\.co)\//i.test(u)) break;
    const res = await fetch(u, { redirect: 'manual' });
    const next = res.headers.get('location');
    await res.body?.cancel();
    if (!next) break;
    u = new URL(next, u).toString();
  }
  return u;
}

/** Turn what the vendor pasted into a place id: a direct id, or a text search near the map pin. */
async function findPlace(input: string) {
  const text = input.trim();
  let query = text;
  let near: { latitude: number; longitude: number } | null = null;
  if (/^https?:\/\//i.test(text)) {
    const url = await expand(text);
    const u = new URL(url);
    const direct = u.searchParams.get('query_place_id') || u.searchParams.get('place_id') || (u.searchParams.get('q') || '').replace(/^place_id:/, '');
    if (/^ChI[A-Za-z0-9_-]{10,}$/.test(direct)) return direct;
    const name = decodeURIComponent((url.match(/\/place\/([^/@?]+)/) || [])[1] || '').replace(/\+/g, ' ');
    const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (at) near = { latitude: Number(at[1]), longitude: Number(at[2]) };
    query = name || u.searchParams.get('q') || u.searchParams.get('query') || '';
    if (!query) throw new Error('That link does not name a business. Open your business on Google Maps, tap Share, and paste that link.');
  }
  const body: Row = { textQuery: query, pageSize: 1 };
  if (near) body.locationBias = { circle: { center: near, radius: 800 } };
  const found = await places('/places:searchText', { method: 'POST', body: JSON.stringify(body), fields: 'places.id' });
  const id = found?.places?.[0]?.id;
  if (!id) throw new Error('We could not find that business on Google. Try your Google Maps share link, or your business name and city.');
  return id as string;
}

/** What the storefront shows, in the shape it reads. */
async function details(id: string) {
  const p = await places(`/places/${encodeURIComponent(id)}`, { method: 'GET', fields: DETAILS });
  return {
    id: p.id,
    name: p.displayName?.text || '',
    address: p.formattedAddress || '',
    rating: p.rating ?? null,
    count: p.userRatingCount ?? 0,
    maps_url: p.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${p.id}`,
    review_url: `https://search.google.com/local/writereview?placeid=${p.id}`,
    website: p.websiteUri || null,
    phone: p.nationalPhoneNumber || null,
    open_now: p.regularOpeningHours?.openNow ?? null,
    hours: p.regularOpeningHours?.weekdayDescriptions || [],
    status: p.businessStatus || null,
    reviews: (p.reviews || []).slice(0, 5).map((r: Row) => ({
      author: r.authorAttribution?.displayName || 'Google user',
      author_url: r.authorAttribution?.uri || null,
      photo: r.authorAttribution?.photoUri || null,
      rating: r.rating ?? null,
      when: r.relativePublishTimeDescription || '',
      text: r.text?.text || r.originalText?.text || '',
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  let b: Row = {};
  try { b = await req.json(); } catch { /* empty body */ }
  if (!env('GOOGLE_MAPS_API_KEY')) return json({ error: 'Google reviews switch on soon. Your link will be ready to add then.', waiting: 'GOOGLE_MAPS_API_KEY' }, 503);

  try {
    if (b.action === 'refresh') {
      const { data: row } = await db.from('app_settings').select('value').eq('key', 'addons').maybeSingle();
      const days = Math.max(1, Number(row?.value?.google_refresh_days) || 3);
      const before = new Date(Date.now() - days * 864e5 + 3600e3).toISOString();
      const { data: shops } = await db.from('curator_data').select('id, google_place_id').not('google_place_id', 'is', null)
        .or(`google_synced_at.is.null,google_synced_at.lt.${before}`).limit(60);
      let updated = 0; const failed: string[] = [];
      for (const s of shops || []) {
        try {
          await db.from('curator_data').update({ google_place: await details(s.google_place_id), google_synced_at: new Date().toISOString() }).eq('id', s.id);
          updated++;
        } catch (e) { failed.push(`${s.id}: ${(e as Error).message}`); }
      }
      return json({ updated, failed });
    }

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: who } = await db.auth.getUser(token);
    const user = who?.user;
    if (!user) return json({ error: 'Please sign in to your curator studio first.' }, 401);
    const { data: shop } = await db.from('curator_data').select('id').eq('id', user.id).maybeSingle();
    if (!shop) return json({ error: 'This account does not have a storefront yet.' }, 404);

    if (b.action === 'disconnect') {
      await db.from('curator_data').update({ google_maps_url: null, google_place_id: null, google_place: null, google_synced_at: null }).eq('id', shop.id);
      return json({ ok: true });
    }
    if (b.action === 'connect') {
      const input = String(b.input || '').slice(0, 1000);
      if (input.trim().length < 3) return json({ error: 'Paste your Google Maps link, or type your business name and city.' }, 400);
      const id = await findPlace(input);
      const place = await details(id);
      await db.from('curator_data').update({
        google_maps_url: /^https?:\/\//i.test(input.trim()) ? input.trim() : place.maps_url,
        google_place_id: id, google_place: place, google_synced_at: new Date().toISOString(),
      }).eq('id', shop.id);
      return json({ place });
    }
    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error('google-place', b?.action, e);
    return json({ error: (e as Error).message }, 400);
  }
});
