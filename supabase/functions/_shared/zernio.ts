// Zernio for the edge functions. P31 has two Zernio workspaces, one API key each:
//   market      ZERNIO_API_KEY             Instagram @proverbs31market, the Facebook page, Google Business
//   collective  ZERNIO_COLLECTIVE_API_KEY  Instagram @the.p31collective, plus the Market's TikTok
// An account can only be reached with the key of the workspace it lives in, and which brand it
// speaks for is a separate question: the TikTok sits in the Collective workspace but is the Market's.
// Accounts are looked up live (GET /accounts with each key), so no account ids are hard-coded.
// Optional override, for an account that should answer for the other brand:
//   ZERNIO_ACCOUNT_SITES="<accountId>=market,<accountId>=collective"

export const ZERNIO = 'https://zernio.com/api/v1';
export type Workspace = 'market' | 'collective';
export type Site = 'market' | 'collective';

const env = (k: string) => Deno.env.get(k) || '';

/** The workspaces that have a key set, Market first. */
export function workspaceKeys(): { workspace: Workspace; key: string }[] {
  return ([
    { workspace: 'market', key: env('ZERNIO_API_KEY') },
    { workspace: 'collective', key: env('ZERNIO_COLLECTIVE_API_KEY') },
  ] as { workspace: Workspace; key: string }[]).filter((w) => !!w.key);
}

