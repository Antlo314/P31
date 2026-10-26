// Supabase Edge Function: studio-zernio
// The Content Studio's window into P31's social accounts. P31 has two Zernio workspaces, one key
// each (../_shared/zernio.ts): the Market one (Instagram @proverbs31market, the Facebook page) and
// the Collective one (Instagram @the.p31collective, plus the Market's TikTok). The keys never
// leave the server: Studio members and P31 admins call this with their Supabase session and a
// whitelisted `action`.
//   supabase secrets set ZERNIO_API_KEY=sk_... ZERNIO_COLLECTIVE_API_KEY=sk_...
//   supabase functions deploy studio-zernio
// Reads cover both workspaces: every post, conversation and comment comes back tagged with the
// workspace it lives in, the site (brand) it speaks for and the account's username. A workspace
// that can't be read adds a line to `notes` instead of hiding the other. Writes go to one
// workspace with its own key and are never retried with the other key.
// Body: { action, ...params }
//   accounts                      the connected Instagram, Facebook and TikTok accounts
//   overview                      accounts, 30-day insights per account, follower trend, best times
//   posts                         scheduled + recently published posts
//   presign  {filename, contentType, size}
//   create   {accountIds | platforms, content, igContent?, fbContent?, ttContent?, media[], scheduledFor, timezone,
//             title?, audioId?, audioVolume?, videoVolume?, firstComment?, coverUrl?, shareToFeed?,
//             coverMs?, tiktokBrand?, idempotencyKey?}
//            accountIds: any connected accounts. platforms (older callers): the Marketplace's
//            accounts on those platforms, never the Collective's. Accounts in both workspaces make
//            one Zernio post in each (all ids come back).
//            TikTok extras: coverMs, the moment of the video TikTok shows as the cover (when there is
//            no coverUrl); tiktokBrand: true, TikTok's "Your brand" promotion label, sent only when
//            TikTok offers it to that account (otherwise left off, and `note` says so).
//            idempotencyKey (Studio → Post plans sends the post's title): Zernio answers a repeat of
//            the same post within 24 hours with the first one instead of making a second.
//   audio    {q?, type?: music|original_sound}  → Instagram catalog audio (trending when q is empty)
//   limit                                        → Instagram publishing quota for the rolling day
//   get      {postId, workspace?}              one post with everything the editor needs
//   update   {postId, workspace?, ...the create fields}  replaces the whole post (media, captions,
//            accounts, time), within the workspace it lives in;
//            {postId, content?, scheduledFor?} still works for a quick caption or time change;
//            add publishNow: true to send it right away
//   remove   {postId, workspace?}              deletes a post that has not gone out
//   retry    {postId, workspace?}              tries a failed post again
//   editPublished {postId, workspace?, platform, content}  changes the caption of a published Facebook post
//   unpublish     {postId, workspace?, platform}           takes a published Facebook post down (Instagram cannot)
//   inbox    {platform?}           recent DM conversations (read-only)
//   thread   {conversationId, accountId}
//   comments                      posts with comments
//   postComments {postId, accountId}
// Without a workspace, a post is found by asking each workspace for it (GET /posts/{id}).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { zcall, zernioAccounts, zernioFor, siteFor, workspaceKeys, tiktokSettings, ZernioError, type Workspace, type Site, type ZAccount } from '../_shared/zernio.ts';

const PLATFORMS = ['instagram', 'facebook', 'tiktok'];
const LABEL: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };
const WORKSPACE: Record<Workspace, string> = { market: 'Marketplace', collective: 'Collective' };
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const env = (k: string) => Deno.env.get(k) || '';

class UserError extends Error {}
type Note = { workspace: Workspace; error: string };

/** Zernio's own words for a failed call, or a plain fallback. */
const zernioMessage = (e: ZernioError) => {
  const said = e.body?.error || e.body?.message;
  return typeof said === 'string' && said ? said : e.status ? `Zernio couldn’t complete that (${e.status}).` : e.message;
};
const messageOf = (e: unknown) => (e instanceof ZernioError ? zernioMessage(e) : e instanceof Error ? e.message : String(e));
const quiet = (p: Promise<any>) => p.catch((e) => ({ error: messageOf(e) }));
const notFound = (e: unknown) => e instanceof ZernioError && [401, 403, 404].includes(e.status);

const day = (d: Date) => d.toISOString().slice(0, 10);
const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() || 0 : 0);

