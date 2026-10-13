// Where the Design studio keeps things: designs in `studio_designs` and the team's own music in
// `studio_tracks` (files in the private 'studio' bucket under shared/music/), both from v44.
// Until v44 runs, designs are kept in this browser instead, and uploaded music lasts the session.
import { supabase } from '../../lib/supabase';

const LOCAL = 'p31-designs';
const missing = (e) => /does not exist|schema cache|relation|not found/i.test(e?.message || '');
const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL) || '[]'); } catch { return []; } };
const writeLocal = (rows) => { try { localStorage.setItem(LOCAL, JSON.stringify(rows.slice(0, 60))); return true; } catch { return false; } };

/** { rows, shared } — shared is false when the table isn't there yet (browser-only designs). */
export async function listDesigns() {
  const { data, error } = await supabase.from('studio_designs').select('id, title, doc, thumb, updated_at').order('updated_at', { ascending: false }).limit(200);
  if (error) {
    if (missing(error)) return { rows: readLocal(), shared: false };
    throw new Error(error.message);
  }
  return { rows: data || [], shared: true };
}

export async function saveDesign({ id, title, doc, thumb }, shared) {
  const row = { title: String(title || 'Untitled design').slice(0, 120), doc, thumb, updated_at: new Date().toISOString() };
  if (shared) {
    const q = id ? supabase.from('studio_designs').update(row).eq('id', id) : supabase.from('studio_designs').insert(row);
    const { data, error } = await q.select('id, title, doc, thumb, updated_at').maybeSingle();
    if (error && missing(error)) return saveDesign({ id: null, title, doc, thumb }, false);
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Not saved: this login may not have the Content creator dashboard.');
    return data;
  }
  const rows = readLocal();
  const saved = { ...row, id: id || `local-${Date.now().toString(36)}`, local: true };
  const next = [saved, ...rows.filter((r) => r.id !== saved.id)];
  if (!writeLocal(next)) throw new Error('This browser is out of room for designs. Delete a few, or ask an admin to run v44.');
  return saved;
}

export async function deleteDesign(id, shared) {
  if (shared && !String(id).startsWith('local-')) {
    const { error, count } = await supabase.from('studio_designs').delete({ count: 'exact' }).eq('id', id);
    if (error) throw new Error(error.message);
    if (!count) throw new Error('Nothing was deleted: this login may not have the Content creator dashboard.');
    return;
  }
  writeLocal(readLocal().filter((r) => r.id !== id));
}

// ── The team's music ───────────────────────────────────────────────────────
export async function listTracks() {
  const { data, error } = await supabase.from('studio_tracks').select('id, title, path, seconds, created_at').order('created_at', { ascending: false }).limit(100);
  if (error) return { rows: [], shared: !missing(error) ? null : false };
  return { rows: data || [], shared: true };
}

export async function uploadTrack(file, seconds) {
  const slug = file.name.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]+/g, '-').slice(0, 50) || 'track';
  const ext = (file.name.match(/\.[a-z0-9]+$/i) || ['.mp3'])[0].toLowerCase();
  const path = `shared/music/${Date.now().toString(36)}-${slug}${ext}`;
  const { error } = await supabase.storage.from('studio').upload(path, file, { contentType: file.type || 'audio/mpeg' });
  if (error) throw new Error(error.message);
  const { data, error: err } = await supabase.from('studio_tracks').insert({ title: file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 120), path, seconds: Math.round(seconds || 0) }).select('id, title, path, seconds, created_at').maybeSingle();
  if (err) { await supabase.storage.from('studio').remove([path]); throw new Error(err.message); }
  return data;
}

export async function trackBlob(path) {
  const { data, error } = await supabase.storage.from('studio').download(path);
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTrack(row) {
  const { error, count } = await supabase.from('studio_tracks').delete({ count: 'exact' }).eq('id', row.id);
  if (error) throw new Error(error.message);
  if (!count) throw new Error('Nothing was deleted: this login may not have the Content creator dashboard.');
  await supabase.storage.from('studio').remove([row.path]);
}
