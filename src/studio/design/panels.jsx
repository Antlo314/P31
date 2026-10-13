import React, { useEffect, useMemo, useState } from 'react';
import { Type, Square, Circle, Minus, ImagePlus, Trash2, Copy, FolderOpen, RectangleHorizontal } from 'lucide-react';
import Thumb from './Thumb';
import { TEMPLATES, MARKS, newId, resize, variationsOf, fromWords, INVITES, MOTIONS, applyMotion } from './templates';
import { COLLECTION, captionsFor } from './collection';
import { STYLES, styleOf, HANDLES } from './brand';
import { sizeOf, CAMERAS, INTROS } from './draw';
import { readImage } from './util';
import { listDesigns, deleteDesign } from './store';

/** Templates in the current size and colour style. */
export const TemplatesPanel = ({ doc, onReplace }) => {
  const docs = useMemo(() => TEMPLATES.map((t) => ({ t, d: t.key === 'invite' ? t.build({ size: doc.size, style: doc.style || 'lilac', ...INVITES.curator }) : t.build({ size: doc.size, style: doc.style || 'lilac' }) })), [doc.size, doc.style]);
  return (
    <div className="dz-grid">
      {docs.map(({ t, d }) => (
        <button key={t.key} type="button" className="dz-card" onClick={() => onReplace({ ...d, music: doc.music })}>
          <Thumb doc={d} width={180} label={t.name} />
          <strong>{t.name}</strong><small>{t.note}</small>
        </button>
      ))}
      <button type="button" className="dz-card" onClick={() => onReplace({ ...fromWords({ template: 'invite', size: doc.size, style: doc.style || 'plum', words: INVITES.mentorship }), music: doc.music })}>
        <Thumb doc={fromWords({ template: 'invite', size: doc.size, style: doc.style || 'plum', words: INVITES.mentorship })} width={180} label="Mentorship invitation" />
        <strong>Mentorship invitation</strong><small>Book a free intro call</small>
      </button>
    </div>
  );
};