// ── Accounts ─────────────────────────────────────────────────────────────────

/** P31's Instagram, Facebook and TikTok accounts in both workspaces, and the workspaces that could not be read. */
async function ourAccounts(fresh = false) {
  const { accounts, failed } = await zernioAccounts({ fresh });
  return { accounts: accounts.filter((a) => PLATFORMS.includes(a.platform)), failed };
}

/** Every connected account by id, to tag posts, conversations and comments with their brand. */
async function accountMap() {
  const { accounts } = await zernioAccounts();
  return new Map(accounts.map((a) => [a.id, a]));
}

const slimAccount = (a: ZAccount) => ({
  id: a.id, platform: a.platform, username: a.username, displayName: a.displayName, workspace: a.workspace, site: a.site,
  picture: a.raw?.profilePicture || null, followers: a.raw?.followersCount ?? null, active: !!a.raw?.isActive && a.raw?.enabled !== false,
  status: a.raw?.platformStatus || null, needsReconnection: !!a.raw?.needsReconnection, tokenExpiresAt: a.raw?.tokenExpiresAt || null,
  profileUrl: a.raw?.profileUrl || null,
});

const failNotes = (failed: Workspace[]): Note[] =>
  failed.map((w) => ({ workspace: w, error: `The ${WORKSPACE[w]} Zernio accounts could not be read just now, so they are missing here.` }));
/** The same notes for a read that has its own: a workspace already noted is not noted twice. */
const listingNotes = async (notes: Note[]) =>
  failNotes((await zernioAccounts()).failed.filter((w) => !notes.some((n) => n.workspace === w)));

/** The workspace, brand and username for an item that names an account. */
function tag(byId: Map<string, ZAccount>, accountId: string, workspace: Workspace, platform?: string, username?: string) {
  const a = byId.get(accountId);
  const name = a?.username || String(username || '').replace(/^@/, '');
  return { workspace, site: (a?.site || siteFor({ id: accountId, workspace, platform, username: name })) as Site, accountUsername: name };
}

/**
 * The same read with every workspace's key. One that fails becomes a note instead of hiding the
 * other; when every workspace fails, the first error is thrown.
 */
async function eachWorkspace<T>(read: (w: Workspace) => Promise<T>) {
  const keys = workspaceKeys();
  if (!keys.length) throw new UserError('Zernio isn’t connected yet.');
  const settled = await Promise.allSettled(keys.map(({ workspace }) => read(workspace)));
  const ok: { workspace: Workspace; value: T }[] = [];
  const notes: Note[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') ok.push({ workspace: keys[i].workspace, value: r.value });
    else notes.push({ workspace: keys[i].workspace, error: `${WORKSPACE[keys[i].workspace]}: ${messageOf(r.reason)}` });
  });
  if (!ok.length) throw (settled[0] as PromiseRejectedResult).reason;
  return { ok, notes };
}

/** Keep the first of each id (both keys of one shared Zernio team see the same items). */
const unique = <T>(rows: T[], id: (r: T) => string) => {
  const seen = new Set<string>();
  return rows.filter((r) => { const k = id(r); if (seen.has(k)) return false; seen.add(k); return true; });
};

// ── Posts ────────────────────────────────────────────────────────────────────

const slimPost = (p: any, workspace: Workspace, byId: Map<string, ZAccount>) => {
  const platforms = (p.platforms || []).map((x: any) => {
    const accountId = x.accountId?._id || x.accountId;
    return {
      platform: x.platform, accountId, ...tag(byId, accountId, workspace, x.platform, x.accountId?.username),
      status: x.status, url: x.platformPostUrl || x.url || null, error: x.errorMessage || x.error || null,
      customContent: x.customContent || '', firstComment: x.platformSpecificData?.firstComment || '',
      audioId: x.platformSpecificData?.audioConfiguration?.audioId || null,
      shareToFeed: x.platformSpecificData?.shareToFeed !== false,
    };
  });
  const sites = [...new Set(platforms.map((x: any) => x.site))];
  return {
    id: p._id || p.id, title: p.title || '', content: p.content || '', status: p.status, isDraft: !!p.isDraft,
    scheduledFor: p.scheduledFor || null, publishedAt: p.publishedAt || null, timezone: p.timezone || null,
    workspace, site: sites.length === 1 ? sites[0] : sites.length ? 'both' : siteFor({ workspace }),
    media: (p.mediaItems || []).map((m: any) => ({ type: m.type, url: m.url, thumbnail: m.thumbnail || m.instagramThumbnail || null, altText: m.altText || '' })),
    platforms,
  };
};

