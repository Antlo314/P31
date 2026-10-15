// Starting points for the Design studio. Each template is a function of its words and a colour
// style, so any design can be re-coloured (Styles), resized (Post / Square / Story) or turned
// into a whole batch. Layer roles (ink, accent, soft, bg) are how a restyle knows what to paint.
import { SIZES, STYLES, styleOf, HANDLES, LINKS } from './brand';
import { animLength, layout } from './draw';
import markPlum from '../../assets/design/mark-plum.webp';
import markGold from '../../assets/design/mark-gold.webp';
import markWhite from '../../assets/design/mark-white.webp';
import markMarket from '../../assets/design/mark-market.webp';
import markColor from '../../assets/design/mark-color.webp';

// The Marketplace has its own logo (the Rise & Build panels); the Collective keeps the hands.
// The Collective's hands are full colour on light designs and gold on dark ones.
export const MARKS = { market: markMarket, color: markColor, gold: markGold, white: markWhite, plum: markPlum };
const markFor = (s, brand = 'collective') => (brand === 'market' ? markMarket : s.dark ? markGold : markColor);

let n = 0;
export const newId = () => `l${Date.now().toString(36)}${(n += 1).toString(36)}`;

/** Paint every layer from a colour style (keeps the words, layout and pattern kind). */
export function restyle(doc, style) {
  const s = typeof style === 'string' ? styleOf(style) : style;
  return {
    ...doc,
    style: s.key,
    bg: { ...doc.bg, color: s.bg, color2: s.bg2 || null },
    pattern: { ...doc.pattern, color: s.line },
    layers: doc.layers.map((l) => {
      if (l.type === 'text') return l.role ? { ...l, color: s[l.role] || l.color, emColor: s[l.emRole || (l.role === 'accent' ? 'ink' : 'accent')], markColor: s.mark, ...(l.bgRole ? { bg: s[l.bgRole] } : {}) } : l;
      if (l.type === 'shape') return { ...l, ...(l.fillRole ? { fill: s[l.fillRole] } : {}), ...(l.strokeRole ? { stroke: s[l.strokeRole] } : {}) };
      if (l.type === 'image' && l.mark) return { ...l, src: markFor(s, l.mark === 'market' ? 'market' : 'collective') };
      return l;
    }),
  };
}

// On a 9:16 reel Instagram lays the account name over the top and the caption and buttons over
// the bottom, so things near those edges are kept inside this safe area.
const SAFE = { story: { top: 170, bottom: 260 } };
const safe = (size) => SAFE[size] || { top: 0, bottom: 0 };

let measureCtx = null;
/** Layer boxes measured on a scratch canvas (null where there is no DOM, e.g. in Node). */
function boxesOf(doc) {
  if (typeof document === 'undefined') return null;
  measureCtx = measureCtx || document.createElement('canvas').getContext('2d');
  try { return layout(measureCtx, doc); } catch { return null; }
}

/**
 * Move a design to another page size (Canva's "resize"). Everything scales with the width. The
 * main block (all but what sits along the bottom) is centred in the new page, inside a reel's
 * safe area; what sits along the bottom stays along the bottom, above Instagram's caption.
 */
export function resize(doc, size) {
  const from = SIZES[doc.size] || SIZES.post; const to = SIZES[size] || SIZES.post;
  if (from === to) return doc;
  const k = to.w / from.w; const fs0 = safe(doc.size); const ts = safe(size);
  const boxes = boxesOf(doc);
  const centre = (l) => (boxes?.[l.id] ? boxes[l.id].y + boxes[l.id].h / 2 : l.y + (l.type === 'text' && l.anchor === 'middle' ? 0 : (l.h ?? l.size ?? 0) / 2));
  const atBottom = (l) => centre(l) / from.h > 0.8;
  // The main block's middle, measured where possible.
  const main = doc.layers.filter((l) => !l.hidden && !atBottom(l) && !l.pin);
  let top = Infinity; let bottom = -Infinity;
  doc.layers.filter((l) => !l.hidden && !atBottom(l)).forEach((l) => {
    const bx = boxes?.[l.id];
    const y0 = bx ? bx.y : l.y - (l.anchor === 'middle' ? (l.h || 0) / 2 : 0);
    const y1 = bx ? bx.y + bx.h : y0 + (l.h ?? l.size ?? 0);
    top = Math.min(top, y0); bottom = Math.max(bottom, y1);
  });
  const fromMid = main.length && Number.isFinite(top) ? (top + bottom) / 2 : from.h / 2;
  const toMid = ts.top + (to.h - ts.top - ts.bottom) / 2;
  const place = (l) => (atBottom(l) ? to.h - ts.bottom - (from.h - fs0.bottom - l.y) * k : (l.y - fromMid) * k + toMid);
  return {
    ...doc,
    size,
    layers: doc.layers.map((l) => ({
      ...l, x: l.x * k, y: place(l), w: l.w * k, ...(l.h != null ? { h: l.h * k } : {}), ...(l.size ? { size: Math.round(l.size * k) } : {}),
      ...(l.pin ? { pin: { ...l.pin, gap: (l.pin.gap || 0) * k } } : {}),
    })),
  };
}

