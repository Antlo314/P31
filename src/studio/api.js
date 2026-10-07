import { supabase } from '../lib/supabase';

/** Call the studio-zernio edge function. Throws with a friendly message. */
export async function studio(action, params = {}) {
  const { data, error } = await supabase.functions.invoke('studio-zernio', { body: { action, ...params } });
  if (error) {
    let msg = 'The Content Studio couldn’t reach Zernio. Deploy the studio-zernio function and try again.';
    try { const ctx = await error.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Upload a file or blob to Zernio's media storage; returns its public URL. */
export async function uploadMedia(file, name = file.name || 'upload') {
  const { uploadUrl, publicUrl } = await studio('presign', { filename: name, contentType: file.type, size: file.size });
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!put.ok) throw new Error('Upload failed — please try again.');
  return publicUrl;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Zernio best-time slots (UTC day/hour) → Eastern-time labels, best first. */
export function bestSlotsET(slots = [], limit = 6) {
  return slots.slice(0, limit).map((s) => {
    const utc = new Date(Date.UTC(2026, 9, 4 + s.day_of_week, s.hour)); // Oct 4 2026 is a Sunday
    const et = new Date(utc.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    return { day: et.getDay(), hour: et.getHours(), label: `${DAYS[et.getDay()]} ${et.toLocaleTimeString('en-US', { hour: 'numeric' })}`, score: s.avg_engagement, posts: s.post_count };
  });
}

/** Next calendar date/time (local "YYYY-MM-DDTHH:mm") for a weekday + hour in Eastern time. */
export function nextOccurrence(day, hour) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  let add = (day - now.getDay() + 7) % 7;
  if (add === 0 && d <= now) add = 7;
  d.setDate(d.getDate() + add);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:00`;
}

export const fmtET = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
