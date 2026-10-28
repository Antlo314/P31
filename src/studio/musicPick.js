// Choosing trending music for a post, with no network: the rules behind the Studio's auto-pick.
// Tracks are studio-zernio `music` tracks: {id, title, artist, durationMs, previewUrl, explicit,
// platform, genres?, rank?}, best-trending first. Shared by Post plans, the composer and the
// autopilot review page (through ./music.js), and tested by scripts/test-music-pick.mjs.

/** Moods that suit P31 (faith, encouragement, women in business): preferred when a track names one. */
export const MOOD = /uplift|inspir|gospel|worship|praise|christian|acoustic|r&b|\brnb\b|rhythm and blues|\bsoul/i;

const fits = (t, seconds) => !seconds || (t.durationMs != null && t.durationMs >= seconds * 1000);
const moody = (t) => MOOD.test(`${t.title || ''} ${(t.genres || []).join(' ')}`);

/**
 * The tracks in the order the auto-pick prefers them: never explicit; long enough for the video when
 * its length is known (all of them when none is); the P31 moods first; otherwise trending order.
 */
export function rankMusic(list, { seconds } = {}) {
  const clean = (Array.isArray(list) ? list : []).filter((t) => t && t.id && !t.explicit);
  const long = clean.filter((t) => fits(t, seconds));
  const pool = long.length ? long : clean;
  return [...pool.filter(moody), ...pool.filter((t) => !moody(t))];
}

/**
 * The track the Studio suggests for one post: the top trending track that is not explicit, is at
 * least as long as the video when its length is known (else the top non-explicit one), preferring
 * uplifting, inspirational, gospel, worship, acoustic, R&B and soul titles or genres. `avoid` (ids)
 * steers away from tracks used nearby; when every track is avoided it is ignored. null: no track.
 */
export function autoPick(list, { seconds, avoid = [] } = {}) {
  const ranked = rankMusic(list, { seconds });
  const skip = new Set(avoid);
  return ranked.find((t) => !skip.has(t.id)) || ranked[0] || null;
}

/**
 * A track for each post in order, spread out: each post takes its best track not used yet, and when
 * every track has been used, the least-used one that is not the previous post's (never the same
 * track twice in a row while there is another). `fixed` (post id → track id, or null for "our own
 * music") holds the team's own choices: they count as used and as the previous track, and are not
 * changed. Returns post id → track (or null).
 */
export function spreadPicks(list, posts, { fixed = {} } = {}) {
  const out = {};
  const used = new Map();
  for (const id of Object.values(fixed)) if (id) used.set(id, (used.get(id) || 0) + 1);
  const byId = new Map((Array.isArray(list) ? list : []).map((t) => [t.id, t]));
  let prev = null;
  for (const p of posts) {
    if (Object.prototype.hasOwnProperty.call(fixed, p.id)) {
      prev = fixed[p.id] || null;
      out[p.id] = prev ? byId.get(prev) || null : null;
      continue;
    }
    const ranked = rankMusic(list, { seconds: p.seconds });
    const fresh = ranked.find((t) => !used.has(t.id));
    const pick = fresh || [...ranked].filter((t) => t.id !== prev).sort((a, b) => (used.get(a.id) || 0) - (used.get(b.id) || 0))[0] || ranked[0] || null;
    if (pick) used.set(pick.id, (used.get(pick.id) || 0) + 1);
    out[p.id] = pick;
    prev = pick?.id || null;
  }
  return out;
}

/** "Title - Artist" for a track line. */
export const trackName = (t) => (t ? `${t.title || 'Untitled'}${t.artist ? ` - ${t.artist}` : ''}` : '');