export class ZernioError extends Error {
  status: number;
  path: string;
  body: Record<string, unknown>;
  constructor(status: number, path: string, body: Record<string, unknown>) {
    super(String(body?.error || body?.message || `Zernio ${status} on ${path}`));
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

/** One call with one workspace's key. A non-2xx answer is logged and thrown as a ZernioError. */
export async function zcall(workspace: Workspace, path: string, init: RequestInit = {}) {
  const key = workspaceKeys().find((w) => w.workspace === workspace)?.key;
  if (!key) throw new ZernioError(0, path, { error: `No Zernio key is set for the ${workspace} workspace.` });
  const res = await fetch(`${ZERNIO}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 300) }; }
  if (!res.ok) {
    console.error(`Zernio ${workspace} ${res.status} ${init.method || 'GET'} ${path.split('?')[0]}: ${text.slice(0, 300)}`);
    throw new ZernioError(res.status, path, body);
  }
  return body as any;
}

export type ZAccount = {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  profileId: string | null;
  workspace: Workspace;
  site: Site;
  raw: any;
};

function overrides() {
  const map = new Map<string, Site>();
  for (const part of env('ZERNIO_ACCOUNT_SITES').split(',')) {
    const [id, site] = part.split('=').map((s) => s.trim());
    if (id && (site === 'market' || site === 'collective')) map.set(id, site);
  }
  return map;
}

/** The brand an account answers for, from where it lives (the TikTok is always the Market's). */
export function siteFor(a: { id?: string; workspace?: Workspace | null; platform?: string; username?: string; displayName?: string }): Site {
  const forced = a.id ? overrides().get(a.id) : undefined;
  if (forced) return forced;
  if ((a.platform || '').toLowerCase() === 'tiktok') return 'market';
  if (a.workspace === 'collective') return 'collective';
  if (a.workspace === 'market') return 'market';
  // Unknown workspace (both keys see the account, or the lookup failed): go by the account name.
  return `${a.username || ''} ${a.displayName || ''}`.toLowerCase().includes('collective') ? 'collective' : 'market';
}

let cache: { at: number; accounts: ZAccount[]; failed: Workspace[] } | null = null;
const TTL = 10 * 60_000;

/**
 * Every connected account in both workspaces, cached about 10 minutes per function instance.
 * `failed` lists workspaces whose key could not list its accounts (bad key, outage).
 */
export async function zernioAccounts({ fresh = false } = {}) {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache;
  const seen = new Map<string, { a: any; workspaces: Workspace[] }>();
  const failed: Workspace[] = [];
  for (const { workspace } of workspaceKeys()) {
    try {
      const data = await zcall(workspace, '/accounts');
      for (const a of data.accounts || []) {
        const id = String(a._id || a.id || '');
        if (!id) continue;
        const hit = seen.get(id);
        if (hit) hit.workspaces.push(workspace);
        else seen.set(id, { a, workspaces: [workspace] });
      }
    } catch (e) {
      console.warn(`zernio: could not list the ${workspace} accounts —`, (e as Error).message);
      failed.push(workspace);
    }
  }
  const accounts: ZAccount[] = [...seen.entries()].map(([id, { a, workspaces }]) => {
    // Seen by both keys means one shared Zernio team: either key works, and the brand comes from the name.
    const only = workspaces.length === 1 ? workspaces[0] : null;
    const base = { id, platform: String(a.platform || ''), username: String(a.username || ''), displayName: String(a.displayName || '') };
    return {
      ...base,
      profileId: (typeof a.profileId === 'object' ? a.profileId?._id : a.profileId) || null,
      workspace: only || workspaces[0],
      site: siteFor({ ...base, workspace: only }),
      raw: a,
    };
  });
  cache = { at: Date.now(), accounts, failed };
  return cache;
}

/** One account by id; refreshes the list once if the id is new (a reconnect changes account ids). */
export async function zernioAccount(id: string | null | undefined) {
  if (!id) return null;
  let { accounts, at } = await zernioAccounts();
  let hit = accounts.find((a) => a.id === id);
  if (!hit && Date.now() - at > 60_000) {
    ({ accounts } = await zernioAccounts({ fresh: true }));
    hit = accounts.find((a) => a.id === id);
  }
  return hit || null;
}

/**
 * A call for one account, with the key of the workspace it lives in. If the account is unknown
 * (its listing failed), each key is tried, moving on only when Zernio says "not yours" (401/403/404):
 * an error like 429 or 500 is thrown, never retried with the other key (that could send twice).
 */
export async function zernioFor(accountId: string | null | undefined, path: string, init: RequestInit = {}) {
  const acct = await zernioAccount(accountId);
  if (acct) return zcall(acct.workspace, path, init);
  let last: unknown = null;
  for (const { workspace } of workspaceKeys()) {
    try {
      return await zcall(workspace, path, init);
    } catch (e) {
      last = e;
      if (!(e instanceof ZernioError) || ![401, 403, 404].includes(e.status)) throw e;
    }
  }
  throw last || new ZernioError(0, path, { error: 'No Zernio key is set.' });
}

/**
 * TikTok's required settings (Zernio passes them to TikTok): public unless the creator's account
 * only allows narrower audiences; comments, duets and stitches allowed unless she switched them
 * off in the TikTok app; the preview and consent confirmations TikTok asks every post for.
 * The cover is the image when one was sent, otherwise the video's frame at coverMs. `brand` asks for
 * TikTok's "Your brand" label (brand_organic), which goes on only when creator-info lists it for
 * this account; `note` says when it was left off. Shared by studio-zernio and content-autopilot.
 */
export async function tiktokSettings(acct: ZAccount, video: boolean, coverUrl: string, caption: string, opts: { coverMs?: number | null; brand?: boolean; music?: unknown } = {}) {
  const wanted = tiktokMusicSettings(opts.music, video);
  const [info, lane] = await Promise.all([
    zcall(acct.workspace, `/accounts/${encodeURIComponent(acct.id)}/tiktok/creator-info?mediaType=${video ? 'video' : 'photo'}`).catch(() => null),
    wanted ? tiktokLane(acct) : Promise.resolve(null),
  ]);
  const levels: string[] = (info?.privacyLevels || []).map((l: any) => l?.value).filter(Boolean);
  const privacy = !levels.length || levels.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE'
    : ['FOLLOWER_OF_CREATOR', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'].find((l) => levels.includes(l)) || levels[0];
  const allowed = (k: string) => info?.postingLimits?.interactionSettings?.[k]?.enabled !== false;
  const labels: string[] = (info?.commercialContentTypes || []).map((x: any) => (typeof x === 'string' ? x : x?.value)).filter(Boolean);
  const brand = !!opts.brand && labels.includes('brand_organic');
  const notes: string[] = [];
  if (opts.brand && !brand) {
    notes.push(`${info ? `TikTok doesn’t offer @${acct.username} the “Your brand” label` : `TikTok didn’t say whether @${acct.username} can use the “Your brand” label`}, so it was left off.`);
  }
  // A developer-app connection fails a post with a commercial track at publish time, so the track
  // is left off up front (the post keeps its own sound). An unknown lane keeps the track.
  const music = wanted && lane !== 'developer' ? wanted : null;
  if (wanted && !music) notes.push(`The TikTok track was left off (the post keeps its own sound): @${acct.username} is on TikTok’s developer app, and trending music needs the TikTok for Business app. Reconnect it in Zernio.`);
  const note = notes.join(' ');
  const settings = {
    privacy_level: privacy,
    allow_comment: allowed('allow_comment'),
    ...(video ? { allow_duet: allowed('allow_duet'), allow_stitch: allowed('allow_stitch') } : {}),
    content_preview_confirmed: true,
    express_consent_given: true,
    ...(video && /^https:\/\//.test(coverUrl) ? { video_cover_image_url: coverUrl }
      : video && opts.coverMs != null ? { video_cover_timestamp_ms: opts.coverMs } : {}),
    ...(brand ? { commercialContentType: 'brand_organic' } : {}),
    // A photo post's caption becomes a 90-character title; the description carries all of it.
    ...(!video && caption ? { description: caption.slice(0, 4000) } : {}),
    ...(music || {}),
  };
  return { settings, note };
}

// ── Trending music ───────────────────────────────────────────────────────────

/** One track as the Studio shows it, the same shape for TikTok and Instagram. */
export type MusicTrack = {
  id: string; title: string; artist: string | null; durationMs: number | null; previewUrl: string | null;
  explicit: boolean; platform: 'tiktok' | 'instagram'; artwork: string | null; genres: string[]; rank: number | null;
};

const int = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : fallback;
};

/** Neither catalog has an explicit flag today; a flag Zernio adds later, or "explicit" in the title, still counts. */
export const isExplicit = (t: any) => t?.explicit === true || t?.isExplicit === true || /\bexplicit\b/i.test(String(t?.title || t?.name || ''));

/**
 * The Studio's TikTok track choice {id, volume, start?, end?, originalVolume} as tiktokSettings
 * fields (Zernio docs, TikTok "Locations & music"): musicSoundInfo.musicSoundId always; the track
 * volume, trim points and the video's own sound volume only on video posts (TikTok ignores them on
 * photos). Nothing usable → null, and the post is sent exactly as before.
 */
export function tiktokMusicSettings(m: unknown, video: boolean): Record<string, unknown> | null {
  if (!m || typeof m !== 'object') return null;
  const c = m as Record<string, unknown>;
  const id = String(c.id ?? '').trim();
  if (!/^[\w-]{1,64}$/.test(id)) return null;
  if (!video) return { musicSoundInfo: { musicSoundId: id } };
  const info: Record<string, unknown> = { musicSoundId: id, musicSoundVolume: int(c.volume, 0, 100, 50) };
  const start = c.start == null ? 0 : int(c.start, 0, 600_000, 0);
  const end = c.end == null ? 0 : int(c.end, 0, 600_000, 0);
  if (start > 0) info.musicSoundStart = start;
  if (end > start) info.musicSoundEnd = end;
  // Left out, TikTok mutes the video's own sound under the track (its API default is 0).
  return { musicSoundInfo: info, videoOriginalSoundVolume: int(c.originalVolume, 0, 100, 0) };
}

/** Which TikTok lane an account is on ('business' | 'developer'), from GET /accounts/{id}/health; null when unknown. */
export async function tiktokLane(acct: ZAccount): Promise<string | null> {
  const h = await zcall(acct.workspace, `/accounts/${encodeURIComponent(acct.id)}/health`).catch(() => null);
  const lane = h?.integrationLane;
  return lane === 'business' || lane === 'developer' ? lane : null;
}

/**
 * TikTok's 100 trending Commercial Music Library tracks for an account
 * (GET /accounts/{id}/tiktok/commercial-music, TikTok for Business app connections only). The list
 * has no search, so `q` filters it here by title, artist and genre. The id is the track's clip id
 * (what Zernio says to send as musicSoundId), else the full-track id; never the commercial music id.
 * A failure is not thrown: it comes back as a `note` with no tracks, so posts go out with their own sound.
 */
export async function tiktokTrending(acct: ZAccount, q = ''): Promise<{ tracks: MusicTrack[]; note?: string }> {
  try {
    const out = await zcall(acct.workspace, `/accounts/${encodeURIComponent(acct.id)}/tiktok/commercial-music`);
    let tracks: MusicTrack[] = (Array.isArray(out?.tracks) ? out.tracks : []).map((t: any): MusicTrack | null => {
      const id = String(t?.clip?.id || t?.id || '');
      if (!id) return null;
      const sec = Number(t?.clip?.id ? (t.clip.durationSec ?? t.durationSec) : t.durationSec);
      return {
        id, title: String(t.name || t.title || 'Untitled'), artist: t.artist ? String(t.artist) : null,
        durationMs: Number.isFinite(sec) && sec > 0 ? sec * 1000 : null,
        previewUrl: t?.clip?.previewUrl || t.previewUrl || null, explicit: isExplicit(t), platform: 'tiktok',
        artwork: t.thumbnailUrl || null, genres: Array.isArray(t.genres) ? t.genres.map(String) : [],
        rank: Number.isFinite(Number(t.rank)) ? Number(t.rank) : null,
      };
    }).filter(Boolean) as MusicTrack[];
    tracks.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9));
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length) tracks = tracks.filter((t) => words.every((w) => `${t.title} ${t.artist || ''} ${t.genres.join(' ')}`.toLowerCase().includes(w)));
    if (!tracks.length && !words.length) return { tracks, note: 'TikTok has no trending commercial tracks for this account right now, so posts go out with our own music.' };
    return { tracks };
  } catch (e) {
    const lane = await tiktokLane(acct);
    if (lane === 'developer') {
      return { tracks: [], note: `Trending TikTok music needs @${acct.username} connected through the TikTok for Business app (it is on TikTok’s older developer app). Reconnect it in Zernio to use trending tracks. Until then posts go out with our own music.` };
    }
    const said = e instanceof ZernioError ? String(e.body?.error || e.body?.message || e.status || '') : (e as Error).message;
    return { tracks: [], note: `Trending TikTok music couldn’t be loaded just now${said ? ` (${said})` : ''}, so posts go out with our own music. TikTok only offers it to accounts connected through the TikTok for Business app.` };
  }
}
