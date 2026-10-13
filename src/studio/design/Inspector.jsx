import React from 'react';
import { AlignLeft, AlignCenter, AlignRight, Copy, Trash2, ArrowUp, ArrowDown, Lock, Unlock, Eye, EyeOff, Shuffle, ImagePlus, X, Italic, CaseUpper } from 'lucide-react';
import { FONTS, FONT_NAMES, weightsOf, nearestWeight, hasItalic } from './fonts';
import { SWATCHES } from './brand';
import { PATTERN_KINDS } from './patterns';
import { ANIMS } from './draw';
import { readImage, highlightLongest } from './util';
import { videoLength } from './export';

const Field = ({ label, children, row }) => <label className={`dz-field ${row ? 'dz-field--row' : ''}`}><span>{label}</span>{children}</label>;
const Range = ({ value, min, max, step = 1, onChange, suffix = '' }) => (
  <span className="dz-range">
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    <output>{Math.round(value * 100) / 100}{suffix}</output>
  </span>
);
export const Swatches = ({ value, onChange, allowNone = false, label = 'Colour' }) => (
  <div className="dz-swatches" role="group" aria-label={label}>
    {allowNone && <button type="button" className={`dz-sw dz-sw--none ${!value ? 'is-on' : ''}`} onClick={() => onChange(null)} aria-label="None"><X size={12} /></button>}
    {SWATCHES.map((c) => <button key={c} type="button" className={`dz-sw ${value?.toUpperCase() === c ? 'is-on' : ''}`} style={{ background: c }} onClick={() => onChange(c)} aria-label={c} />)}
    <input type="color" value={value || '#ffffff'} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label="Custom colour" />
  </div>
);
const Seg = ({ value, options, onChange, label }) => (
  <div className="dz-seg" role="group" aria-label={label}>
    {options.map((o) => { const Icon = o[2]; return <button key={o[0]} type="button" aria-pressed={value === o[0]} onClick={() => onChange(o[0])} title={o[1]}>{Icon ? <Icon size={15} /> : o[1]}</button>; })}
  </div>
);

