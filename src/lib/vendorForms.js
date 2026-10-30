import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { EMAIL } from './team';

/*
 * Helpers for the vendor (curator) forms: keep what she typed, make phone photos upload,
 * and turn database errors into plain words.
 */

// ── Drafts: an unsaved copy kept in this browser ─────────────
// A reload, a phone switching to the Photos app (which can reload the page), a lost connection
// or a closed tab never wipes what she typed. Cleared once the form is sent or saved.
export const readDraft = (key) => {
  if (!key) return null;
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
};
export const writeDraft = (key, value) => {
  if (!key) return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: the form still works */ }
};
export const clearDraft = (key) => {
  if (!key) return;
  try { localStorage.removeItem(key); } catch { /* storage blocked */ }
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const strip = (v, skip) => {
  if (!skip?.length || !v || typeof v !== 'object') return v;
  const out = { ...v };
  skip.forEach((k) => { delete out[k]; });
  return out;
};

/**
 * useState for a form object that survives reloads. `blank` is the empty form; fields in `skip`
 * (a spam trap, a signature image) are never stored. Returns [value, setValue, discard, restored].
 */
export function useDraftState(key, blank, { skip = [] } = {}) {
  const [restored] = useState(() => {
    const d = readDraft(key);
    return d && typeof d === 'object' && !Array.isArray(d) ? d : null;
  });
  const [value, setValue] = useState(() => (restored ? { ...blank, ...restored } : blank));
  const blankRef = useRef(blank);
  useEffect(() => {
    if (!key) return;
    if (same(strip(value, skip), strip(blankRef.current, skip))) clearDraft(key);
    else writeDraft(key, strip(value, skip));
  }, [key, value]); // eslint-disable-line react-hooks/exhaustive-deps
  const discard = (next = blankRef.current) => { clearDraft(key); setValue(next); };
  return [value, setValue, discard, !!restored];
}

/** Asks "Leave this page?" before the tab is closed or reloaded while something is unsaved. */
export function useLeaveWarning(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}

// ── Plain-words errors ───────────────────────────────────────
export function friendlyError(err, fallback = 'That did not save.') {
  const m = String(err?.message || err || '');
  if (/curator_data_slug_key|duplicate key.*slug|slug.*already exists|already uses that link/i.test(m)) {
    return 'That shop link is already taken by another shop. Try adding your city or a word, for example luxe-candles-atl.';
  }
  if (/slug_not_reserved/i.test(m)) return 'That shop link is used by a P31 page. Please pick a different one.';
  if (/Your shop can show \d+ products/i.test(m)) return m;
  if (/row-level security|permission denied|42501|not allowed/i.test(m)) {
    return `Your account is not allowed to save this. Sign out and back in; if it keeps happening, email ${EMAIL.vendors}.`;
  }
  if (/JWT|token.*expired|not authenticated|Auth session missing/i.test(m)) {
    return 'You were signed out. Sign in again; what you typed is kept on this device.';
  }
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) {
    return 'No internet connection right now. Check your signal and try again; what you typed is kept on this device.';
  }
  if (/bucket not found/i.test(m)) return `Photo storage is not set up yet. Please email ${EMAIL.vendors}.`;
  if (/mime type|not supported|invalid_mime/i.test(m)) return 'That kind of file cannot be used. Please pick a JPG or PNG photo.';
  if (/maximum allowed size|too large|Payload too large|413/i.test(m)) return 'That photo is too large. Please pick a smaller one.';
  if (/User already registered|already been registered/i.test(m)) return 'An account with this email already exists. Choose Sign in instead (or reset your password).';
  if (/Password should be at least/i.test(m)) return 'Please choose a password with at least 8 characters.';
  if (/Invalid login credentials/i.test(m)) return 'That email and password do not match. Check them and try again.';
  if (/Email not confirmed/i.test(m)) return 'Please confirm your email first: open the message we sent you and tap the link, then sign in.';
  return m ? `${fallback} (${m})` : fallback;
}

// ── Shop links ───────────────────────────────────────────────
export const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// ── Photos from phones ───────────────────────────────────────
const MB = 1024 * 1024;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const HEIC_HELP = 'This photo is in the iPhone HEIC format, which this browser cannot open. Open the photo on your phone and take a screenshot of it, then upload the screenshot. (Or on iPhone: Settings > Camera > Formats > Most Compatible.)';

const decode = async (file) => {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* try the img tag */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode'));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
};

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Makes any phone photo safe to upload: opens it (including HEIC where the browser can), turns it
 * upright, shrinks it to `maxSide` pixels and saves it as a JPG under about 4 MB. PNG logos keep
 * their see-through background when `keepPng` is set. Throws a plain-words Error otherwise.
 */
export async function prepareImage(file, { maxSide = 2000, quality = 0.85, keepPng = false } = {}) {
  if (!file) throw new Error('No photo was picked.');
  const name = String(file.name || 'photo').toLowerCase();
  const heic = /image\/hei[cf]/i.test(file.type || '') || /\.(heic|heif)$/.test(name);
  const looksImage = (file.type || '').startsWith('image/') || heic || /\.(jpe?g|png|webp|gif)$/.test(name);
  if (!looksImage) throw new Error('That file is not a photo. Please pick a JPG or PNG picture.');
  if (file.size > 50 * MB) throw new Error('That file is very large (over 50 MB). Please pick a smaller photo.');
  // Small GIFs stay as they are (they may move).
  if (file.type === 'image/gif' && file.size <= 4 * MB) return file;

  let pic;
  try { pic = await decode(file); } catch {
    throw new Error(heic ? HEIC_HELP : 'This photo could not be opened. Please try another one, or take a screenshot of it and upload that.');
  }
  const w = pic.width || pic.naturalWidth;
  const h = pic.height || pic.naturalHeight;
  if (!w || !h) throw new Error('This photo could not be opened. Please try another one.');
  const already = OK_TYPES.includes(file.type) && file.size <= 1.5 * MB && Math.max(w, h) <= maxSide;
  if (already) { pic.close?.(); return file; }

  const png = keepPng && file.type === 'image/png';
  const type = png ? 'image/png' : 'image/jpeg';
  let side = maxSide;
  let q = quality;
  for (let tries = 0; tries < 4; tries += 1) {
    const scale = Math.min(1, side / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d');
    if (!png) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(pic, 0, 0, canvas.width, canvas.height);
    const blob = await toBlob(canvas, type, png ? undefined : q);
    if (blob && blob.size <= 4.5 * MB) {
      pic.close?.();
      const base = name.replace(/\.[a-z0-9]+$/, '') || 'photo';
      return new File([blob], `${base}.${png ? 'png' : 'jpg'}`, { type });
    }
    side = Math.round(side * 0.75);
    q = Math.max(0.6, q - 0.1);
  }
  pic.close?.();
  throw new Error('That photo is too large to use. Please pick a smaller one.');
}

/**
 * Uploads a shop photo (product, banner, logo) to the public "products" bucket and returns its
 * link. That bucket is the one shop photos can be written to (there is no banners or logos bucket).
 */
export async function uploadShopImage(userId, file, kind = 'product', opts = {}) {
  const ready = await prepareImage(file, opts);
  const ext = ready.type === 'image/png' ? 'png' : ready.type === 'image/gif' ? 'gif' : ready.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}-${kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`;
  const { error } = await supabase.storage.from('products').upload(path, ready, { cacheControl: '3600', upsert: false, contentType: ready.type });
  if (error) throw new Error(friendlyError(error, 'The photo did not upload.'));
  return supabase.storage.from('products').getPublicUrl(path).data.publicUrl;
}
