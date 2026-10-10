import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Eye, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { FILTERS, ADJUSTMENTS, ONE_WAY, NO_ADJUST, createGrader, lookParams, isIdentity, cssFallback } from './filters';

const THUMB = 92;

// Draw `src` (video or canvas) into ctx at w×h, cropped to fill (like the export does).
const cover = (ctx, src, w, h) => {
  const sw = src.videoWidth || src.width;
  const sh = src.videoHeight || src.height;
  if (!sw || !sh) return false;
  const k = Math.max(w / sw, h / sh);
  ctx.drawImage(src, (w - sw * k) / 2, (h - sh * k) / 2, sw * k, sh * k);
  return true;
};

/**
 * Looks & filters: pick a look (thumbnails are rendered from your own footage), set its
 * strength, fine-tune with sliders, hold "Before" to compare, and play the clip to see it move.
 */
const FilterPanel = ({ clips, look, setLook, aspect }) => {
  const [clipIdx, setClipIdx] = useState(0);
  const [thumbs, setThumbs] = useState({});
  const [compare, setCompare] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [tune, setTune] = useState(false);
  const graderRef = useRef(null);
  const stillRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const lookRef = useRef(look);
  const compareRef = useRef(compare);
  useEffect(() => { lookRef.current = look; compareRef.current = compare; });

  const k = 360 / Math.max(aspect.w, aspect.h);
  const PW = Math.round(aspect.w * k);
  const PH = Math.round(aspect.h * k);
  const clip = clips[Math.min(clipIdx, clips.length - 1)];

  useEffect(() => {
    try { graderRef.current = createGrader(); } catch { graderRef.current = null; }
    return () => { cancelAnimationFrame(rafRef.current); graderRef.current?.dispose(); };
  }, []);

  // Paint one frame of `src` with the current look (or untouched while comparing).
  const paint = (src, t = 0) => {
    const c = canvasRef.current;
    if (!c || !src) return;
    const ctx = c.getContext('2d');
    const params = lookParams(lookRef.current);
    const plain = compareRef.current || isIdentity(params);
    const g = graderRef.current;
    ctx.save();
    if (plain || g) {
      cover(ctx, src, PW, PH);
      if (!plain && g && g.grade(c, params, t)) ctx.drawImage(g.canvas, 0, 0, PW, PH);
    } else {
      ctx.filter = cssFallback(params);
      cover(ctx, src, PW, PH);
    }
    ctx.restore();
  };

  // A still from about a third of the way into the chosen clip; then thumbnails for every look.
  useEffect(() => {
    if (!clip) return undefined;
    let live = true;
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = clip.url;
    v.onloadedmetadata = () => { v.currentTime = Math.min((v.duration || 1) * 0.35, Math.max(0, (v.duration || 1) - 0.1)); };
    v.onseeked = () => {
      if (!live) return;
      const s = document.createElement('canvas');
      const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
      s.width = Math.round(v.videoWidth * scale);
      s.height = Math.round(v.videoHeight * scale);
      s.getContext('2d').drawImage(v, 0, 0, s.width, s.height);
      stillRef.current = s;
      paint(s);
      // Thumbnails: the same frame through every look.
      const g = graderRef.current;
      const tc = document.createElement('canvas');
      tc.width = THUMB;
      tc.height = Math.round(THUMB * 1.25);
      const tctx = tc.getContext('2d');
      const next = {};
      for (const f of FILTERS) {
        tctx.save();
        tctx.filter = g ? 'none' : cssFallback(f.p);
        cover(tctx, s, tc.width, tc.height);
        tctx.restore();
        if (g && f.id !== 'original' && g.grade(tc, f.p, 0)) {
          const out = document.createElement('canvas');
          out.width = tc.width;
          out.height = tc.height;
          out.getContext('2d').drawImage(g.canvas, 0, 0, tc.width, tc.height);
          next[f.id] = out.toDataURL('image/jpeg', 0.82);
        } else {
          next[f.id] = tc.toDataURL('image/jpeg', 0.82);
        }
      }
      setThumbs(next);
    };
    return () => { live = false; v.removeAttribute('src'); v.load(); };
  }, [clip?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Repaint the still whenever the look or compare changes (unless playing).
  useEffect(() => { if (!playing) paint(stillRef.current); });

  const togglePlay = () => {
    cancelAnimationFrame(rafRef.current);
    if (playing) { videoRef.current?.pause(); setPlaying(false); return; }
    let v = videoRef.current;
    if (!v) { v = document.createElement('video'); v.muted = true; v.playsInline = true; v.loop = true; videoRef.current = v; }
    if (v.src !== clip.url) v.src = clip.url;
    v.play().catch(() => {});
    setPlaying(true);
    const t0 = performance.now();
    const step = () => {
      if (v.readyState >= 2) paint(v, (performance.now() - t0) / 1000);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  };
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); videoRef.current?.pause(); }, []);

  const setAdjust = (key, value) => setLook((l) => ({ ...l, adjust: { ...l.adjust, [key]: value } }));
  const tuned = Object.values(look.adjust || {}).some((v) => v);

  return (
    <div className="fp">
      <div className="fp-preview">
        <canvas ref={canvasRef} width={PW} height={PH} style={{ aspectRatio: `${PW} / ${PH}` }} />
        <div className="fp-preview__bar">
          <button type="button" className="cs-btn cs-btn--ghost cs-btn--sm" onClick={togglePlay}>
            {playing ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Play</>}
          </button>
          <button type="button" className="cs-btn cs-btn--ghost cs-btn--sm" aria-pressed={compare}
            onPointerDown={() => setCompare(true)} onPointerUp={() => setCompare(false)} onPointerLeave={() => setCompare(false)}
            onKeyDown={(e) => e.key === ' ' && setCompare(true)} onKeyUp={() => setCompare(false)}>
            <Eye size={15} /> Hold for before
          </button>
        </div>
        {clips.length > 1 && (
          <div className="fp-clips" role="group" aria-label="Preview clip">
            {clips.map((c, i) => (
              <button type="button" key={c.id} className={i === clipIdx ? 'is-on' : ''} onClick={() => { setClipIdx(i); setPlaying(false); cancelAnimationFrame(rafRef.current); videoRef.current?.pause(); }}
                aria-label={`Preview ${c.name}`}><img src={c.thumb} alt="" /></button>
            ))}
          </div>
        )}
      </div>

      <div className="fp-side">
        <div className="fp-looks" role="radiogroup" aria-label="Look">
          {FILTERS.map((f) => (
            <button type="button" key={f.id} role="radio" aria-checked={look.filter === f.id} className={`fp-look ${look.filter === f.id ? 'is-on' : ''}`}
              onClick={() => setLook((l) => ({ ...l, filter: f.id }))}>
              {thumbs[f.id] ? <img src={thumbs[f.id]} alt="" /> : <span className="fp-look__ph" />}
              <span>{f.name}</span>
            </button>
          ))}
        </div>

        <label className="fp-slider">
          <span>Strength <b>{Math.round((look.intensity ?? 1) * 100)}%</b></span>
          <input type="range" min="0" max="1" step="0.01" value={look.intensity ?? 1} onChange={(e) => setLook((l) => ({ ...l, intensity: +e.target.value }))} disabled={look.filter === 'original'} />
        </label>

        <div className="fp-tune">
          <button type="button" className="cs-linkbtn" aria-expanded={tune} onClick={() => setTune(!tune)}>
            <SlidersHorizontal size={14} /> Fine-tune {tuned ? '· edited' : ''}
          </button>
          {tuned && <button type="button" className="cs-linkbtn" onClick={() => setLook((l) => ({ ...l, adjust: { ...NO_ADJUST } }))}><RotateCcw size={13} /> Reset</button>}
        </div>
        {tune && (
          <div className="fp-adjust">
            {ADJUSTMENTS.map(([key, label]) => {
              const v = look.adjust?.[key] || 0;
              return (
                <label className="fp-slider" key={key} onDoubleClick={() => setAdjust(key, 0)} title="Double-click to reset">
                  <span>{label} <b>{v > 0 && !ONE_WAY.has(key) ? '+' : ''}{Math.round(v * 100)}</b></span>
                  <input type="range" min={ONE_WAY.has(key) ? 0 : -1} max="1" step="0.01" value={v} onChange={(e) => setAdjust(key, +e.target.value)} />
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterPanel;