const Motion = ({ l, set }) => (
  <>
    <Field label="Entrance (video)">
      <select className="k-input" value={l.anim || 'rise'} onChange={(e) => set({ anim: e.target.value })}>{ANIMS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
    </Field>
    <Field label="Starts at"><Range value={l.delay ?? 0.4} min={0} max={8} step={0.1} onChange={(v) => set({ delay: v })} suffix="s" /></Field>
  </>
);

/** Everything about the selected layer, or the page when nothing is selected. */
const Inspector = ({ doc, selected, onChange, onLayer, onSelect }) => {
  const l = doc.layers.find((x) => x.id === selected);
  const set = (patch) => onChange((d) => ({ ...d, layers: d.layers.map((x) => (x.id === selected ? { ...x, ...patch } : x)) }), { coalesce: `${selected}-${Object.keys(patch).join()}` });
  const page = (patch, key) => onChange((d) => ({ ...d, ...patch(d) }), { coalesce: key });

  if (!l) {
    const p = doc.pattern || {};
    const setP = (patch) => page((d) => ({ pattern: { ...d.pattern, ...patch } }), `pattern-${Object.keys(patch).join()}`);
    return (
      <div className="dz-insp">
        <h3>Page</h3>
        <Field label="Background"><Swatches value={doc.bg?.color} onChange={(c) => page((d) => ({ bg: { ...d.bg, color: c } }), 'bg')} /></Field>
        <Field label="Blend into (gradient)"><Swatches allowNone value={doc.bg?.color2} onChange={(c) => page((d) => ({ bg: { ...d.bg, color2: c } }), 'bg2')} /></Field>
        {doc.bg?.color2 && <Field label="Gradient angle"><Range value={doc.bg.angle ?? 160} min={0} max={360} onChange={(v) => page((d) => ({ bg: { ...d.bg, angle: v } }), 'angle')} suffix="°" /></Field>}
        <Field label="Pattern">
          <select className="k-input" value={p.kind || 'none'} onChange={(e) => setP({ kind: e.target.value })}>{PATTERN_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
        </Field>
        {p.kind && p.kind !== 'none' && <>
          <Field label="Pattern colour"><Swatches value={p.color} onChange={(c) => setP({ color: c })} /></Field>
          <Field label="Strength"><Range value={p.opacity ?? 1} min={0.05} max={1} step={0.05} onChange={(v) => setP({ opacity: v })} /></Field>
          <Field label="Line weight"><Range value={p.weight ?? 1} min={0.3} max={3} step={0.05} onChange={(v) => setP({ weight: v })} /></Field>
          <Field label="How many"><Range value={p.density ?? 1} min={0.4} max={2} step={0.05} onChange={(v) => setP({ density: v })} /></Field>
          <Field label="Size"><Range value={p.scale ?? 1} min={0.4} max={2.5} step={0.05} onChange={(v) => setP({ scale: v })} /></Field>
          <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => setP({ seed: Math.floor(Math.random() * 9999) })}><Shuffle size={14} /> New pattern</button>
        </>}
        <Field label="Photo behind everything">
          <span className="dz-inline">
            <label className="k-btn k-btn--ghost k-btn--sm"><ImagePlus size={14} /> {doc.photo?.src ? 'Replace' : 'Add photo'}
              <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const img = await readImage(f, 2000); page((d) => ({ photo: { dim: 0.35, tint: '#1E0F1C', ...d.photo, src: img.src } }), 'photo'); }} />
            </label>
            {doc.photo?.src && <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => page(() => ({ photo: null }), 'photo')}>Remove</button>}
          </span>
        </Field>
        {doc.photo?.src && <>
          <Field label="Darken the photo"><Range value={doc.photo.dim ?? 0.35} min={0} max={0.9} step={0.05} onChange={(v) => page((d) => ({ photo: { ...d.photo, dim: v } }), 'dim')} /></Field>
          <Field label="Tint"><Swatches value={doc.photo.tint} onChange={(c) => page((d) => ({ photo: { ...d.photo, tint: c } }), 'tint')} /></Field>
        </>}
        <Field label="Video length"><Range value={videoLength(doc)} min={5} max={30} onChange={(v) => page((d) => ({ motion: { ...d.motion, duration: v } }), 'dur')} suffix="s" /></Field>
        <h3>Layers</h3>
        <ul className="dz-layers">
          {[...doc.layers].reverse().map((x) => (
            <li key={x.id}><button type="button" onClick={() => onSelect(x.id)}>{x.hidden ? <EyeOff size={13} /> : null}{x.name || x.type}<small>{x.type === 'text' ? String(x.text).slice(0, 28) : x.shape || ''}</small></button></li>
          ))}
          {!doc.layers.length && <li className="ds-muted">Nothing on the page yet. Add text or an element.</li>}
        </ul>
      </div>
    );
  }

  return (
    <div className="dz-insp">
      <div className="dz-insp__head">
        <h3>{l.name || l.type}</h3>
        <span className="dz-insp__tools">
          <button type="button" className="ds-icon-btn" onClick={() => onLayer('duplicate')} aria-label="Duplicate" title="Duplicate (Ctrl+D)"><Copy size={15} /></button>
          <button type="button" className="ds-icon-btn" onClick={() => onLayer('up')} aria-label="Bring forward" title="Bring forward"><ArrowUp size={15} /></button>
          <button type="button" className="ds-icon-btn" onClick={() => onLayer('down')} aria-label="Send backward" title="Send backward"><ArrowDown size={15} /></button>
          <button type="button" className="ds-icon-btn" onClick={() => set({ locked: !l.locked })} aria-label={l.locked ? 'Unlock' : 'Lock'} title={l.locked ? 'Unlock' : 'Lock in place'}>{l.locked ? <Lock size={15} /> : <Unlock size={15} />}</button>
          <button type="button" className="ds-icon-btn" onClick={() => set({ hidden: !l.hidden })} aria-label={l.hidden ? 'Show' : 'Hide'} title={l.hidden ? 'Show' : 'Hide'}>{l.hidden ? <EyeOff size={15} /> : <Eye size={15} />}</button>
          <button type="button" className="ds-icon-btn dz-danger" onClick={() => onLayer('delete')} aria-label="Delete layer" title="Delete (Del)"><Trash2 size={15} /></button>
        </span>
      </div>

      {l.type === 'text' && <>
        <Field label="Words"><textarea id={`dz-text-${l.id}`} className="k-input dz-textarea" value={l.text} rows={Math.min(8, Math.max(2, Math.ceil(String(l.text).length / 28)))} onChange={(e) => set({ text: e.target.value })} /></Field>
        <Field label="Font">
          <select className="k-input" value={l.font} onChange={(e) => set({ font: e.target.value, weight: nearestWeight(e.target.value, l.weight || 400), italic: l.italic && hasItalic(e.target.value) })} style={{ fontFamily: `"${l.font}"` }}>
            {FONT_NAMES.map((f) => <option key={f} value={f} style={{ fontFamily: `"${f}"` }}>{FONTS[f].label} · {FONTS[f].kind}</option>)}
          </select>
        </Field>
        <div className="dz-two">
          <Field label="Weight">
            <select className="k-input" value={nearestWeight(l.font, l.weight || 400)} onChange={(e) => set({ weight: Number(e.target.value) })}>{weightsOf(l.font).map((wt) => <option key={wt} value={wt}>{wt}</option>)}</select>
          </Field>
          <Field label="Size"><input className="k-input" type="number" min={8} max={400} value={l.size} onChange={(e) => set({ size: Math.max(8, Number(e.target.value) || 8) })} /></Field>
        </div>
        <div className="dz-inline">
          <Seg label="Alignment" value={l.align || 'left'} onChange={(v) => set({ align: v })} options={[['left', 'Left', AlignLeft], ['center', 'Centre', AlignCenter], ['right', 'Right', AlignRight]]} />
          <button type="button" className="dz-toggle" aria-pressed={!!l.upper} onClick={() => set({ upper: !l.upper })} title="All caps"><CaseUpper size={16} /></button>
          {hasItalic(l.font) && <button type="button" className="dz-toggle" aria-pressed={!!l.italic} onClick={() => set({ italic: !l.italic })} title="Italic"><Italic size={16} /></button>}
        </div>
        <Field label="Colour"><Swatches value={l.color} onChange={(c) => set({ color: c, role: null })} /></Field>
        <div className="dz-field"><span>Highlighted words (put them in *asterisks*)</span>
          <Seg label="Highlight style" value={l.emph || 'color'} onChange={(v) => set({ emph: v })} options={[['color', 'Colour'], ['marker', 'Marker'], ['underline', 'Underline']]} />
          {(l.emph || 'color') === 'marker'
            ? <Swatches value={l.markColor} onChange={(c) => set({ markColor: c })} label="Marker colour" />
            : <Swatches value={l.emColor} onChange={(c) => set({ emColor: c, emRole: null })} label="Highlight colour" />}
          {!String(l.text).includes('*') && <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => set({ text: highlightLongest(l.text) })}>Highlight the longest word</button>}
        </div>
        <Field label="Box behind the words"><Swatches allowNone value={l.bg} onChange={(c) => set({ bg: c, bgRole: null })} /></Field>
        <Field label="Letter spacing"><Range value={l.spacing || 0} min={-6} max={50} onChange={(v) => set({ spacing: v })} /></Field>
        <Field label="Line height"><Range value={l.lh || 1.15} min={0.75} max={2} step={0.01} onChange={(v) => set({ lh: v })} /></Field>
        <Field label="Shrink long text to fit" row>
          <input type="checkbox" checked={!!l.fit} onChange={(e) => set(e.target.checked ? { fit: true, h: l.h || Math.round(l.size * (l.lh || 1.15) * 4) } : { fit: false })} />
        </Field>
        {l.fit && <Field label="Fit within (height)"><Range value={l.h || 400} min={60} max={1600} step={10} onChange={(v) => set({ h: v })} suffix="px" /></Field>}
      </>}

      {l.type === 'shape' && <>
        <Field label="Fill"><Swatches allowNone value={l.fill} onChange={(c) => set({ fill: c, fillRole: null })} /></Field>
        <Field label="Outline"><Swatches allowNone value={l.stroke} onChange={(c) => set({ stroke: c, strokeRole: null })} /></Field>
        <Field label="Outline width"><Range value={l.strokeW || 3} min={1} max={30} onChange={(v) => set({ strokeW: v })} /></Field>
        {l.shape === 'rect' && <Field label="Rounded corners"><Range value={l.radius || 0} min={0} max={300} onChange={(v) => set({ radius: v })} /></Field>}
        <Field label="Turn"><Range value={l.rotate || 0} min={-180} max={180} onChange={(v) => set({ rotate: v })} suffix="°" /></Field>
      </>}

      {l.type === 'image' && <>
        <Field label="Picture">
          <label className="k-btn k-btn--ghost k-btn--sm"><ImagePlus size={14} /> Replace
            <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const img = await readImage(f); set({ src: img.src, mark: false, h: Math.round(l.w * (img.h / img.w)) }); }} />
          </label>
        </Field>
        <Field label="Show the whole picture" row><input type="checkbox" checked={!!l.contain} onChange={(e) => set({ contain: e.target.checked })} /></Field>
        {!l.contain && <Field label="Rounded corners"><Range value={l.radius || 0} min={0} max={600} onChange={(v) => set({ radius: v })} /></Field>}
        <Field label="Turn"><Range value={l.rotate || 0} min={-180} max={180} onChange={(v) => set({ rotate: v })} suffix="°" /></Field>
      </>}

      <Field label="See-through"><Range value={l.opacity ?? 1} min={0.05} max={1} step={0.05} onChange={(v) => set({ opacity: v })} /></Field>
      <Motion l={l} set={set} />
      <p className="ds-muted dz-tip">Drag on the page to move it, the right edge to change its width, the corner to resize. Arrow keys nudge (Shift for 10). Double-click words to edit them.</p>
    </div>
  );
};

export default Inspector;