/** The design as a 9:16 reel (what Instagram Reels and Stories want). */
export const toReel = (doc) => (doc.size === 'story' ? doc : resize(doc, 'story'));

// ── Motion presets: one choice sets every layer's entrance and timing ──
export const MOTIONS = [
  { key: 'editorial', name: 'Editorial', note: 'Lines rise out of the page; small capitals cascade in', main: 'reveal', small: 'letters', second: 'rise', rest: 'fade' },
  { key: 'gentle', name: 'Gentle', note: 'Soft focus, one line at a time', main: 'blur', second: 'fade', rest: 'fade' },
  { key: 'spoken', name: 'Word by word', note: 'As if it were being said aloud', main: 'words', rest: 'fade' },
  { key: 'typed', name: 'Typewriter', note: 'Typed out with a blinking caret', main: 'type', rest: 'fade' },
  { key: 'bold', name: 'Bold', note: 'A confident pop, then everything rises', main: 'pop', small: 'slide', rest: 'rise' },
  { key: 'still', name: 'Still', note: 'No entrances; only the camera and pattern move', main: 'none', rest: 'none' },
];
/** Layers in the order a reader meets them (top to bottom, pinned layers beside their target). */
function readingOrder(doc) {
  const byId = Object.fromEntries(doc.layers.map((l) => [l.id, l]));
  const yOf = (l, d = 0) => {
    const t = l.pin && byId[l.pin.to];
    if (t && d < 4) return yOf(t, d + 1) + (l.pin.side === 'below' ? 0.5 : -0.5);
    return l.type === 'text' && l.anchor === 'middle' ? l.y - (l.h || l.size * 2) / 2 : l.y;
  };
  return doc.layers.filter((l) => !l.hidden).sort((a, b) => yOf(a) - yOf(b));
}
/** Set every layer's entrance and start time from a motion preset. */
export function applyMotion(doc, key) {
  const m = MOTIONS.find((x) => x.key === key) || MOTIONS[0];
  const texts = doc.layers.filter((l) => l.type === 'text' && !l.hidden);
  const weight = (l) => (l.size || 0) * Math.min(1, String(l.text || '').length / 12);
  const main = texts.reduce((a, b) => (!a || weight(b) > weight(a) ? b : a), null);
  const animFor = (l) => {
    if (m.key === 'still') return 'none';
    if (l === main) return m.main;
    if (l.type === 'text' && l.bg) return m.key === 'gentle' ? 'blur' : 'pop';
    if (l.type === 'text' && m.small && l.upper && (l.spacing || 0) >= 15) return m.small;
    if (l.type === 'text' && m.second && String(l.text || '').length > 40) return m.second;
    return m.rest;
  };
  let t = 0.35;
  const set = {};
  readingOrder(doc).forEach((l) => {
    const anim = animFor(l);
    set[l.id] = { anim, delay: Math.round(t * 100) / 100 };
    t += l === main ? animLength({ ...l, anim }) * 0.8 + 0.15 : anim === 'letters' ? animLength({ ...l, anim }) * 0.55 : 0.3;
  });
  return { ...doc, motion: { ...doc.motion, preset: m.key }, layers: doc.layers.map((l) => (set[l.id] ? { ...l, ...set[l.id] } : l)) };
}

