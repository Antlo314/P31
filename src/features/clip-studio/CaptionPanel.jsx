import React, { useEffect, useRef, useState } from 'react';
import { Captions, Play, Scissors, Merge, Trash2, Plus, Minus, RotateCcw, Type, Clock, SlidersHorizontal, Sparkles, Smartphone } from 'lucide-react';
import {
  CAPTION_FONTS, HIGHLIGHTS, ANIMATIONS, BACKGROUNDS, FILLS, CAPTION_PRESETS, drawCaption, drawSafeZone, loadCaptionFont, retimePage, shiftPage, splitPage, mergePages, timePages,
} from './captions';

// A small live sample of one preset, drawn with the real caption engine.
const SAMPLE = { words: [{ text: 'Her', start: 0, end: 0.3 }, { text: 'gifts', start: 0.3, end: 0.7 }, { text: 'make', start: 0.7, end: 1 }, { text: 'room', start: 1, end: 1.5 }], start: 0, end: 1.5, showStart: 0, showEnd: 1.6 };
const PresetThumb = ({ preset, base, on, onPick }) => {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    let live = true;
    const s = { ...base, ...preset.patch, y: 0.5, animation: 'none', lines: 2, words: 4, size: Math.min(preset.patch.size || base.size, 0.11) * 1.9 };
    loadCaptionFont(s).then(() => {
      if (!live) return;
      const ctx = c.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, c.width, c.height);
      g.addColorStop(0, '#3b2a4a'); g.addColorStop(1, '#17111f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
      drawCaption(ctx, [SAMPLE], 0.85, s, c.width, c.height);
    });
    return () => { live = false; };
  }, [preset, base]);
  return (
    <button type="button" className={`cp-preset ${on ? 'is-on' : ''}`} onClick={onPick} aria-pressed={on} title={preset.note}>
      <canvas ref={ref} width={168} height={94} />
      <strong>{preset.name}</strong>
    </button>
  );
};
import { createGrader, lookParams, isIdentity } from './filters';

const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

/** Where in the source footage is output time t? */
const sourceAt = (timeline, t) => {
  const shot = [...timeline].reverse().find((s) => t >= s.outStart) || timeline[0];
  return { clipIndex: shot.clipIndex, time: Math.max(0, shot.start + (t - shot.outStart)) };
};

/**
 * Caption look + timing editor with a live preview frame.
 *   pages / setPages: caption pages (timed)
 *   settings / setSettings: caption look (see captionSettings)
 *   onRegroup(settings): rebuild pages from the original words with these settings
 */
