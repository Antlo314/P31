// Edit presets for Clip Studio. Each one decides how footage is cut, how
// shots change, the colour grade, motion, and how captions look.
//
// transition: cut | crossfade | flash | slide | zoom | dip
// motion:     none | punch (zoom pop on each cut) | drift (slow push-in)
export const CLIP_STYLES = [
  {
    id: 'clean',
    name: 'Clean',
    blurb: 'Tight jump cuts, crisp captions. Talking-head ready.',
    swatch: ['#FCFBFE', '#5E2A8C'],
    silence: { minGap: 0.35, pad: 0.08 },
    maxShot: 12,
    transition: 'cut', transitionDur: 0,
    motion: 'none',
    grade: 'contrast(1.06) saturate(1.06)',
    caption: { font: 'Manrope', weight: 800, size: 0.062, upper: false, color: '#FFFFFF', active: '#F2CE4D', stroke: 'rgba(0,0,0,0.85)', box: null, y: 0.72, words: 3 },
  },
  {
    id: 'hype',
    name: 'Hype',
    blurb: 'Fast cuts, zoom punches, flash hits, bold captions.',
    swatch: ['#F2CE4D', '#1d0f2e'],
    silence: { minGap: 0.25, pad: 0.05 },
    maxShot: 2.2,
    transition: 'flash', transitionDur: 0.18,
    motion: 'punch',
    grade: 'contrast(1.18) saturate(1.3)',
    caption: { font: 'Manrope', weight: 800, size: 0.078, upper: true, color: '#FFFFFF', active: '#17A673', stroke: 'rgba(0,0,0,0.95)', box: null, y: 0.66, words: 2 },
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    blurb: 'Slow push-ins, crossfades, warm film grade.',
    swatch: ['#2a1544', '#D9A93A'],
    silence: { minGap: 0.6, pad: 0.15 },
    maxShot: 5,
    transition: 'crossfade', transitionDur: 0.6,
    motion: 'drift',
    grade: 'contrast(1.12) saturate(0.88) sepia(0.14) brightness(0.98)',
    letterbox: true,
    caption: { font: 'Noto Serif', weight: 400, size: 0.052, upper: false, color: '#FFF8E6', active: '#F2CE4D', stroke: 'rgba(0,0,0,0.6)', box: null, y: 0.8, words: 5, italic: true },
  },
  {
    id: 'luxe',
    name: 'P31 Luxe',
    blurb: 'Soft dips through plum, serif captions, gold accents.',
    swatch: ['#5E2A8C', '#F2CE4D'],
    silence: { minGap: 0.5, pad: 0.12 },
    maxShot: 6,
    transition: 'dip', transitionDur: 0.5,
    motion: 'drift',
    grade: 'brightness(1.04) contrast(1.05) saturate(1.12)',
    titleCard: true,
    endCard: true,
    caption: { font: 'Noto Serif', weight: 700, size: 0.056, upper: false, color: '#FFFFFF', active: '#F2CE4D', stroke: null, box: 'rgba(42,21,68,0.72)', y: 0.76, words: 4 },
  },
  {
    id: 'promo',
    name: 'Product Promo',
    blurb: 'Slide transitions, title + shop end card.',
    swatch: ['#17A673', '#FCFBFE'],
    silence: { minGap: 0.4, pad: 0.1 },
    maxShot: 3.5,
    transition: 'slide', transitionDur: 0.35,
    motion: 'punch',
    grade: 'contrast(1.1) saturate(1.18) brightness(1.03)',
    titleCard: true,
    endCard: true,
    caption: { font: 'Manrope', weight: 800, size: 0.06, upper: true, color: '#1d0f2e', active: '#5E2A8C', stroke: null, box: 'rgba(255,255,255,0.92)', y: 0.74, words: 3 },
  },
  {
    id: 'vlog',
    name: 'Vlog',
    blurb: 'Aggressive silence removal, boxed captions, zoom cuts.',
    swatch: ['#FFFFFF', '#000000'],
    silence: { minGap: 0.18, pad: 0.04 },
    maxShot: 8,
    transition: 'zoom', transitionDur: 0.25,
    motion: 'none',
    grade: 'contrast(1.08) saturate(1.1)',
    caption: { font: 'Manrope', weight: 800, size: 0.058, upper: false, color: '#FFFFFF', active: '#FFFFFF', stroke: null, box: 'rgba(0,0,0,0.78)', y: 0.7, words: 4, activeBox: '#5E2A8C' },
  },
];

export const ASPECTS = [
  { id: '9:16', label: '9:16', note: 'Reels · TikTok · Shorts', w: 720, h: 1280 },
  { id: '4:5', label: '4:5', note: 'Instagram feed', w: 864, h: 1080 },
  { id: '1:1', label: '1:1', note: 'Square', w: 1080, h: 1080 },
  { id: '16:9', label: '16:9', note: 'YouTube', w: 1280, h: 720 },
];

export const LENGTHS = [
  { id: 15, label: '15s' },
  { id: 30, label: '30s' },
  { id: 60, label: '60s' },
  { id: 90, label: '90s' },
  { id: 0, label: 'Full' },
];