const page = (size, s, pattern = 'topo', seed = 7) => ({
  v: 1, size, style: s.key,
  bg: { color: s.bg, color2: s.bg2 || null, angle: 160 },
  pattern: { kind: pattern, color: s.line, opacity: 1, weight: 1.15, density: 1, scale: 1, seed },
  layers: [],
  motion: {},
  music: { track: 'sunday-keys', volume: 0.8 },
});

// ── The templates ───────────────────────────────────────────────────────────
// Every builder takes ({ size, style, pattern, seed, ...words }) and returns a document.

/** The CEO's Canva card: a script handle over a bold, all-caps statement on topo lines. */
function quote({ size = 'post', style = 'lilac', pattern = 'topo', seed = 7, headline = 'Push me God. I want the promises we talked about.', handle = HANDLES.market, align = 'left' }) {
  const s = styleOf(style); const { w, h } = SIZES[size];
  const doc = page(size, s, pattern, seed);
  const head = newId();
  const boxH = size === 'story' ? 900 : size === 'square' ? 560 : 660;
  doc.layers = [
    { id: head, type: 'text', name: 'Quote', role: 'ink', text: headline, x: 112, y: h / 2 + 4, w: w - 224, h: boxH, anchor: 'middle', fit: true,
      font: 'League Spartan', weight: 800, size: 104, lh: 0.93, upper: true, spacing: 0, align, color: s.ink, anim: 'words', delay: 0.9 },
    { id: newId(), type: 'text', name: 'Handle', role: 'accent', text: handle, x: 112, y: 0, w: w - 224, pin: { to: head, side: 'above', gap: 26 },
      font: 'Yellowtail', weight: 400, size: 44, lh: 1.1, align: 'center', color: s.accent, anim: 'fade', delay: 0.4 },
  ];
  return applyMotion(restyle(doc, s), 'editorial');
}

/** A short line in script ("Dear God,") above the bold statement. */
function prayer({ size = 'post', style = 'plum', pattern = 'topo', seed = 9, intro = 'Dear God,', headline = 'Make me the woman who finishes what You started in me.', handle = HANDLES.market }) {
  const s = styleOf(style); const { w, h } = SIZES[size];
  const doc = page(size, s, pattern, seed);
  const head = newId();
  doc.layers = [
    { id: head, type: 'text', name: 'Statement', role: 'ink', text: headline, x: 112, y: h / 2 + 30, w: w - 224, h: size === 'story' ? 860 : 600, anchor: 'middle', fit: true,
      font: 'League Spartan', weight: 800, size: 96, lh: 0.95, upper: true, align: 'left', color: s.ink, anim: 'rise', delay: 1.0 },
    { id: newId(), type: 'text', name: 'Intro', role: 'accent', text: intro, x: 112, y: 0, w: w - 224, pin: { to: head, side: 'above', gap: 14 },
      font: 'Yellowtail', weight: 400, size: 84, lh: 1.1, align: 'left', color: s.accent, anim: 'fade', delay: 0.4 },
    { id: newId(), type: 'text', name: 'Handle', role: 'soft', text: handle, x: 112, y: h - (size === 'story' ? 380 : 120), w: w - 224, font: 'Yellowtail', size: 40, align: 'center', color: s.soft, opacity: 0.9, anim: 'fade', delay: 2.4 },
  ];
  return applyMotion(restyle(doc, s), 'gentle');
}

/** Scripture: the verse in a serif, the reference in spaced caps. KJV wording only. */
function scripture({ size = 'post', style = 'ivory', pattern = 'topo', seed = 3, verse = 'Strength and honour are her clothing; and she shall rejoice in time to come.', reference = 'Proverbs 31:25', handle = HANDLES.market }) {
  const s = styleOf(style); const { w, h } = SIZES[size];
  const doc = page(size, s, pattern, seed);
  const v = newId();
  doc.layers = [
    { id: v, type: 'text', name: 'Verse', role: 'ink', text: `“${verse}”`, x: 120, y: h / 2 - 10, w: w - 240, h: size === 'story' ? 900 : 640, anchor: 'middle', fit: true,
      font: 'Cormorant Garamond', weight: 500, italic: true, size: 86, lh: 1.12, align: 'center', color: s.ink, anim: 'words', delay: 0.8 },
    { id: newId(), type: 'text', name: 'Reference', role: 'accent', text: `${reference} · KJV`, x: 120, y: 0, w: w - 240, pin: { to: v, side: 'below', gap: 44 },
      font: 'Montserrat', weight: 800, size: 26, spacing: 30, upper: true, align: 'center', color: s.accent, anim: 'fade' },
    { id: newId(), type: 'text', name: 'Handle', role: 'soft', text: handle, x: 120, y: h - (size === 'story' ? 380 : 118), w: w - 240, font: 'Yellowtail', size: 40, align: 'center', color: s.soft, opacity: 0.9, anim: 'fade' },
  ];
  return applyMotion(restyle(doc, s), 'spoken');
}

