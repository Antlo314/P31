import React from 'react';
import { colorHex, colorTone } from '../../../supabase/functions/_shared/merch-catalog.js';
import { thumbFor } from './shop';

// A drawn product picture (garment in its colour with the design on it), used until Printful's
// photo for that item and colour is ready. 400 x 500 viewBox, the same 4:5 as the cards.
const SHAPES = {
  tee: { d: 'M128 62 L168 46 Q200 76 232 46 L272 62 L356 112 L326 178 L290 160 L290 452 L110 452 L110 160 L74 178 L44 112 Z', art: [140, 118, 120, 150] },
  crew: { d: 'M128 62 L168 50 Q200 72 232 50 L272 62 L332 98 L368 332 L330 342 L294 184 L294 452 L106 452 L106 184 L70 342 L32 332 L68 98 Z', art: [144, 118, 112, 132] },
  hoodie: { d: 'M130 66 L162 52 Q200 6 238 52 L270 66 L332 100 L368 332 L330 342 L294 186 L294 452 L106 452 L106 186 L70 342 L32 332 L68 100 Z', art: [150, 120, 100, 92], extra: 'M150 318 L250 318 L262 392 L138 392 Z' },
  tote: { d: 'M100 176 L300 176 L310 440 L90 440 Z', art: [122, 206, 156, 190], handles: true },
  mug: { d: 'M108 150 L272 150 L272 372 Q272 392 252 392 L128 392 Q108 392 108 372 Z', art: [122, 166, 136, 190], handle: true },
  sticker: { circle: true, art: [86, 136, 228, 228] },
  journal: { d: 'M118 86 L292 86 Q300 86 300 94 L300 418 Q300 426 292 426 L118 426 Q110 426 110 418 L110 94 Q110 86 118 86 Z', art: [110, 86, 190, 340], cover: true },
  hat: { d: 'M96 286 Q100 176 200 170 Q300 176 304 286 Z', art: [146, 216, 108, 48], brim: 'M96 286 Q200 268 304 286 Q330 300 312 318 Q200 300 88 318 Q72 300 96 286 Z' },
};

const MerchMock = ({ item, color, className = '' }) => {
  const s = SHAPES[item.type];
  const fill = item.type === 'mug' ? '#ffffff' : colorHex(color);
  const dark = colorTone(color) === 'dark';
  const edge = dark ? 'rgba(255,255,255,0.08)' : 'rgba(58,28,54,0.16)';
  const [x, y, w, h] = s.art;
  const id = `mm-${item.id}-${color}`.replace(/[^a-z0-9-]/gi, '');
  return (
    <svg className={`mm ${className}`} viewBox="0 0 400 500" role="img" aria-label={`${item.design} ${item.type} in ${color}`}>
      <defs>
        <linearGradient id={`${id}-sh`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity={dark ? 0.1 : 0.35} />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity={dark ? 0.25 : 0.08} />
        </linearGradient>
      </defs>
      {s.handles && <path d="M140 176 Q140 96 200 96 Q260 96 260 176" fill="none" stroke={fill} strokeWidth="14" strokeLinecap="round" style={{ filter: 'drop-shadow(0 1px 0 rgba(58,28,54,0.25))' }} />}
      {s.handle && <path d="M272 196 Q326 196 326 262 Q326 330 272 330" fill="none" stroke="#f4f0f2" strokeWidth="22" style={{ filter: 'drop-shadow(0 2px 2px rgba(58,28,54,0.18))' }} />}
      {s.circle
        ? <circle cx="200" cy="250" r="122" fill="#ffffff" style={{ filter: 'drop-shadow(0 6px 14px rgba(58,28,54,0.22))' }} />
        : <path d={s.d} fill={fill} stroke={edge} strokeWidth="2" style={{ filter: 'drop-shadow(0 10px 18px rgba(33,16,30,0.18))' }} />}
      {s.extra && <path d={s.extra} fill="none" stroke={edge} strokeWidth="2.5" />}
      {s.brim && <path d={s.brim} fill={fill} stroke={edge} strokeWidth="2" />}
      <image href={thumbFor(item, color)} x={x} y={y} width={w} height={h} preserveAspectRatio={s.cover ? 'xMidYMid slice' : 'xMidYMin meet'} />
      {!s.circle && <path d={s.d} fill={`url(#${id}-sh)`} pointerEvents="none" />}
    </svg>
  );
};

export default MerchMock;
