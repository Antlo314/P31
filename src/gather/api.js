// The Gathering: talking to the database (chat_* functions from storefront_v39_gathering.sql),
// and the photo / video plumbing (private "chat" bucket, signed links, resizing before upload).
import { supabase } from '../lib/supabase';

export const REACTIONS = ['🙏🏾', '❤️', '🙌🏾', '🔥', '😂', '👏🏾', '✨', '💜', '😭', '💯'];
export const PAGE = 60;

const friendly = (error, fallback) => {
  const m = error?.message || '';
  return /^(Sign in|You |Only |Up to|That |Write|Messages|Slow|Pick|The Gathering)/.test(m) ? m : fallback;
};
const call = async (fn, args, fallback = 'Something went wrong. Please try again.') => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(friendly(error, fallback));
  return data;
};

export const getMe = () => call('chat_me');
export const getChannels = async () => (await call('chat_my_channels')) || [];
export const getPeople = async (ids) => {
  const { data, error } = await supabase.rpc('chat_people', ids ? { p_ids: ids } : {});
  if (error) return [];
  return data || [];
};
export const post = (channel, body, attachments = [], replyTo = null, thread = null) =>
  call('chat_post', { p_channel: channel, p_body: body, p_attachments: attachments, p_reply_to: replyTo, p_thread: thread }, 'Your message did not send. Please try again.');
export const edit = (id, body) => call('chat_edit', { p_id: id, p_body: body });
export const remove = (id) => call('chat_delete', { p_id: id });
export const pin = (id, on) => call('chat_pin', { p_id: id, p_on: on });
export const react = (id, emoji) => call('chat_react', { p_id: id, p_emoji: emoji });
export const markRead = (channel) => supabase.rpc('chat_mark_read', { p_channel: channel }).then(() => {}, () => {});
export const openDm = (userId) => call('chat_open_dm', { p_user: userId });
export const setTitle = (userId, title) => call('chat_set_title', { p_user: userId, p_title: title });
export const setPrefs = (dmEmail) => call('chat_set_prefs', { p_dm_email: dmEmail });

// ── Notifications on this device (while The Gathering is open in a tab) ──
const DEVICE_KEY = 'p31_gather_notify';
export const deviceNotify = () => { try { return localStorage.getItem(DEVICE_KEY) === 'on' && typeof Notification !== 'undefined' && Notification.permission === 'granted'; } catch { return false; } };
export async function setDeviceNotify(on) {
  if (typeof Notification === 'undefined') throw new Error('This browser cannot show notifications.');
  if (on && Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') throw new Error('Notifications are blocked for this site in your browser settings.');
  }
  try { localStorage.setItem(DEVICE_KEY, on ? 'on' : 'off'); } catch { /* private mode */ }
  return on && Notification.permission === 'granted';
}
export function showDeviceNotification(title, body, onClick) {
  if (!deviceNotify()) return;
  try {
    const n = new Notification(title, { body, icon: '/icons/icon-192.png', tag: `gather-${title}` });
    n.onclick = () => { window.focus(); onClick?.(); n.close(); };
  } catch { /* some browsers only allow notifications from a service worker */ }
}

/** The newest top-level messages in a channel (or older than `before`), oldest first. */
export async function getMessages(channelId, before) {
  let q = supabase.from('chat_messages').select('*').eq('channel_id', channelId).is('thread_root', null)
    .order('created_at', { ascending: false }).limit(PAGE);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) throw new Error('These messages could not load. Pull to refresh or try again.');
  return (data || []).reverse();
}
export async function getThread(rootId) {
  const { data } = await supabase.from('chat_messages').select('*').eq('thread_root', rootId).order('created_at', { ascending: true }).limit(500);
  return data || [];
}
/** Messages whose words match, newest first. Row security keeps it to the reader's own rooms and DMs. */
export async function search(text, limit = 40) {
  const q = text.replace(/[%_\\*,()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.from('chat_messages').select('*').ilike('body', `%${q}%`).is('deleted_at', null)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error('Search is not available right now. Please try again.');
  return data || [];
}
export async function getMessage(id) {
  const { data } = await supabase.from('chat_messages').select('*').eq('id', id).maybeSingle();
  return data;
}

// ── Media ────────────────────────────────────────────────
const MAX_VIDEO = 50 * 1024 * 1024;
const MAX_IMAGE_SIDE = 2048;
const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

/** Large photos are resized in the browser (2048 px, JPEG) so they upload fast and look sharp. */
async function shrink(file) {
  if (file.type === 'image/gif' || !/^image\//.test(file.type)) return { blob: file, width: null, height: null };
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && /jpeg|webp|png/.test(file.type)) return { blob: file, width: bmp.width, height: bmp.height };
    const w = Math.round(bmp.width * scale); const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
    return { blob: blob || file, width: w, height: h, type: 'image/jpeg' };
  } catch {
    return { blob: file, width: null, height: null }; // HEIC on browsers that cannot read it: upload is refused below
  }
}

/** Upload one photo or video; returns the attachment record chat_post expects. */
export async function upload(file, userId) {
  const video = /^video\//.test(file.type);
  if (!video && !/^image\/(jpeg|png|webp|gif|heic|heif)$/.test(file.type)) throw new Error(`${file.name}: photos (JPG, PNG, WebP, GIF) and videos (MP4, MOV) only.`);
  if (video && !/^video\/(mp4|quicktime|webm)$/.test(file.type)) throw new Error(`${file.name}: videos need to be MP4 or MOV.`);
  if (video && file.size > MAX_VIDEO) throw new Error(`${file.name} is over 50 MB. Trim it or send a shorter clip.`);
  const { blob, width, height, type } = video ? { blob: file } : await shrink(file);
  const contentType = type || file.type;
  if (/heic|heif/.test(contentType)) throw new Error(`${file.name}: this browser cannot read HEIC photos. Share it as a JPG.`);
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' }[contentType] || 'bin';
  const path = `${userId}/${uid()}.${ext}`;
  const { error } = await supabase.storage.from('chat').upload(path, blob, { contentType, upsert: false });
  if (error) throw new Error(`${file.name} did not upload. Please try again.`);
  return { type: video ? 'video' : 'image', path, name: file.name.slice(0, 120), width, height, size: blob.size };
}

// Signed links last an hour; they are cached and refreshed in batches.
const signed = new Map();
export async function signPaths(paths) {
  const now = Date.now();
  const need = [...new Set(paths)].filter((p) => !signed.has(p) || signed.get(p).exp < now + 5 * 60e3);
  if (need.length) {
    const { data } = await supabase.storage.from('chat').createSignedUrls(need, 3600);
    (data || []).forEach((d) => { if (d.signedUrl) signed.set(d.path, { url: d.signedUrl, exp: now + 3600e3 }); });
  }
  return Object.fromEntries(paths.map((p) => [p, signed.get(p)?.url]).filter(([, u]) => u));
}

// ── Time ────────────────────────────────────────────────
export const etToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const timeOf = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const dayOf = (iso) => {
  const d = new Date(iso); const today = new Date(); const y = new Date(Date.now() - 864e5);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
};
export const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};