/** A post sent "now" that Zernio could not publish anywhere (it answers 207, a success code, with status failed). */
const sendFailure = (post: ReturnType<typeof slimPost>) =>
  post.status === 'failed' ? `It didn’t go out: ${post.platforms.map((x: any) => x.error).filter(Boolean).join(' · ') || 'Zernio could not publish it.'}` : '';

/** Which workspace a post lives in: the one the Studio sent, or the first whose key can read it. */
async function locate(postId: string, hint?: unknown): Promise<{ workspace: Workspace; post?: any }> {
  const keys = workspaceKeys().map((k) => k.workspace);
  if (typeof hint === 'string' && keys.includes(hint as Workspace)) return { workspace: hint as Workspace };
  for (const workspace of keys) {
    try {
      const out = await zcall(workspace, `/posts/${encodeURIComponent(postId)}`);
      return { workspace, post: out.post || out };
    } catch (e) {
      // Only "not in this workspace" moves on; anything else (a 429, an outage) is the answer.
      if (!notFound(e)) throw e;
    }
  }
  throw new UserError('That post isn’t in Zernio any more. It may have been deleted.');
}

/** The accounts a post goes to: the ones chosen by id, or the Marketplace's accounts on the named platforms. */
function chosenAccounts(b: any, accounts: ZAccount[], failed: Workspace[]) {
  const later = failed.length ? ' right now. Try again in a minute.' : '. Reconnect it in Zernio, then reload this page.';
  if (Array.isArray(b.accountIds) && b.accountIds.length) {
    return [...new Set(b.accountIds.map(String))].map((id) => {
      const a = accounts.find((x) => x.id === id);
      if (!a) throw new UserError(`One of the chosen accounts isn’t connected in Zernio${later}`);
      return a;
    });
  }
  // Older callers (Factory, Planner, Batch, the Design studio) name platforms; those posts are the
  // Marketplace's, so they never land on the Collective's Instagram.
  const wanted = [...new Set<string>((Array.isArray(b.platforms) ? b.platforms : []).filter((p: string) => PLATFORMS.includes(p)))];
  return wanted.map((p) => {
    const a = accounts.find((x) => x.platform === p && x.site === 'market');
    if (!a) throw new UserError(`The Marketplace ${LABEL[p]} isn’t connected in Zernio${later}`);
    return a;
  });
}

/**
 * The Zernio post bodies from the composer's fields (shared by create and a full update): one per
 * workspace the chosen accounts live in, since each workspace only takes its own accounts.
 * `within` keeps an update inside the workspace its post lives in. Anything left off a post on the
 * way (a TikTok label the account doesn't offer) is added to `notes`.
 */