const CaptionPanel = ({ pages, setPages, settings, setSettings, onRegroup, clips, timeline, aspect, look }) => {
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState('styles');
  const [safe, setSafe] = useState(aspect.h / aspect.w > 1.5);
  const [presetId, setPresetId] = useState('');
  const canvasRef = useRef(null);
  const frameRef = useRef(null);  // current video frame (canvas)
  const videoRef = useRef(null);
  const playRef = useRef(0);
  const graderRef = useRef(undefined); // made on first use; null if WebGL2 is unavailable
  const page = pages[Math.min(sel, pages.length - 1)];
  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const update = (list) => setPages(timePages(list, settings));

  // Preview canvas size: the export aspect, 360px on its long side.
  const k = 360 / Math.max(aspect.w, aspect.h);
  const PW = Math.round(aspect.w * k);
  const PH = Math.round(aspect.h * k);

  const paint = (t) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, PW, PH);
    if (frameRef.current) {
      const f = frameRef.current;
      const s = Math.max(PW / f.width, PH / f.height);
      ctx.drawImage(f, (PW - f.width * s) / 2, (PH - f.height * s) / 2, f.width * s, f.height * s);
      const params = lookParams(look);
      if (!isIdentity(params)) {
        if (graderRef.current === undefined) { try { graderRef.current = createGrader(); } catch { graderRef.current = null; } }
        if (graderRef.current?.grade(c, params, t)) ctx.drawImage(graderRef.current.canvas, 0, 0, PW, PH);
      }
    }
    drawCaption(ctx, pages, t, settings, PW, PH);
    if (safe) drawSafeZone(ctx, PW, PH);
  };
  const applyPreset = (p) => { setPresetId(p.id); set({ ...p.patch, y: Math.min(settings.y, 0.7) }); };

  // Grab the footage frame under the selected caption.
  useEffect(() => {
    if (!page || !timeline?.length) return undefined;
    let live = true;
    const t = (page.start + page.end) / 2;
    const src = sourceAt(timeline, t);
    const clip = clips[src.clipIndex];
    if (!clip) return undefined;
    const v = videoRef.current || Object.assign(document.createElement('video'), { muted: true, playsInline: true, preload: 'auto' });
    videoRef.current = v;
    const grab = () => {
      if (!live) return;
      const c = document.createElement('canvas');
      c.width = v.videoWidth || 720; c.height = v.videoHeight || 1280;
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      frameRef.current = c;
      loadCaptionFont(settings).then(() => live && paint(t));
    };
    const seek = () => { v.currentTime = Math.min(src.time, Math.max(0, (v.duration || src.time) - 0.05)); };
    v.onseeked = grab;
    if (v.src !== clip.url) { v.src = clip.url; v.onloadedmetadata = seek; } else seek();
    return () => { live = false; };
  }, [page?.start, page?.end, timeline, clips]); // eslint-disable-line react-hooks/exhaustive-deps

  // Repaint when the look or text changes.
  useEffect(() => {
    if (!page) return;
    loadCaptionFont(settings).then(() => paint((page.start + page.end) / 2));
  });

  const playPage = () => {
    if (!page) return;
    cancelAnimationFrame(playRef.current);
    const from = page.showStart - 0.1;
    const to = page.showEnd + 0.1;
    const t0 = performance.now();
    const step = (now) => {
      const t = from + (now - t0) / 1000;
      paint(t + (settings.offset || 0));
      if (t < to) playRef.current = requestAnimationFrame(step);
    };
    playRef.current = requestAnimationFrame(step);
  };
  useEffect(() => () => { cancelAnimationFrame(playRef.current); graderRef.current?.dispose(); }, []);

  if (!pages.length) return <p className="cs-note">No speech was found, so there are no captions.</p>;

  const nudge = (i, ds, de) => update(pages.map((p, j) => (j === i ? shiftPage(p, ds, de) : p)));
  const edit = (i, text) => {
    const next = retimePage(pages[i], text);
    update(next ? pages.map((p, j) => (j === i ? next : p)) : pages.filter((_, j) => j !== i));
  };
  const split = (i) => update([...pages.slice(0, i), ...splitPage(pages[i]), ...pages.slice(i + 1)]);
  const merge = (i) => { if (pages[i + 1]) update([...pages.slice(0, i), mergePages(pages[i], pages[i + 1]), ...pages.slice(i + 2)]); };
  const remove = (i) => { update(pages.filter((_, j) => j !== i)); setSel(Math.max(0, i - 1)); };

  return (
    <div className="cp">
      <div className="cp-preview">
        <canvas ref={canvasRef} width={PW} height={PH} style={{ aspectRatio: `${PW} / ${PH}` }} />
        <div className="cp-preview__bar">
          <button type="button" className="cs-btn cs-btn--ghost cs-btn--sm" onClick={playPage}><Play size={15} /> Play caption</button>
          <button type="button" className={`cs-btn cs-btn--ghost cs-btn--sm ${safe ? 'is-on' : ''}`} onClick={() => setSafe(!safe)} aria-pressed={safe} title="Where Instagram draws its own buttons and caption"><Smartphone size={15} /> Safe zone</button>
          <span>{sel + 1} / {pages.length}</span>
        </div>
      </div>

      <div className="cp-side">
        <div className="cs-seg cs-seg--tight cp-tabs" role="tablist">
          <button role="tab" className={tab === 'styles' ? 'is-on' : ''} onClick={() => setTab('styles')}><Sparkles size={14} /> Styles</button>
          <button role="tab" className={tab === 'look' ? 'is-on' : ''} onClick={() => setTab('look')}><Type size={14} /> Look</button>
          <button role="tab" className={tab === 'timing' ? 'is-on' : ''} onClick={() => setTab('timing')}><Clock size={14} /> Timing</button>
          <button role="tab" className={tab === 'text' ? 'is-on' : ''} onClick={() => setTab('text')}><Captions size={14} /> Text</button>
        </div>

        {tab === 'styles' && (
          <div className="cp-presets">
            {CAPTION_PRESETS.map((p) => <PresetThumb key={p.id} preset={p} base={settings} on={presetId === p.id} onPick={() => applyPreset(p)} />)}
            <p className="cs-note cp-span">Pick a style, then fine-tune it under Look. Size, position and timing are yours to keep.</p>
          </div>
        )}

        {tab === 'look' && (
          <div className="cp-grid">
            <label className="cs-field"><span>Font</span>
              <select value={settings.font} onChange={(e) => { const f = CAPTION_FONTS.find((x) => x.id === e.target.value); set({ font: f.id, weight: f.weights.includes(settings.weight) ? settings.weight : f.weights[f.weights.length - 1], italic: settings.italic && !!f.italic }); }}>{CAPTION_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}</select>
            </label>
            <label className="cs-field"><span>Weight</span>
              <select value={settings.weight} onChange={(e) => set({ weight: Number(e.target.value) })}>
                {(CAPTION_FONTS.find((f) => f.id === settings.font)?.weights || [400]).map((w) => <option key={w} value={w}>{w <= 400 ? 'Regular' : w === 600 ? 'Semibold' : w === 700 ? 'Bold' : w === 800 ? 'Extra bold' : 'Black'}</option>)}
              </select>
            </label>
            <label className="cs-field cp-span"><span>Size · {Math.round(settings.size * 1000) / 10}%</span>
              <input type="range" min="0.035" max="0.11" step="0.002" value={settings.size} onChange={(e) => set({ size: Number(e.target.value) })} />
            </label>
            <label className="cs-field cp-span"><span>Position · {settings.y < 0.35 ? 'top' : settings.y > 0.65 ? 'bottom' : 'middle'}</span>
              <input type="range" min="0.12" max="0.9" step="0.01" value={settings.y} onChange={(e) => set({ y: Number(e.target.value) })} />
            </label>
            <label className="cs-field"><span>Text color</span><input type="color" value={settings.color} onChange={(e) => set({ color: e.target.value })} /></label>
            <label className="cs-field"><span>Highlight color</span><input type="color" value={settings.highlight === 'box' ? settings.activeBox : settings.active} onChange={(e) => set(settings.highlight === 'box' ? { activeBox: e.target.value } : { active: e.target.value })} /></label>
            <label className="cs-field cp-span"><span>Spoken-word highlight</span>
              <select value={settings.highlight} onChange={(e) => set({ highlight: e.target.value })}>{HIGHLIGHTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <label className="cs-field"><span>Background</span>
              <select value={settings.background} onChange={(e) => set({ background: e.target.value })}>{BACKGROUNDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <label className="cs-field"><span>Animation</span>
              <select value={settings.animation} onChange={(e) => set({ animation: e.target.value })}>{ANIMATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <label className="cs-field"><span>Text fill</span>
              <select value={settings.fill || 'solid'} onChange={(e) => set({ fill: e.target.value })}>{FILLS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <label className="cs-field"><span>Letter spacing · {Math.round((settings.letterSpacing || 0) * 100)}</span>
              <input type="range" min="0" max="0.12" step="0.01" value={settings.letterSpacing || 0} onChange={(e) => set({ letterSpacing: Number(e.target.value) })} />
            </label>
            <label className="cs-toggle"><span>Soft shadow</span><input type="checkbox" checked={!!settings.shadow} onChange={(e) => set({ shadow: e.target.checked })} /></label>
            <label className="cs-toggle cp-span"><span>Outline</span><input type="checkbox" checked={settings.outline} onChange={(e) => set({ outline: e.target.checked })} /></label>
            {settings.outline && <>
              <label className="cs-field"><span>Outline color</span><input type="color" value={settings.outlineColor} onChange={(e) => set({ outlineColor: e.target.value })} /></label>
              <label className="cs-field"><span>Thickness</span><input type="range" min="0.04" max="0.26" step="0.01" value={settings.outlineWidth} onChange={(e) => set({ outlineWidth: Number(e.target.value) })} /></label>
            </>}
            <label className="cs-toggle"><span>ALL CAPS</span><input type="checkbox" checked={settings.upper} onChange={(e) => set({ upper: e.target.checked })} /></label>
            {CAPTION_FONTS.find((f) => f.id === settings.font)?.italic && <label className="cs-toggle"><span><em>Italic</em></span><input type="checkbox" checked={settings.italic} onChange={(e) => set({ italic: e.target.checked })} /></label>}
          </div>
        )}

        {tab === 'timing' && (
          <div className="cp-grid">
            <label className="cs-field cp-span"><span>Words per caption · {settings.words}</span>
              <input type="range" min="1" max="8" step="1" value={settings.words} onChange={(e) => { const next = { ...settings, words: Number(e.target.value) }; setSettings(next); onRegroup(next); }} />
            </label>
            <label className="cs-field"><span>Lines per caption</span>
              <select value={settings.lines} onChange={(e) => set({ lines: Number(e.target.value) })}><option value={1}>1 line</option><option value={2}>2 lines</option><option value={3}>3 lines</option></select>
            </label>
            <label className="cs-field"><span>Shortest on screen</span>
              <select value={settings.minShow} onChange={(e) => { const next = { ...settings, minShow: Number(e.target.value) }; setSettings(next); setPages(timePages(pages, next)); }}>{[0.4, 0.7, 1, 1.4].map((v) => <option key={v} value={v}>{v}s</option>)}</select>
            </label>
            <label className="cs-field"><span>Clears after the last word</span>
              <select value={settings.hang ?? 0.3} onChange={(e) => { const next = { ...settings, hang: Number(e.target.value) }; setSettings(next); setPages(timePages(pages, next)); }}>{[[0.1, 'Right away'], [0.3, 'Quick (0.3s)'], [0.6, 'Relaxed (0.6s)'], [1, 'Slow (1s)']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <label className="cs-field cp-span"><span>Sync all captions · {settings.offset > 0 ? '+' : ''}{settings.offset.toFixed(2)}s {settings.offset ? (settings.offset > 0 ? '(later)' : '(earlier)') : ''}</span>
              <input type="range" min="-1" max="1" step="0.05" value={settings.offset} onChange={(e) => set({ offset: Number(e.target.value) })} />
            </label>
            <button type="button" className="cs-btn cs-btn--ghost cs-btn--sm cp-span" onClick={() => onRegroup(settings)}><RotateCcw size={15} /> Rebuild captions from the audio</button>
            <p className="cs-note cp-span"><SlidersHorizontal size={13} /> Words-per-caption and “Rebuild” regroup from the original speech timing — text fixes are kept only on the Text tab.</p>
          </div>
        )}

        {tab === 'text' && page && (
          <div className="cp-edit">
            <div className="cp-times">
              <span>Starts {fmt(page.start)}</span>
              <button type="button" onClick={() => nudge(sel, -0.1, 0)} aria-label="Start earlier"><Minus size={13} /></button>
              <button type="button" onClick={() => nudge(sel, 0.1, 0)} aria-label="Start later"><Plus size={13} /></button>
              <span>Ends {fmt(page.end)}</span>
              <button type="button" onClick={() => nudge(sel, 0, -0.1)} aria-label="End earlier"><Minus size={13} /></button>
              <button type="button" onClick={() => nudge(sel, 0, 0.1)} aria-label="End later"><Plus size={13} /></button>
            </div>
            <div className="cs-bar cs-bar--wrap cs-bar--inline">
              <button type="button" className="cs-btn cs-btn--ghost cs-btn--sm" onClick={() => split(sel)} disabled={page.words.length < 2}><Scissors size={14} /> Split</button>
              <button type="button" className="cs-btn cs-btn--ghost cs-btn--sm" onClick={() => merge(sel)} disabled={!pages[sel + 1]}><Merge size={14} /> Join next</button>
              <button type="button" className="cs-btn cs-btn--ghost cs-btn--sm" onClick={() => remove(sel)}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        )}
      </div>

      <div className="cs-pages cp-list">
        {pages.map((pg, i) => (
          <label className={`cs-page ${i === sel ? 'is-sel' : ''}`} key={`${i}-${pg.start.toFixed(2)}-${pg.words.length}`} onFocus={() => { setSel(i); setTab((t) => (t === 'look' ? t : 'text')); }}>
            <span>{fmt(pg.start)}</span>
            <input defaultValue={pg.words.map((w) => w.text).join(' ')} onBlur={(e) => e.target.value !== pg.words.map((w) => w.text).join(' ') && edit(i, e.target.value)} />
          </label>
        ))}
      </div>
    </div>
  );
};

export default CaptionPanel;
