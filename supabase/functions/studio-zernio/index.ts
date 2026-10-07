// Supabase Edge Function: studio-zernio
// The Content Studio's window into P31's social accounts. The Zernio key never
// leaves the server: Studio members (3 seats) and P31 admins call this with
// their Supabase session and a whitelisted `action`.
//   supabase secrets set ZERNIO_API_KEY=sk_...   (already set for dm-agent)
//   supabase functions deploy studio-zernio
// Body: { action, ...params }
//   overview                      accounts, 30-day insights, follower trend, best times
//   posts                         scheduled + recently published posts
//   presign  {filename, contentType, size}
//   create   {platforms, content, igContent?, fbContent?, media[], scheduledFor, timezone}
//   update   {postId, content?, scheduledFor?, timezone?}
//   remove   {postId}
//   inbox                         recent DM conversations (read-only)
//   thread   {conversationId, accountId}
//   comments                      posts with comments
//   postComments {postId, accountId}
import { createClient } from 'npm:@supabase/supabase-js@2';

const ZERNIO = 'https://zernio.com/api/v1';
const PLATFORMS = ['instagram', 'facebook'];
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const env = (k: string) => Deno.env.get(k) || '';

class UserError extends Error {}

async function zernio(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ZERNIO}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env('ZERNIO_API_KEY')}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 200) }; }
  if (!res.ok) {
    console.error(`Zernio ${res.status} ${path}: ${text.slice(0, 300)}`);
    throw new UserError(body?.error || `Zernio couldn't complete that (${res.status}).`);
  }
  return body;
}
const quiet = (p: Promise<any>) => p.catch((e) => ({ error: (e as Error).message }));

const day = (d: Date) => d.toISOString().slice(0, 10);

// Only P31's own Instagram and Facebook accounts, looked up server-side.
async function ourAccounts() {
  const { accounts = [] } = await zernio('/accounts');
  return accounts
    .filter((a: any) => PLATFORMS.includes(a.platform))
    .map((a: any) => ({
      id: a._id, platform: a.platform, username: a.username, displayName: a.displayName,
      picture: a.profilePicture, followers: a.followersCount ?? null, active: !!a.isActive && a.enabled !== false,
      status: a.platformStatus, needsReconnection: !!a.needsReconnection, tokenExpiresAt: a.tokenExpiresAt || null,
      profileUrl: a.profileUrl || null,
    }));
}

const slimPost = (p: any) => ({
  id: p._id || p.id, title: p.title || '', content: p.content || '', status: p.status,
  scheduledFor: p.scheduledFor || null, publishedAt: p.publishedAt || null, timezone: p.timezone || null,
  media: (p.mediaItems || []).map((m: any) => ({ type: m.type, url: m.url, thumbnail: m.thumbnail || m.instagramThumbnail || null })),
  platforms: (p.platforms || []).map((x: any) => ({
    platform: x.platform, accountId: x.accountId?._id || x.accountId, status: x.status,
    url: x.platformPostUrl || x.url || null, error: x.errorMessage || x.error || null,
  })),
});

