// Supabase Edge Function: social-search
// Growth Search + comment listening for Systems, powered by Apify actors.
// The Apify token stays here on the server; only Systems operators can call it.
//
// Setup:
//   supabase secrets set APIFY_TOKEN=apify_api_...
//   supabase functions deploy social-search
//
// Actions (POST JSON):
//   { action: 'status' }                         → { apify: boolean }
//   { action: 'search', source, query, limit? }  → { results: Prospect[] }
//   { action: 'comments', platform, url, limit? }→ { comments: Comment[] }
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Prospect = {
  platform: string;
  kind: 'group' | 'person' | 'page' | 'hashtag';
  name: string;
  url: string;
  audience_size: number | null;
  description: string | null;
  raw?: unknown;
};

// Google-backed sources: one query string, scoped to a site.
const GOOGLE_SOURCES: Record<string, { site: string; platform: string; kind: Prospect['kind'] }> = {
  facebook_groups: { site: 'facebook.com/groups', platform: 'facebook', kind: 'group' },
  meetup_groups: { site: 'meetup.com', platform: 'meetup', kind: 'group' },
  linkedin_groups: { site: 'linkedin.com/groups', platform: 'linkedin', kind: 'group' },
  eventbrite: { site: 'eventbrite.com/e', platform: 'eventbrite', kind: 'page' },
  web: { site: '', platform: 'web', kind: 'page' },
};

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

async function runActor(actor: string, input: unknown, token: string) {
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=120&clean=true`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify ${actor} failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return (await res.json()) as Record<string, unknown>[];
}

async function search(source: string, query: string, limit: number, token: string): Promise<Prospect[]> {
  const g = GOOGLE_SOURCES[source];
  if (g) {
    const q = g.site ? `site:${g.site} ${query}` : query;
    const pages = Math.max(1, Math.min(3, Math.ceil(limit / 10)));
    const items = await runActor('apify~google-search-scraper', {
      queries: q, maxPagesPerQuery: pages, countryCode: 'us', languageCode: 'en',
    }, token);
    return items.flatMap((page) => ((page.organicResults as Record<string, unknown>[]) || []))
      .map((r) => ({
        platform: g.platform,
        kind: g.kind,
        name: String(r.title || r.url || '').replace(/\s*[|·-]\s*Facebook$/i, ''),
        url: String(r.url || ''),
        audience_size: null,
        description: (r.description as string) || null,
      }))
      .filter((p) => p.url);
  }

  if (source === 'instagram_people') {
    const items = await runActor('apify~instagram-search-scraper', {
      search: query, searchType: 'user', searchLimit: Math.min(limit, 50),
    }, token);
    return items.map((u) => ({
      platform: 'instagram',
      kind: 'person' as const,
      name: String(u.fullName || u.username || ''),
      url: String(u.url || (u.username ? `https://www.instagram.com/${u.username}/` : '')),
      audience_size: num(u.followersCount),
      description: (u.biography as string) || null,
    })).filter((p) => p.url);
  }

  if (source === 'instagram_hashtag') {
    const tag = query.replace(/^#/, '').replace(/\s+/g, '');
    const items = await runActor('apify~instagram-hashtag-scraper', {
      hashtags: [tag], resultsType: 'posts', resultsLimit: Math.min(limit * 2, 100),
    }, token);
    // People actively posting on the hashtag, one row each.
    const seen = new Map<string, Prospect>();
    for (const p of items) {
      const user = p.ownerUsername as string;
      if (!user || seen.has(user)) continue;
      seen.set(user, {
        platform: 'instagram',
        kind: 'person',
        name: String(p.ownerFullName || user),
        url: `https://www.instagram.com/${user}/`,
        audience_size: null,
        description: ((p.caption as string) || '').slice(0, 280) || null,
      });
    }
    return [...seen.values()].slice(0, limit);
  }

  if (source === 'tiktok_creators') {
    const items = await runActor('clockworks~tiktok-scraper', {
      searchQueries: [query], searchSection: '/user', maxProfilesPerQuery: Math.min(limit, 50), resultsPerPage: 1,
    }, token);
    const seen = new Map<string, Prospect>();
    for (const v of items) {
      const a = (v.authorMeta || v) as Record<string, unknown>;
      const handle = (a.name || a.uniqueId) as string;
      if (!handle || seen.has(handle)) continue;
      seen.set(handle, {
        platform: 'tiktok',
        kind: 'person',
        name: String(a.nickName || handle),
        url: String(a.profileUrl || `https://www.tiktok.com/@${handle}`),
        audience_size: num(a.fans),
        description: (a.signature as string) || null,
      });
    }
    return [...seen.values()].slice(0, limit);
  }

  throw new Error(`Unknown source: ${source}`);
}

async function comments(platform: string, url: string, limit: number, token: string) {
  if (platform === 'instagram') {
    const items = await runActor('apify~instagram-comment-scraper', {
      directUrls: [url], resultsLimit: limit,
    }, token);
    return items.map((c) => ({
      author: c.ownerUsername || '',
      author_url: c.ownerUsername ? `https://www.instagram.com/${c.ownerUsername}/` : null,
      text: c.text || '',
      at: c.timestamp || null,
      likes: num(c.likesCount),
    }));
  }
  if (platform === 'facebook') {
    const items = await runActor('apify~facebook-comments-scraper', {
      startUrls: [{ url }], resultsLimit: limit, viewOption: 'RECENT_ACTIVITY',
    }, token);
    return items.map((c) => ({
      author: c.profileName || '',
      author_url: c.profileUrl || null,
      text: c.text || '',
      at: c.date || null,
      likes: num(c.likesCount),
    }));
  }
  throw new Error(`Comments aren't supported for ${platform} yet.`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: userData } = await admin.auth.getUser(token);
    const caller = userData?.user;
    if (!caller) return json({ error: 'Sign in to Systems first.' }, 401);

    const { data: op } = await admin
      .from('system_operators').select('user_id').eq('user_id', caller.id).maybeSingle();
    if (!op) return json({ error: 'Systems access required.' }, 403);

    const apifyToken = Deno.env.get('APIFY_TOKEN');
    const body = await req.json();

    if (body.action === 'status') return json({ apify: !!apifyToken });
    if (!apifyToken) return json({ error: 'Apify isn’t connected yet. Add the APIFY_TOKEN secret.' });

    const limit = Math.max(5, Math.min(Number(body.limit) || 25, 100));

    if (body.action === 'search') {
      const query = String(body.query || '').trim();
      if (!query) return json({ error: 'Type something to search for.' });
      const results = await search(String(body.source), query, limit, apifyToken);
      await admin.from('social_searches').insert({
        created_by: caller.id, source: body.source, query, result_count: results.length,
      });
      return json({ results });
    }

    if (body.action === 'comments') {
      const url = String(body.url || '').trim();
      if (!/^https:\/\//.test(url)) return json({ error: 'Paste the full link to the post.' });
      return json({ comments: await comments(String(body.platform), url, limit, apifyToken) });
    }

    return json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('social-search error:', err);
    return json({ error: (err as Error).message || 'Search failed.' });
  }
});