/** The "Push me God" collection: the 48 scheduled posts, ready to remix. */
export const CollectionPanel = ({ doc, onReplace }) => {
  const [kind, setKind] = useState('all');
  const items = useMemo(() => COLLECTION.filter((p) => kind === 'all' || p.kind === kind).map((p) => ({ p, d: resize(fromWords(p), doc.size) })), [kind, doc.size]);
  return (
    <>
      <p className="ds-muted dz-small">Forty-eight posts in Melanie JC’s quote-card look, scheduled two a day through November 5. Open one to change the words, colours or music, or to make a reel of it.</p>
      <div className="dz-chips">
        {[['all', 'All'], ['faith', 'Quotes'], ['scripture', 'Scripture'], ['curator', 'Curators'], ['mentorship', 'Mentorship']].map(([k, l]) => <button key={k} type="button" className={`dz-chip ${kind === k ? 'is-on' : ''}`} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
      </div>
      <div className="dz-grid">
        {items.map(({ p, d }) => (
          <button key={p.id} type="button" className="dz-card" onClick={() => onReplace({ ...d, music: doc.music, caption: captionsFor(p).instagram })} title={p.words.headline || p.words.verse}>
            <Thumb doc={d} width={150} label={p.words.headline || p.words.verse} />
          </button>
        ))}
      </div>
    </>
  );
};

/** Every brand colour style applied to this design (click one to use it). */
export const StylesPanel = ({ doc, onChange }) => {
  const looks = useMemo(() => variationsOf(doc), [doc]);
  return (
    <>
      <p className="ds-muted dz-small">Your design in each of the brand’s colour styles. Pick one; your words and layout stay the same.</p>
      <div className="dz-grid">
        {looks.map((d, i) => (
          <button key={STYLES[i].key} type="button" className={`dz-card ${doc.style === STYLES[i].key ? 'is-on' : ''}`} onClick={() => onChange(() => d)}>
            <Thumb doc={d} width={150} label={STYLES[i].name} />
            <small>{STYLES[i].name}</small>
          </button>
        ))}
      </div>
    </>
  );
};

const TEXTS = [
  ['Heading', { text: 'Your words here', font: 'League Spartan', weight: 800, size: 96, lh: 0.95, upper: true, role: 'ink' }],
  ['Subheading', { text: 'A line that adds to it', font: 'Montserrat', weight: 700, size: 46, lh: 1.15, role: 'soft' }],
  ['Body text', { text: 'A sentence or two of detail.', font: 'Montserrat', weight: 500, size: 34, lh: 1.35, role: 'soft' }],
  ['Script', { text: 'Dear God,', font: 'Yellowtail', weight: 400, size: 72, lh: 1.1, role: 'accent' }],
  ['Elegant serif', { text: 'Strength and honour', font: 'Cormorant Garamond', weight: 500, italic: true, size: 72, lh: 1.12, role: 'ink' }],
  ['Spaced caps', { text: 'Proverbs 31:25 · KJV', font: 'Montserrat', weight: 800, size: 26, spacing: 30, upper: true, role: 'accent' }],
  ['The handle', { text: HANDLES.market, font: 'Yellowtail', weight: 400, size: 44, role: 'accent' }],
  ['Button', { text: 'Apply at p31market.com/apply', font: 'Montserrat', weight: 800, size: 30, spacing: 4, role: 'bg', bgRole: 'ink', bgPad: 0.85 }],
];

/** Add text, shapes, the P31 mark or a picture. */
export const AddPanel = ({ doc, onAdd }) => {
  const s = styleOf(doc.style);
  const { w, h } = sizeOf(doc);
  const text = (preset) => {
    const width = Math.min(w - 200, preset.size > 60 ? w - 224 : 760);
    onAdd({ id: newId(), type: 'text', name: preset.role === 'bg' ? 'Button' : 'Text', x: Math.round((w - width) / 2), y: Math.round(h / 2 - preset.size / 2), w: width, align: 'center', anim: 'rise', delay: 0.5,
      ...preset, color: s[preset.role] || s.ink, ...(preset.bgRole ? { bg: s[preset.bgRole] } : {}) });
  };
  const shape = (kind) => {
    const dims = { rect: [600, 400], rounded: [600, 400], circle: [360, 360], pill: [520, 110], line: [520, 12], arch: [440, 600], frame: [w - 120, h - 120] }[kind];
    const [sw, sh] = dims;
    onAdd({ id: newId(), type: 'shape', name: kind[0].toUpperCase() + kind.slice(1), shape: kind === 'rounded' || kind === 'frame' ? 'rect' : kind, x: Math.round((w - sw) / 2), y: Math.round((h - sh) / 2), w: sw, h: sh,
      radius: kind === 'rounded' ? 40 : kind === 'frame' ? 34 : 0, fillRole: kind === 'frame' ? null : 'accent', fill: kind === 'frame' ? null : s.accent, strokeRole: kind === 'frame' || kind === 'line' ? 'accent' : null, stroke: kind === 'frame' || kind === 'line' ? s.accent : null, strokeW: kind === 'line' ? 6 : 3,
      opacity: kind === 'frame' || kind === 'line' ? 1 : 0.9, anim: kind === 'frame' ? 'fade' : 'pop', delay: 0.2 });
  };
  const mark = (variant) => onAdd({ id: newId(), type: 'image', name: 'P31 mark', src: MARKS[variant], x: Math.round(w / 2 - 80), y: 110, w: 160, h: 160, contain: true, anim: 'pop', delay: 0.2 });
  const picture = async (file) => {
    if (!file) return;
    const img = await readImage(file);
    const pw = Math.min(w - 160, img.w); const ph = Math.round(pw * (img.h / img.w));
    onAdd({ id: newId(), type: 'image', name: 'Picture', src: img.src, x: Math.round((w - pw) / 2), y: Math.round((h - ph) / 2), w: pw, h: ph, radius: 24, anim: 'fade', delay: 0.2 });
  };
  return (
    <div className="dz-add">
      <h4><Type size={15} /> Text</h4>
      <div className="dz-textbtns">
        {TEXTS.map(([label, p]) => (
          <button key={label} type="button" className="dz-textbtn" onClick={() => text(p)} style={{ fontFamily: `"${p.font}"`, fontWeight: p.weight, fontStyle: p.italic ? 'italic' : 'normal', textTransform: p.upper ? 'uppercase' : 'none', letterSpacing: p.spacing ? `${p.spacing / 100}em` : undefined }}>{label}</button>
        ))}
      </div>
      <h4><Square size={15} /> Shapes</h4>
      <div className="dz-shapes">
        {[['rect', 'Box', Square], ['rounded', 'Rounded box', Square], ['circle', 'Circle', Circle], ['pill', 'Pill', RectangleHorizontal], ['line', 'Line', Minus], ['arch', 'Arch', Square], ['frame', 'Frame', Square]].map((s) => { const Icon = s[2]; return <button key={s[0]} type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => shape(s[0])}><Icon size={14} /> {s[1]}</button>; })}
      </div>
      <h4>P31 mark</h4>
      <div className="dz-marks">
        {Object.entries(MARKS).map(([k, src]) => <button key={k} type="button" className={`dz-mark dz-mark--${k}`} onClick={() => mark(k)} aria-label={`Add the ${k} P31 mark`}><img src={src} alt="" /></button>)}
      </div>
      <h4><ImagePlus size={15} /> Your pictures</h4>
      <label className="k-btn k-btn--ghost k-btn--sm"><ImagePlus size={14} /> Upload a picture
        <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; picture(f); }} />
      </label>
    </div>
  );
};

