import { useSyncExternalStore } from 'react';
import { supabase } from './supabase';
import { TEAM } from './team';
import { HEADSHOTS, PORTRAIT_BY_KEY } from './teamPhotos';
import { SITE } from './site';

// The public team directory (v64). Admins edit it in Systems > Team directory (team_directory
// table + the public team-photos bucket). Until that table exists or has rows, the list in
// src/lib/team.js is the directory, so pages render at once with the code data and only change
// if an admin has changed something. The last list read is kept in this browser, so on later
// visits the first paint already matches the database.
//
// Each person: { id, name, role, focus[], blurb, emails[], site, icon, photo, portrait, sort_order }
//   photo     the round headshot: the uploaded photo, else the bundled one for that name
//   portrait  the tall picture for the gallery: the uploaded photo, else the bundled one

export const TEAM_PHOTO_BUCKET = 'team-photos';
const CACHE_KEY = 'p31_team_directory';

/** Public URL of a file in the team-photos bucket. */
export const teamPhotoUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  return base ? `${base}/storage/v1/object/public/${TEAM_PHOTO_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}` : null;
};

const codeByName = Object.fromEntries(TEAM.map((p) => [p.name, p]));
const splitBlurb = (b) => String(b || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);

/** The team as it is in the site code (src/lib/team.js). */
export const FALLBACK_TEAM = TEAM.map((p, i) => ({
  id: `code-${i}`,
  name: p.name,
  role: p.role,
  focus: p.focus,
  blurb: p.focus.join('\n'),
  emails: p.emails,
  site: 'both',
  icon: p.icon,
  photo: (p.photo && HEADSHOTS[p.photo]) || null,
  portrait: (p.photo && PORTRAIT_BY_KEY[p.photo]) || null,
  sort_order: (i + 1) * 10,
}));

/** A team_directory row in the shape the pages use. */
export const fromRow = (r) => {
  const code = codeByName[r.name];
  const uploaded = teamPhotoUrl(r.photo_path);
  return {
    id: r.id,
    name: r.name,
    role: r.role || '',
    focus: splitBlurb(r.blurb),
    blurb: r.blurb || '',
    emails: r.emails || [],
    site: r.site || 'both',
    icon: code?.icon || 'people',
    photo: uploaded || (code?.photo && HEADSHOTS[code.photo]) || null,
    portrait: uploaded || (code?.photo && PORTRAIT_BY_KEY[code.photo]) || null,
    sort_order: r.sort_order ?? 100,
  };
};

// ── A tiny shared store: every component reads the same list, fetched once per page load. ──
const readCache = () => {
  try {
    const rows = JSON.parse(localStorage.getItem(CACHE_KEY));
    return Array.isArray(rows) && rows.length ? rows.map(fromRow) : null;
  } catch { return null; }
};
let current = (typeof window !== 'undefined' && readCache()) || FALLBACK_TEAM;
let fetched = false;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

/** Read the directory from the database again (after an admin change, or on first use). */
export const refreshTeamDirectory = async () => {
  fetched = true;
  if (!supabase) return;
  try {
    const { data, error } = await supabase.from('team_directory')
      .select('id, sort_order, name, role, blurb, emails, site, photo_path')
      .eq('is_visible', true).order('sort_order').order('name');
    // Table missing (v64 not run) or empty: the code list stays the directory.
    const rows = !error && Array.isArray(data) && data.length ? data : null;
    try { if (rows) localStorage.setItem(CACHE_KEY, JSON.stringify(rows)); else localStorage.removeItem(CACHE_KEY); } catch { /* private mode */ }
    current = rows ? rows.map(fromRow) : FALLBACK_TEAM;
    emit();
  } catch { /* offline: keep what is shown */ }
};

const subscribe = (fn) => {
  listeners.add(fn);
  if (!fetched) refreshTeamDirectory();
  return () => listeners.delete(fn);
};
const snapshot = () => current;
const serverSnapshot = () => FALLBACK_TEAM;

/** Everyone in the directory. Pass a site ('market' | 'collective') to keep only the people shown there. */
export const useTeamDirectory = (site) => {
  const list = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return site ? list.filter((p) => p.site === 'both' || p.site === site) : list;
};

/** The directory for the site this page is on. */
export const useSiteTeam = () => useTeamDirectory(SITE);

/** Headshot by name (uploaded first, then the bundled one); for avatars around the app. */
const photoMaps = new WeakMap();
export const useTeamPhotoByName = () => {
  const list = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (!photoMaps.has(list)) photoMaps.set(list, Object.fromEntries(list.filter((p) => p.photo).map((p) => [p.name, p.photo])));
  return photoMaps.get(list);
};