async function buildPosts(b: any, within?: Workspace, notes: string[] = []) {
  let { accounts, failed } = await ourAccounts();
  // An id the cached list doesn't know (an account reconnected since): look once more.
  if (Array.isArray(b.accountIds) && b.accountIds.some((id: unknown) => !accounts.some((a) => a.id === String(id)))) {
    ({ accounts, failed } = await ourAccounts(true));
  }
  const chosen = chosenAccounts(b, accounts, failed);
  if (!chosen.length) throw new UserError('Pick at least one account to post to.');
  if (within) {
    const outside = chosen.filter((a) => a.workspace !== within);
    if (outside.length) {
      throw new UserError(`A saved post can only use the accounts in its own Zernio account (the ${WORKSPACE[within]} one). To post to ${outside.map(accountName).join(' and ')} too, duplicate it and schedule the copy.`);
    }
  }
  const tiktok = chosen.filter((a) => a.platform === 'tiktok');
  const meta = chosen.filter((a) => a.platform !== 'tiktok');
  const media = (Array.isArray(b.media) ? b.media : [])
    .filter((m: any) => m && /^https:\/\//.test(m.url) && ['image', 'video'].includes(m.type))
    .slice(0, meta.length ? 10 : 35)
    .map((m: any) => ({ type: m.type, url: m.url, altText: String(m.altText || '').slice(0, 1000) || undefined,
      ...(m.thumbnail ? { thumbnail: m.thumbnail, instagramThumbnail: m.thumbnail } : {}) }));
  const videos = media.filter((m: any) => m.type === 'video').length;
  const photos = media.length - videos;
  if (chosen.some((a) => a.platform === 'instagram') && !media.length) throw new UserError('Instagram posts need a photo or video.');
  if (meta.length && media.some((m: any) => m.type === 'video' && /\.webm(?:[?#]|$)/i.test(m.url))) {
    throw new UserError('Instagram and Facebook don’t take WebM video. Save it as an MP4, or post the WebM to TikTok only.');
  }
  if (tiktok.length && !((videos === 1 && !photos) || (!videos && photos >= 1 && photos <= 35))) {
    throw new UserError('TikTok needs one video, or 1 to 35 photos (not a mix of both).');
  }
  const content = String(b.content || '').trim();
  if (!content && !media.length) throw new UserError('Write a caption or add media.');
  if (!b.publishNow) {
    if (!b.scheduledFor) throw new UserError('Choose when it should go out.');
    if (Number.isNaN(new Date(b.scheduledFor).getTime())) throw new UserError('That date and time doesn’t look right.');
  }
  const isReel = media.length === 1 && media[0].type === 'video';
  const coverUrl = String(b.coverUrl || '');
  // TikTok's cover moment, in milliseconds into the video (at most 10 minutes, TikTok's longest).
  const coverMs = typeof b.coverMs === 'number' && Number.isFinite(b.coverMs) && b.coverMs >= 0 ? Math.min(Math.round(b.coverMs), 600_000) : null;
  const entries = await Promise.all(chosen.map(async (acct) => {
    const p = acct.platform;
    // Each platform's own caption when one was written; TikTok never gets the Facebook one.
    const custom = p === 'instagram' ? b.igContent : p === 'facebook' ? b.fbContent : b.ttContent;
    // Instagram extras: a catalog track on a reel, a cover frame, the first comment, feed sharing.
    const extra: Record<string, unknown> = {};
    if (p === 'instagram') {
      if (isReel && b.audioId) {
        extra.audioConfiguration = { audioId: String(b.audioId), audioVolume: Math.max(0, Math.min(100, Number(b.audioVolume ?? 100))), videoVolume: Math.max(0, Math.min(100, Number(b.videoVolume ?? 100))) };
      }
      if (isReel && /^https:\/\//.test(coverUrl)) extra.instagramThumbnail = coverUrl;
      if (isReel && b.shareToFeed === false) extra.shareToFeed = false;
      if (!isReel && String(b.firstComment || '').trim()) extra.firstComment = String(b.firstComment).trim().slice(0, 2200);
    }
    if (p === 'tiktok') {
      const tt = await tiktokSettings(acct, videos === 1, coverUrl, String(custom || content).trim(), { coverMs, brand: b.tiktokBrand === true });
      extra.tiktokSettings = tt.settings;
      if (tt.note) notes.push(tt.note);
    }
    const entry = { platform: p, accountId: acct.id, ...(custom ? { customContent: String(custom).slice(0, 2200) } : {}), ...(Object.keys(extra).length ? { platformSpecificData: extra } : {}) };
    return { acct, entry };
  }));

  const groups = new Map<Workspace, { accounts: ZAccount[]; platforms: unknown[] }>();
  for (const { acct, entry } of entries) {
    if (!groups.has(acct.workspace)) groups.set(acct.workspace, { accounts: [], platforms: [] });
    groups.get(acct.workspace)!.accounts.push(acct);
    groups.get(acct.workspace)!.platforms.push(entry);
  }
  const base = {
    title: String(b.title || content.split('\n')[0] || 'Studio post').slice(0, 100),
    content: content.slice(0, 2200), mediaItems: media,
    ...(b.publishNow ? { publishNow: true } : { scheduledFor: b.scheduledFor, timezone: b.timezone || 'America/New_York' }),
  };
  return [...groups.entries()].map(([workspace, g]) => ({ workspace, accounts: g.accounts, body: { ...base, platforms: g.platforms } }));
}

const accountName = (a: ZAccount) => (a.platform === 'facebook' ? `${a.displayName || 'the Facebook page'}` : `@${a.username.replace(/^@/, '')} on ${LABEL[a.platform] || a.platform}`);

/**
 * The Idempotency-Key for one workspace's POST /posts, from the caller's key (made header-safe) and
 * a short hash of what the post says, when and where (not its media link: a retry uploads the video
 * again). Zernio keeps a key 24 hours, so a retry of the same post gets the first one back, while a
 * post deleted and then scheduled again with changes is a new post.
 */
async function idempotencyKey(b: any, workspace: Workspace, body: any) {
  const key = String(b.idempotencyKey || '').normalize('NFKD').replace(/[^\w.:-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
  if (!key) return null;
  const what = new TextEncoder().encode(JSON.stringify([body.content, body.scheduledFor || 'now', body.timezone || '', body.platforms]));
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', what))].slice(0, 6).map((n) => n.toString(16).padStart(2, '0')).join('');
  return `studio-${key}-${workspace}-${hash}`;
}

// ── Actions ──────────────────────────────────────────────────────────────────

async function handle(action: string, b: any) {
  switch (action) {
    case 'accounts': {
      const { accounts, failed } = await ourAccounts();
      return { accounts: accounts.map(slimAccount), notes: failNotes(failed) };
    }

    case 'overview': {
      const { accounts, failed } = await ourAccounts();
      const to = new Date();
      const from = new Date(Date.now() - 29 * 86400_000);
      const range = `fromDate=${day(from)}&toDate=${day(to)}`;
      // Insights for every Instagram and Facebook account, each read with its own workspace's key.
      const insights = await Promise.all(accounts.filter((a) => a.platform !== 'tiktok').map(async (a) => {
        const id = encodeURIComponent(a.id);
        const ig = a.platform === 'instagram';
        const [metrics, followers] = await Promise.all([
          quiet(zcall(a.workspace, ig ? `/analytics/instagram/account-insights?accountId=${id}&${range}` : `/analytics/facebook/page-insights?accountId=${id}&${range}`)),
          ig ? quiet(zcall(a.workspace, `/analytics/instagram/follower-history?accountId=${id}&${range}&metricType=time_series`)) : Promise.resolve(null),
        ]);
        return { accountId: a.id, platform: a.platform, username: a.username, displayName: a.displayName, site: a.site, workspace: a.workspace, insights: metrics, followers };
      }));
      // The Marketplace's own accounts keep their old places (igInsights, fbInsights) for older screens.
      const ig = insights.find((i) => i.platform === 'instagram' && i.site === 'market');
      const fb = insights.find((i) => i.platform === 'facebook' && i.site === 'market');
      const bestFrom = accounts.find((a) => a.platform === 'instagram' && a.site === 'market')?.workspace || workspaceKeys()[0]?.workspace;
      const bestTime = bestFrom ? await quiet(zcall(bestFrom, '/analytics/best-time?platform=instagram')) : null;
      return {
        accounts: accounts.map(slimAccount), insights,
        igInsights: ig?.insights || null, igFollowers: ig?.followers || null, fbInsights: fb?.insights || null,
        bestTime, notes: failNotes(failed),
      };
    }

    case 'posts': {
      const { accounts, failed } = await ourAccounts();
      const byId = await accountMap();
      const read = await eachWorkspace(async (w) => {
        const [scheduled, recent] = await Promise.all([
          zcall(w, '/posts?status=scheduled&limit=100&sortBy=scheduled-asc'),
          zcall(w, '/posts?limit=30&sortBy=scheduled-desc'),
        ]);
        return {
          scheduled: (scheduled.posts || []).map((p: any) => slimPost(p, w, byId)),
          recent: (recent.posts || []).filter((p: any) => p.status !== 'scheduled').map((p: any) => slimPost(p, w, byId)),
        };
      });
      const published = await Promise.all(accounts.map((a) => quiet(zcall(a.workspace, `/accounts/${encodeURIComponent(a.id)}/posts?limit=12`))));
      return {
        scheduled: unique(read.ok.flatMap((r) => r.value.scheduled), (p) => p.id).sort((x, y) => time(x.scheduledFor) - time(y.scheduledFor)),
        recent: unique(read.ok.flatMap((r) => r.value.recent), (p) => p.id)
          .sort((x, y) => time(y.publishedAt || y.scheduledFor) - time(x.publishedAt || x.scheduledFor)).slice(0, 40),
        published: accounts.map((a, i) => ({
          accountId: a.id, platform: a.platform, username: a.username, site: a.site, workspace: a.workspace,
          posts: ((published[i] as any)?.posts || []).map((p: any) => ({
            id: p.id, message: p.message || '', createdTime: p.createdTime, picture: p.picture || null,
            permalink: p.permalink || null, mediaType: p.mediaType, likes: p.likeCount ?? null, comments: p.commentCount ?? null,
          })),
        })),
        notes: [...read.notes, ...failNotes(failed.filter((w) => !read.notes.some((n) => n.workspace === w)))],
      };
    }

    case 'presign': {
      const type = String(b.contentType || '');
      if (!/^(image\/(jpeg|png|webp)|video\/(mp4|quicktime|webm))$/.test(type)) throw new UserError('Upload a JPG, PNG, WebP, MP4, MOV or WebM file.');
      const size = Number(b.size) || undefined;
      if (size && size > 1024 * 1024 * 1024) throw new UserError('That file is over 1 GB.');
      const name = String(b.filename || 'upload').replace(/[^\w.-]+/g, '-').slice(-80);
      // Uploaded media gets a public URL, so a post in either workspace can use it.
      const workspace = workspaceKeys()[0].workspace;
      const out = await zcall(workspace, '/media/presign', { method: 'POST', body: JSON.stringify({ filename: `studio-${name}`, contentType: type, size }) });
      return { uploadUrl: out.uploadUrl, publicUrl: out.publicUrl };
    }

    case 'create': {
      const notes: string[] = [];
      const groups = await buildPosts(b, undefined, notes);
      const byId = await accountMap();
      const made: ReturnType<typeof slimPost>[] = [];
      const errors: unknown[] = [];
      const missed: string[] = [];
      // One Zernio post per workspace, each with its own key. A failure in one never resends the other.
      for (const { workspace, accounts, body } of groups) {
        try {
          const key = await idempotencyKey(b, workspace, body);
          const out = await zcall(workspace, '/posts', {
            method: 'POST', body: JSON.stringify({ ...body, metadata: { source: 'p31-studio', createdBy: b._user } }),
            ...(key ? { headers: { 'Idempotency-Key': key } } : {}),
          });
          const post = slimPost(out.post || out, workspace, byId);
          const failure = sendFailure(post);
          if (failure) throw new UserError(failure);
          // A repeat of an idempotency key: Zernio answers with the post it made the first time.
          if (key && /idempotent/i.test(String(out.message || ''))) notes.push('Zernio already had this post from an earlier try, so it kept that one.');
          made.push(post);
        } catch (e) {
          errors.push(e);
          missed.push(`${accounts.map(accountName).join(' and ')} (${messageOf(e)})`);
        }
      }
      if (!made.length) throw errors[0];
      return {
        post: made[0], posts: made, ids: made.map((p) => p.id),
        ...(missed.length ? { warning: `Done for the rest, but not for ${missed.join('; ')}.` } : {}),
        ...(notes.length ? { note: notes.join(' ') } : {}),
      };
    }

    case 'get': {
      if (!b.postId) throw new UserError('Missing post.');
      const { workspace, post } = await locate(String(b.postId), b.workspace);
      const out = post || (await zcall(workspace, `/posts/${encodeURIComponent(b.postId)}`));
      return { post: slimPost(out.post || out, workspace, await accountMap()) };
    }

    // Instagram catalog audio: trending when there is no search, otherwise a search. Needs the
    // Instagram account connected to Zernio through Facebook Login (Meta's rule, not ours).
    case 'audio': {
      const { accounts } = await ourAccounts();
      const ig = accounts.find((a) => a.platform === 'instagram' && (b.accountId ? a.id === b.accountId : a.site === 'market'));
      if (!ig) throw new UserError('Instagram isn’t connected in Zernio.');
      const q = String(b.q || '').trim().slice(0, 80);
      const type = b.type === 'original_sound' ? 'original_sound' : 'music';
      try {
        const out = await zcall(ig.workspace, `/accounts/${encodeURIComponent(ig.id)}/instagram/audio?audioType=${type}${q ? `&q=${encodeURIComponent(q)}` : ''}`);
        return {
          trending: !q,
          audio: (out.audio || []).map((a: any) => ({
            id: a.audioId, title: a.title, artist: a.displayArtist || a.igUsername || null, type: a.audioType, durationMs: a.durationInMs,
            artwork: a.coverArtworkThumbnailUrl || a.profilePictureUrl || null, preview: a.downloadUrl || null, adsEligible: a.isAdsEligible ?? null,
          })),
        };
      } catch (err) {
        const msg = messageOf(err);
        if (/facebook|login|permission|not supported/i.test(msg) || (err instanceof ZernioError && err.status === 403)) {
          throw new UserError('Trending audio needs the Instagram account reconnected in Zernio with “Facebook Login” (Zernio → Accounts → Instagram → Reconnect).');
        }
        throw err;
      }
    }

    case 'limit': {
      const { accounts } = await ourAccounts();
      const ig = accounts.find((a) => a.platform === 'instagram' && (b.accountId ? a.id === b.accountId : a.site === 'market'));
      if (!ig) throw new UserError('Instagram isn’t connected in Zernio.');
      const out = await zcall(ig.workspace, `/accounts/${encodeURIComponent(ig.id)}/instagram/publishing-limit`);
      return { used: out.quotaUsage ?? null, total: out.quotaTotal ?? null, windowSeconds: out.quotaDurationSeconds ?? null };
    }

    case 'update': {
      if (!b.postId) throw new UserError('Missing post.');
      const { workspace } = await locate(String(b.postId), b.workspace);
      let patch: Record<string, unknown> = {};
      if (Array.isArray(b.accountIds) || Array.isArray(b.platforms)) {
        // The whole post from the editor: media, captions, accounts, first comment, time (or now).
        const [one] = await buildPosts(b, workspace);
        patch = { ...one.body, isDraft: false };
      } else {
        if (typeof b.content === 'string') patch.content = b.content.slice(0, 2200);
        if (b.publishNow) { patch.publishNow = true; patch.isDraft = false; }
        else if (b.scheduledFor) { patch.scheduledFor = b.scheduledFor; patch.timezone = b.timezone || 'America/New_York'; }
      }
      if (!Object.keys(patch).length) throw new UserError('Nothing to change.');
      const out = await zcall(workspace, `/posts/${encodeURIComponent(b.postId)}`, { method: 'PUT', body: JSON.stringify(patch) });
      const post = slimPost(out.post || out, workspace, await accountMap());
      const failure = b.publishNow ? sendFailure(post) : '';
      if (failure) throw new UserError(failure);
      return { post };
    }

    case 'retry': {
      if (!b.postId) throw new UserError('Missing post.');
      const { workspace } = await locate(String(b.postId), b.workspace);
      const out = await zcall(workspace, `/posts/${encodeURIComponent(b.postId)}/retry`, { method: 'POST', body: '{}' });
      return { post: slimPost(out.post || out, workspace, await accountMap()) };
    }

    case 'editPublished': {
      if (!b.postId) throw new UserError('Missing post.');
      if (b.platform !== 'facebook') throw new UserError('Only Facebook lets a published caption be changed. Instagram does not.');
      const content = String(b.content || '').trim();
      if (!content) throw new UserError('Write the new caption.');
      const { workspace } = await locate(String(b.postId), b.workspace);
      await zcall(workspace, `/posts/${encodeURIComponent(b.postId)}/edit`, { method: 'POST', body: JSON.stringify({ platform: 'facebook', content: content.slice(0, 2200) }) });
      return { ok: true };
    }

    case 'unpublish': {
      if (!b.postId) throw new UserError('Missing post.');
      if (b.platform !== 'facebook') throw new UserError('Instagram does not allow posts to be taken down from here. Delete it in the Instagram app.');
      const { workspace } = await locate(String(b.postId), b.workspace);
      await zcall(workspace, `/posts/${encodeURIComponent(b.postId)}/unpublish`, { method: 'POST', body: JSON.stringify({ platform: 'facebook' }) });
      return { ok: true };
    }

    case 'remove': {
      if (!b.postId) throw new UserError('Missing post.');
      const { workspace } = await locate(String(b.postId), b.workspace);
      await zcall(workspace, `/posts/${encodeURIComponent(b.postId)}`, { method: 'DELETE' });
      return { ok: true };
    }

    case 'inbox': {
      const byId = await accountMap();
      const platform = PLATFORMS.includes(b.platform) ? String(b.platform) : '';
      const rows: { workspace: Workspace; c: any }[] = [];
      const notes: Note[] = [];
      if (platform !== 'tiktok') {
        const read = await eachWorkspace((w) => zcall(w, `/inbox/conversations?limit=40&sortOrder=desc${platform ? `&platform=${platform}` : ''}`));
        read.ok.forEach(({ workspace, value }) => (value.conversations || value.data || []).forEach((c: any) => rows.push({ workspace, c })));
        notes.push(...read.notes);
      }
      // Zernio's platform filter has no TikTok, so TikTok conversations are read by account (a
      // workspace whose accounts could not be listed gets a note, so an empty TikTok tab is explained).
      if (!platform || platform === 'tiktok') {
        const tiktoks = [...byId.values()].filter((a) => a.platform === 'tiktok');
        await Promise.all(tiktoks.map(async (a) => {
          try {
            const out = await zcall(a.workspace, `/inbox/conversations?accountId=${encodeURIComponent(a.id)}&limit=40&sortOrder=desc`);
            (out.conversations || out.data || []).forEach((c: any) => rows.push({ workspace: a.workspace, c: { platform: 'tiktok', accountId: a.id, ...c } }));
          } catch (e) {
            notes.push({ workspace: a.workspace, error: `TikTok messages for @${a.username}: ${messageOf(e)}` });
          }
        }));
      }
      const conversations = rows.map(({ workspace, c }) => {
        const accountId = c.accountId?._id || c.accountId;
        return {
          id: c.id || c._id, accountId, platform: c.platform, ...tag(byId, accountId, workspace, c.platform, c.accountUsername),
          name: c.participantName || c.participant?.name || c.participantUsername || 'Someone',
          username: c.participantUsername || c.participant?.username || null,
          picture: c.participantPicture || c.participant?.profilePicture || null,
          last: typeof c.lastMessage === 'string' ? c.lastMessage : (c.lastMessage?.message || ''),
          updatedAt: c.updatedTime || c.updatedAt || c.lastMessageAt || null, unread: c.unreadCount || 0,
        };
      });
      return {
        conversations: unique(conversations, (c) => `${c.accountId}:${c.id}`).sort((x, y) => time(y.updatedAt) - time(x.updatedAt)).slice(0, 60),
        notes: [...notes, ...await listingNotes(notes)],
      };
    }

    case 'thread': {
      if (!b.conversationId || !b.accountId) throw new UserError('Missing conversation.');
      const out = await zernioFor(String(b.accountId), `/inbox/conversations/${encodeURIComponent(b.conversationId)}/messages?accountId=${encodeURIComponent(b.accountId)}&limit=40&sortOrder=desc`);
      return {
        messages: (out.messages || []).reverse().map((m: any) => ({
          id: m.id, text: m.message || '', direction: m.direction, at: m.createdAt,
          attachments: (m.attachments || []).map((a: any) => a.originalType || a.type),
        })),
      };
    }

    case 'comments': {
      const byId = await accountMap();
      const read = await eachWorkspace((w) => zcall(w, '/inbox/comments?limit=20&sortBy=date&sortOrder=desc'));
      const posts = read.ok.flatMap(({ workspace, value }) => (value.posts || value.data || []).map((p: any) => {
        const accountId = p.accountId?._id || p.accountId;
        return {
          id: p.id || p.postId, accountId, platform: p.platform, ...tag(byId, accountId, workspace, p.platform, p.accountUsername),
          text: p.content || p.message || p.caption || '', picture: p.picture || p.thumbnail || null,
          comments: p.commentCount ?? p.commentsCount ?? null, at: p.createdTime || p.createdAt || null, permalink: p.permalink || null,
        };
      }));
      return { posts: unique(posts, (p) => `${p.accountId}:${p.id}`).sort((x, y) => time(y.at) - time(x.at)).slice(0, 40), notes: [...read.notes, ...await listingNotes(read.notes)] };
    }

    case 'postComments': {
      if (!b.postId || !b.accountId) throw new UserError('Missing post.');
      const out = await zernioFor(String(b.accountId), `/inbox/comments/${encodeURIComponent(b.postId)}?accountId=${encodeURIComponent(b.accountId)}&limit=50`);
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
  if (!workspaceKeys().length) return json({ error: 'Zernio isn’t connected yet — add the ZERNIO_API_KEY or ZERNIO_COLLECTIVE_API_KEY secret.' }, 503);

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
    // Zernio's refusals were logged by zcall; the Studio shows Zernio's own words.
    if (err instanceof ZernioError) return json({ error: zernioMessage(err) }, 400);
    console.error('studio-zernio error:', err);
    return json({ error: 'Something went wrong talking to Zernio.' }, 500);
  }
});