/** An invitation (become a curator, book a mentorship call): eyebrow, big promise, details, a button. */
function invite({ size = 'post', style = 'plum', pattern = 'topo', seed = 5, eyebrow = 'Now accepting curators', headline = 'Your gift was never meant to stay hidden.', body = 'Your own storefront on p31market.com, a seat at our Atlanta markets, coaching and a sisterhood of women who build.', button = 'Apply at p31market.com/apply', handle = HANDLES.market, brand = 'market' }) {
  const s = styleOf(style); const { w, h } = SIZES[size];
  const doc = page(size, s, pattern, seed);
  const head = newId(); const sub = newId(); const btn = newId();
  const top = size === 'story' ? 420 : size === 'square' ? 150 : 290;
  doc.layers = [
    brand === 'market'
      ? { id: newId(), type: 'image', name: 'P31 Market logo', mark: 'market', src: markFor(s, 'market'), x: 112, y: top - 160, w: 196, h: 136, contain: true, anim: 'pop', delay: 0.2 }
      : { id: newId(), type: 'image', name: 'P31 Collective mark', mark: 'collective', src: markFor(s), x: 112, y: top - 120, w: 96, h: 96, contain: true, anim: 'pop', delay: 0.2 },
    { id: newId(), type: 'text', name: 'Eyebrow', role: 'accent', text: eyebrow, x: 112, y: top, w: w - 224, font: 'Montserrat', weight: 800, size: 26, spacing: 28, upper: true, align: 'left', color: s.accent, anim: 'slide', delay: 0.5 },
    { id: head, type: 'text', name: 'Headline', role: 'ink', text: headline, x: 112, y: top + 64, w: w - 224, h: size === 'square' ? 420 : size === 'story' ? 760 : 500, fit: true,
      font: 'League Spartan', weight: 800, size: 100, lh: 0.95, upper: true, align: 'left', color: s.ink, anim: 'words', delay: 0.9 },
    { id: sub, type: 'text', name: 'Details', role: 'soft', text: body, x: 112, y: 0, w: w - 260, pin: { to: head, side: 'below', gap: 40 },
      font: 'Montserrat', weight: 500, size: 34, lh: 1.35, align: 'left', color: s.soft, anim: 'rise', delay: 2.4 },
    { id: btn, type: 'text', name: 'Button', role: 'bg', bgRole: 'ink', bg: s.ink, text: button, x: 140, y: 0, w: w - 300, pin: { to: sub, side: 'below', gap: 70 },
      font: 'Montserrat', weight: 800, size: 30, spacing: 4, align: 'left', color: s.bg, bgPad: 0.85, anim: 'pop', delay: 3.2 },
    { id: newId(), type: 'text', name: 'Handle', role: 'accent', text: handle, x: 112, y: h - (size === 'story' ? 380 : 120), w: w - 224, font: 'Yellowtail', size: 40, align: 'right', color: s.accent, anim: 'fade', delay: 3.6 },
  ];
  return applyMotion(restyle(doc, s), 'editorial');
}

