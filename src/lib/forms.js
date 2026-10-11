// Shared plumbing for the public forms on p31market.com (storefront agreement, market
// registration, feedback survey, volunteer acknowledgment): one RPC, one notifier,
// the "you already sent this" marker, and the signed-in prefill.
import { supabase } from './supabase';

const DAYS = 30;

/** The confirmation shown for 30 days on the device that submitted. */
export const readSent = (key) => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v && Date.now() - v.at < DAYS * 864e5 ? v : null;
  } catch { return null; }
};
export const markSent = (key, data = {}) => { try { localStorage.setItem(key, JSON.stringify({ ...data, at: Date.now() })); } catch { /* private mode */ } };
export const clearSent = (key) => { try { localStorage.removeItem(key); } catch { /* private mode */ } };

export const todayLong = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
export const todayISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** "(000) 000-0000" as the person types. */
export const formatPhone = (v) => {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  const n = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (n.length < 4) return n;
  if (n.length < 7) return `(${n.slice(0, 3)}) ${n.slice(3)}`;
  return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6, 10)}`;
};

// Messages the database writes for the person (anything else gets a generic line).
const FRIENDLY = /^(Please|Which market|We are getting|The signature|Unknown form)/;

/** Send a form: the database checks it, keeps it and adds the person to the CRM; join-notify emails the team. */
export async function submitForm(kind, answers) {
  const { data, error } = await supabase.rpc('submit_form', { p_kind: kind, p: answers });
  if (error) {
    throw new Error(FRIENDLY.test(error.message) ? error.message : 'We couldn’t send your form just now. Please try again in a moment.');
  }
  supabase.functions.invoke('join-notify', { body: {} }).catch(() => {});
  return data;
}

const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

/** Upload a business logo for a market registration; returns its public URL. */
export async function uploadLogo(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Please upload your logo as a PNG, JPG or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('That file is over 5 MB. Please upload a smaller logo.');
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `registrations/${uid()}.${ext}`;
  const { error } = await supabase.storage.from('vendor-logos').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error('The logo couldn’t be uploaded. Try a PNG or JPG under 5 MB.');
  return supabase.storage.from('vendor-logos').getPublicUrl(path).data.publicUrl;
}

/** The signed-in person (a curator, usually), to prefill name, email and business. */
export async function signedInContact() {
  try {
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    if (!u) return null;
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', u.id).maybeSingle(),
      supabase.from('curator_data').select('business_name, agreement_signed_at').eq('id', u.id).maybeSingle(),
    ]);
    const name = (p?.full_name || u.user_metadata?.full_name || '').trim();
    const [first, ...rest] = name.split(/\s+/);
    return { email: u.email || '', first_name: first || '', last_name: rest.join(' '), business_name: c?.business_name || '', curator: !!c, agreement_signed_at: c?.agreement_signed_at || null };
  } catch { return null; }
}

/** Markets to pick from: upcoming (for registrations and volunteers) or recent (for feedback). */
export async function marketChoices(which = 'upcoming', limit = 6) {
  if (!supabase) return [];
  const today = todayISO();
  let q = supabase.from('market_events').select('id, title, event_date, venue, date_public, month_public').eq('is_active', true);
  q = which === 'upcoming' ? q.gte('event_date', today).order('event_date', { ascending: true }) : q.lte('event_date', today).order('event_date', { ascending: false });
  const { data } = await q.limit(limit);
  return (data || []).map((e) => ({ ...e, label: eventLabel(e) }));
}

/** "Winter Gala · December 2026" (the month and year, which is what the forms asked for). */
export const eventLabel = (e) => {
  const [y, m] = String(e.event_date || '').split('-').map(Number);
  const when = y && m ? new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
  return when ? `${e.title} · ${when}` : e.title;
};
