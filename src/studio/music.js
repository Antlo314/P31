// Trending music for the Studio: studio-zernio `music` (TikTok's trending Commercial Music Library,
// or Instagram's catalog audio), read once per page session and shared by every screen that asks.
// The picking rules are in ./musicPick.js.
import { studio } from './api';

export { MOOD, rankMusic, autoPick, spreadPicks, trackName } from './musicPick';

const cache = new Map();

/**
 * {platform, trending, tracks, note?} for 'tiktok' or 'instagram' (an account, or the Marketplace's),
 * trending when `q` is empty. Kept for the page session; `fresh` reads again. `load` replaces the
 * studio-zernio call (the autopilot review page asks content-autopilot instead) and `scope` keeps its
 * answers apart. Never rejects: a failure comes back as a note with no tracks.
 */
export function trendingMusic(platform, { accountId = '', q = '', fresh = false, load, scope = 'studio' } = {}) {
  const query = String(q || '').trim();
  const key = [scope, platform, accountId || '', query.toLowerCase()].join('|');
  if (!fresh && cache.has(key)) return cache.get(key);
  const ask = load || ((params) => studio('music', params));
  const p = Promise.resolve()
    .then(() => ask({ platform, ...(accountId ? { accountId } : {}), ...(query ? { q: query } : {}) }))
    .then((out) => ({ platform, trending: !query, tracks: Array.isArray(out?.tracks) ? out.tracks : [], ...(out?.note ? { note: out.note } : {}) }))
    .catch((err) => {
      cache.delete(key); // a failed read is tried again next time
      return { platform, trending: !query, tracks: [], note: `Trending music couldn’t be loaded: ${err?.message || 'try again in a minute'}.` };
    });
  cache.set(key, p);
  return p;
}

/** Default loudness for a trending track: the track, and the video's own sound under it (0 to 100). */
export const MUSIC_DEFAULTS = { volume: 80, originalVolume: 0 };

/** The studio-zernio tiktokMusic field for a choice ({track, volume, originalVolume, start?, end?}), or undefined. */
export const tiktokMusicField = (choice) => (choice?.track?.id
  ? {
    id: choice.track.id,
    volume: choice.volume ?? MUSIC_DEFAULTS.volume,
    originalVolume: choice.originalVolume ?? MUSIC_DEFAULTS.originalVolume,
    ...(choice.start != null ? { start: choice.start } : {}),
    ...(choice.end != null ? { end: choice.end } : {}),
  }
  : undefined);