/** Saved designs (the team's, once v44 runs; this browser's until then). */
export const DesignsPanel = ({ onOpen, refreshKey, shared, setShared, current }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    listDesigns().then((r) => { if (!live) return; setRows(r.rows); setShared(r.shared); }).catch((e) => { if (live) { setError(e.message); setRows([]); } });
    return () => { live = false; };
  }, [refreshKey, setShared]);
  const remove = async (r) => {
    if (!window.confirm(`Delete “${r.title}”? This can’t be undone.`)) return;
    try { await deleteDesign(r.id, shared); setRows((x) => x.filter((y) => y.id !== r.id)); } catch (e) { setError(e.message); }
  };
  return (
    <>
      {shared === false && <p className="ds-muted dz-small">Designs are saved in this browser for now. Once the v44 database update runs, saved designs are shared with the whole team.</p>}
      {error && <p className="k-error">{error}</p>}
      {rows === null ? <p className="ds-muted">Loading…</p> : !rows.length ? <p className="ds-muted">Nothing saved yet. Use Save at the top to keep a design here.</p> : (
        <div className="dz-grid">
          {rows.map((r) => (
            <div key={r.id} className={`dz-card dz-card--saved ${current === r.id ? 'is-on' : ''}`}>
              <button type="button" className="dz-card__open" onClick={() => onOpen(r)}>{r.thumb ? <img src={r.thumb} alt="" className="dz-thumb" /> : <Thumb doc={r.doc} width={150} />}<small>{r.title}</small></button>
              <span className="dz-card__tools">
                <button type="button" className="ds-icon-btn" onClick={() => onOpen(r)} aria-label={`Open ${r.title}`}><FolderOpen size={14} /></button>
                <button type="button" className="ds-icon-btn" onClick={() => onOpen({ ...r, id: null, title: `${r.title} (copy)` })} aria-label={`Duplicate ${r.title}`}><Copy size={14} /></button>
                <button type="button" className="ds-icon-btn dz-danger" onClick={() => remove(r)} aria-label={`Delete ${r.title}`}><Trash2 size={14} /></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
};


/** How the design moves in a video: a preset for every layer, the camera and the pattern. */
export const MotionPanel = ({ doc, onChange, onPlay }) => {
  const m = doc.motion || {};
  const set = (patch) => onChange((d) => ({ ...d, motion: { ...d.motion, ...patch } }), { coalesce: 'motion' });
  return (
    <div className="dz-motion">
      <p className="ds-muted dz-small">How the words arrive when the design becomes a reel or video. Each choice sets every layer at once, then plays it; fine-tune any layer in its settings.</p>
      <div className="dz-presets">
        {MOTIONS.map((p) => (
          <button key={p.key} type="button" className={`dz-preset ${m.preset === p.key ? 'is-on' : ''}`} aria-pressed={m.preset === p.key}
            onClick={() => { onChange((d) => applyMotion(d, p.key)); setTimeout(() => onPlay?.(), 60); }}>
            <strong>{p.name}</strong><small>{p.note}</small>
          </button>
        ))}
      </div>
      <h4>Camera</h4>
      <div className="dz-seg" role="group" aria-label="Camera">
        {CAMERAS.map(([k, l]) => <button key={k} type="button" aria-pressed={(m.camera || 'push') === k} onClick={() => set({ camera: k })}>{l}</button>)}
      </div>
      <h4>Background</h4>
      <div className="dz-seg" role="group" aria-label="Background at the start">
        {INTROS.map(([k, l]) => <button key={k} type="button" aria-pressed={(m.intro || 'draw') === k} onClick={() => set({ intro: k })}>{l}</button>)}
      </div>
      <p className="ds-muted dz-small">Tip: put a word in *asterisks* to highlight it (in colour, with a marker or an underline; choose in the text’s settings). The highlight sweeps in after the words land.</p>
    </div>
  );
};