async function handle(action: string, b: any) {
  switch (action) {
    case 'overview': {
      const accounts = await ourAccounts();
      const ig = accounts.find((a: any) => a.platform === 'instagram');
      const fb = accounts.find((a: any) => a.platform === 'facebook');
      const to = new Date();
      const from = new Date(Date.now() - 29 * 86400_000);
      const range = `fromDate=${day(from)}&toDate=${day(to)}`;
      const [igInsights, igFollowers, fbInsights, bestTime] = await Promise.all([
        ig ? quiet(zernio(`/analytics/instagram/account-insights?accountId=${ig.id}&${range}`)) : null,
        ig ? quiet(zernio(`/analytics/instagram/follower-history?accountId=${ig.id}&${range}&metricType=time_series`)) : null,
        fb ? quiet(zernio(`/analytics/facebook/page-insights?accountId=${fb.id}&${range}`)) : null,
        quiet(zernio('/analytics/best-time?platform=instagram')),
      ]);
      return { accounts, igInsights, igFollowers, fbInsights, bestTime };
    }

    case 'posts': {
      const accounts = await ourAccounts();
      const [scheduled, recent, ...published] = await Promise.all([
        zernio('/posts?status=scheduled&limit=100&sortBy=scheduled-asc'),
        zernio('/posts?limit=30&sortBy=scheduled-desc'),
        ...accounts.map((a: any) => quiet(zernio(`/accounts/${a.id}/posts?limit=12`))),
      ]);
      return {
        scheduled: (scheduled.posts || []).map(slimPost),
        recent: (recent.posts || []).filter((p: any) => p.status !== 'scheduled').map(slimPost),
        published: accounts.map((a: any, i: number) => ({
          accountId: a.id, platform: a.platform,
          posts: ((published[i] as any)?.posts || []).map((p: any) => ({
            id: p.id, message: p.message || '', createdTime: p.createdTime, picture: p.picture || null,
            permalink: p.permalink || null, mediaType: p.mediaType, likes: p.likeCount ?? null, comments: p.commentCount ?? null,
          })),
        })),
      };
    }

    case 'presign': {
      const type = String(b.contentType || '');
      if (!/^(image\/(jpeg|png|webp)|video\/(mp4|quicktime))$/.test(type)) throw new UserError('Upload a JPG, PNG, WebP, MP4 or MOV file.');
      const size = Number(b.size) || undefined;
      if (size && size > 1024 * 1024 * 1024) throw new UserError('That file is over 1 GB.');
      const name = String(b.filename || 'upload').replace(/[^\w.-]+/g, '-').slice(-80);
      const out = await zernio('/media/presign', { method: 'POST', body: JSON.stringify({ filename: `studio-${name}`, contentType: type, size }) });
      return { uploadUrl: out.uploadUrl, publicUrl: out.publicUrl };
    }

    case 'create': {
      const accounts = await ourAccounts();
      const wanted: string[] = (Array.isArray(b.platforms) ? b.platforms : []).filter((p: string) => PLATFORMS.includes(p));
      if (!wanted.length) throw new UserError('Pick Instagram, Facebook or both.');
      const media = (Array.isArray(b.media) ? b.media : []).slice(0, 10)
        .filter((m: any) => m && /^https:\/\//.test(m.url) && ['image', 'video'].includes(m.type))
        .map((m: any) => ({ type: m.type, url: m.url, altText: String(m.altText || '').slice(0, 1000) || undefined,
          ...(m.thumbnail ? { thumbnail: m.thumbnail, instagramThumbnail: m.thumbnail } : {}) }));
      if (wanted.includes('instagram') && !media.length) throw new UserError('Instagram posts need a photo or video.');
      const content = String(b.content || '').trim();
      if (!content && !media.length) throw new UserError('Write a caption or add media.');
      if (!b.scheduledFor) throw new UserError('Choose when it should go out.');
      const when = new Date(b.timezone ? `${b.scheduledFor}` : b.scheduledFor);
      if (Number.isNaN(when.getTime())) throw new UserError('That date and time doesn’t look right.');
      const platforms = wanted.map((p) => {
        const acct = accounts.find((a: any) => a.platform === p);
        if (!acct) throw new UserError(`${p} isn’t connected in Zernio.`);
        const custom = p === 'instagram' ? b.igContent : b.fbContent;
        return { platform: p, accountId: acct.id, ...(custom ? { customContent: String(custom).slice(0, 2200) } : {}) };
      });
      const body = {
        title: String(b.title || content.split('\n')[0] || 'Studio post').slice(0, 100),
        content: content.slice(0, 2200), mediaItems: media, platforms,
        scheduledFor: b.scheduledFor, timezone: b.timezone || 'America/New_York',
        metadata: { source: 'p31-studio', createdBy: b._user },
      };
      const out = await zernio('/posts', { method: 'POST', body: JSON.stringify(body) });
      return { post: slimPost(out.post || out) };
    }

    case 'update': {
      if (!b.postId) throw new UserError('Missing post.');
      const patch: Record<string, unknown> = {};
      if (typeof b.content === 'string') patch.content = b.content.slice(0, 2200);
      if (b.scheduledFor) { patch.scheduledFor = b.scheduledFor; patch.timezone = b.timezone || 'America/New_York'; }
      if (!Object.keys(patch).length) throw new UserError('Nothing to change.');
      const out = await zernio(`/posts/${encodeURIComponent(b.postId)}`, { method: 'PUT', body: JSON.stringify(patch) });
      return { post: slimPost(out.post || out) };
    }

    case 'remove': {
      if (!b.postId) throw new UserError('Missing post.');
      await zernio(`/posts/${encodeURIComponent(b.postId)}`, { method: 'DELETE' });
      return { ok: true };
    }

    case 'inbox': {
      const out = await zernio(`/inbox/conversations?limit=40&sortOrder=desc${b.platform ? `&platform=${encodeURIComponent(b.platform)}` : ''}`);
      return {
        conversations: (out.conversations || out.data || []).map((c: any) => ({
          id: c.id || c._id, accountId: c.accountId?._id || c.accountId, platform: c.platform,
          name: c.participantName || c.participant?.name || c.participantUsername || 'Someone',
          username: c.participantUsername || c.participant?.username || null,
          picture: c.participantPicture || c.participant?.profilePicture || null,
          last: typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.message || ''),
          updatedAt: c.updatedTime || c.updatedAt || c.lastMessageAt || null, unread: c.unreadCount || 0,
        })),
      };
    }

    case 'thread': {
      if (!b.conversationId || !b.accountId) throw new UserError('Missing conversation.');
      const out = await zernio(`/inbox/conversations/${encodeURIComponent(b.conversationId)}/messages?accountId=${encodeURIComponent(b.accountId)}&limit=40&sortOrder=desc`);
      return {
        messages: (out.messages || []).reverse().map((m: any) => ({
          id: m.id, text: m.message || '', direction: m.direction, at: m.createdAt,
          attachments: (m.attachments || []).map((a: any) => a.originalType || a.type),
        })),
      };
    }

    case 'comments': {
      const out = await zernio('/inbox/comments?limit=20&sortBy=date&sortOrder=desc');
      return {
        posts: (out.posts || out.data || []).map((p: any) => ({
          id: p.id || p.postId, accountId: p.accountId?._id || p.accountId, platform: p.platform,
          text: p.content || p.message || p.caption || '', picture: p.picture || p.thumbnail || null,
          comments: p.commentCount ?? p.commentsCount ?? null, at: p.createdTime || p.createdAt || null, permalink: p.permalink || null,
        })),
      };
    }

    case 'postComments': {
      if (!b.postId || !b.accountId) throw new UserError('Missing post.');
      const out = await zernio(`/inbox/comments/${encodeURIComponent(b.postId)}?accountId=${encodeURIComponent(b.accountId)}&limit=50`);
      return {
        comments: (out.comments || out.data || []).map((c: any) => ({
          id: c.id, text: c.message || c.text || '', from: c.from?.name || c.from?.username || c.username || 'Someone',
          at: c.createdTime || c.createdAt || null, likes: c.likeCount ?? null, replies: c.replyCount ?? (c.replies?.length ?? 0),
        })),
      };
    }

    default:
      throw new UserError('Unknown action.');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!env('ZERNIO_API_KEY')) return json({ error: 'Zernio isn’t connected yet — add the ZERNIO_API_KEY secret.' }, 503);

  // Who is calling? Use their own session so the database decides.
  const authHeader = req.headers.get('Authorization') || '';
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } }, auth: { persistSession: false },
  });
  const { data: userData } = await asUser.auth.getUser();
  if (!userData?.user) return json({ error: 'Sign in to the Content Studio first.' }, 401);
  const { data: allowed, error: roleErr } = await asUser.rpc('is_studio_member');
  if (roleErr || !allowed) return json({ error: 'This account doesn’t have a Content Studio seat.' }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  try {
    return json(await handle(String(body.action || ''), { ...body, _user: userData.user.id }));
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, 400);
    console.error('studio-zernio error:', err);
    return json({ error: 'Something went wrong talking to Zernio.' }, 500);
  }
});