/** A fill-in-the-blank: the words, then a line for the answer, and an ask. */
function blank({ size = 'post', style = 'thistle', pattern = 'topo', seed = 13, eyebrow = 'Finish the sentence', headline = 'This season, God is teaching me', ask = 'Answer in the comments', handle = HANDLES.market }) {
  const s = styleOf(style); const { w, h } = SIZES[size];
  const doc = page(size, s, pattern, seed);
  const head = newId(); const line = newId();
  doc.layers = [
    { id: newId(), type: 'text', name: 'Eyebrow', role: 'accent', text: eyebrow, x: 112, y: 0, w: w - 224, pin: { to: head, side: 'above', gap: 40 }, font: 'Montserrat', weight: 800, size: 26, spacing: 28, upper: true, align: 'center', color: s.accent, anim: 'fade', delay: 0.4 },
    { id: head, type: 'text', name: 'Words', role: 'ink', text: headline, x: 112, y: h / 2 - 40, w: w - 224, h: 520, anchor: 'middle', fit: true, font: 'League Spartan', weight: 800, size: 92, lh: 0.98, upper: true, align: 'center', color: s.ink, anim: 'words', delay: 0.8 },
    { id: line, type: 'shape', name: 'Blank', shape: 'pill', fillRole: 'accent', fill: s.accent, x: w / 2 - 190, y: 0, w: 380, h: 12, pin: { to: head, side: 'below', gap: 46 }, anim: 'slide', delay: 2.2 },
    { id: newId(), type: 'text', name: 'Ask', role: 'soft', text: ask, x: 112, y: 0, w: w - 224, pin: { to: line, side: 'below', gap: 60 }, font: 'Yellowtail', size: 54, align: 'center', color: s.soft, anim: 'fade', delay: 2.8 },
    { id: newId(), type: 'text', name: 'Handle', role: 'soft', text: handle, x: 112, y: h - (size === 'story' ? 380 : 118), w: w - 224, font: 'Montserrat', weight: 800, size: 22, spacing: 30, upper: true, align: 'center', color: s.soft, opacity: 0.8, anim: 'fade', delay: 3 },
  ];
  return applyMotion(restyle(doc, s), 'gentle');
}

/** A blank page in a style, for starting from scratch. */
function blankPage({ size = 'post', style = 'lilac', pattern = 'topo', seed = 21 }) {
  return page(size, styleOf(style), pattern, seed);
}

export const TEMPLATES = [
  { key: 'quote', name: 'Bold quote', note: 'The Canva look: script handle, bold caps, topo lines', build: quote, words: ['headline', 'handle'] },
  { key: 'prayer', name: 'Prayer', note: 'A script opener above a bold statement', build: prayer, words: ['intro', 'headline', 'handle'] },
  { key: 'scripture', name: 'Scripture', note: 'A verse in serif with its reference (KJV)', build: scripture, words: ['verse', 'reference', 'handle'] },
  { key: 'invite', name: 'Invitation', note: 'Become a curator, book a mentorship call, an event', build: invite, words: ['eyebrow', 'headline', 'body', 'button', 'handle'] },
  { key: 'blank', name: 'Fill in the blank', note: 'Words, a line for the answer and an ask', build: blank, words: ['eyebrow', 'headline', 'ask', 'handle'] },
  { key: 'page', name: 'Blank page', note: 'Your colours and pattern, nothing else', build: blankPage, words: [] },
];
export const templateOf = (key) => TEMPLATES.find((t) => t.key === key) || TEMPLATES[0];

/** A few ready-made invitations (the sign-up links the team points people to). */
export const INVITES = {
  curator: { eyebrow: 'Now accepting curators', headline: 'Your gift was never meant to stay hidden.', body: 'Your own storefront on p31market.com, a seat at our Atlanta markets, coaching and a sisterhood of women who build.', button: `Apply at ${LINKS.curator.short}` },
  mentorship: { eyebrow: 'The P31 Collective', headline: 'You don’t need another sign. You need a mentor.', body: 'Business and faith-based mentorship for women who build, with live sessions and a private classroom.', button: 'Book your free intro call', handle: HANDLES.collective, brand: 'collective' },
};

/** Twelve looks of the same design, one per colour style (Canva's "Styles", in the brand). */
export const variationsOf = (doc) => STYLES.map((s) => restyle(doc, s));

/** A document from a template key and its words (a collection post, a batch line). */
export function fromWords({ template = 'quote', size = 'post', style, pattern, seed, words = {}, align, id }) {
  const t = templateOf(template);
  return { ...t.build({ size, ...(style ? { style } : {}), ...(pattern ? { pattern } : {}), ...(seed != null ? { seed } : {}), ...words, ...(align ? { align } : {}) }), source: id || null };
}
