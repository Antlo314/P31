import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { drawDesign, sizeOf } from './draw';
import { prepare } from './export';

const SNAP = 10;

/**
 * The page being designed: the canvas, plus an overlay for picking, dragging and resizing layers
 * (with centre guides). `time` (seconds) plays the entrances instead; the overlay hides then.
 */
const Stage = ({ doc, selected, onSelect, onChange, onEditText, time = null, maxHeight = 720 }) => {
  const wrap = useRef(null);
  const canvas = useRef(null);
  const [scale, setScale] = useState(0.4);
  const [boxes, setBoxes] = useState({});
  const [guides, setGuides] = useState({ x: false, y: false });
  const drag = useRef(null);
  const { w, h } = sizeOf(doc);

  // Fit the page to the space (width first, never taller than maxHeight).
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const fit = () => setScale(Math.min((el.clientWidth || w) / w, maxHeight / h));
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [w, h, maxHeight]);

  // Draw now, and again once its fonts and pictures have loaded.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return undefined;
    let live = true;
    const paint = () => { if (live) setBoxes(drawDesign(c.getContext('2d'), doc, time)); };
    paint();
    if (time == null) prepare(doc).then(paint);
    return () => { live = false; };
  }, [doc, time]);

  const toDoc = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };
  const layerOf = (id) => doc.layers.find((l) => l.id === id);

  const start = (e, id, mode = 'move') => {
    e.stopPropagation();
    if (e.button !== undefined && e.button !== 0) return;
    onSelect(id);
    const l = layerOf(id); const b = boxes[id];
    if (!l || !b || l.locked) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { id, mode, from: toDoc(e), box: { ...b }, layer: l, moved: false };
  };
  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = toDoc(e);
    let dx = p.x - d.from.x; let dy = p.y - d.from.y;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 3 / scale) return;
    d.moved = true;
    const { box, layer } = d;
    if (d.mode === 'move') {
      // Snap the layer's centre to the page's centre lines.
      const cx = box.x + dx + box.w / 2; const cy = box.y + dy + box.h / 2;
      const sx = Math.abs(cx - w / 2) < SNAP / scale * 0.5 + 4; const sy = Math.abs(cy - h / 2) < SNAP / scale * 0.5 + 4;
      if (sx) dx = w / 2 - box.w / 2 - box.x;
      if (sy) dy = h / 2 - box.h / 2 - box.y;
      setGuides({ x: sx, y: sy });
      const y = box.y + dy;
      onChange((doc0) => ({
        ...doc0,
        layers: doc0.layers.map((l) => (l.id !== d.id ? l : {
          ...l, x: Math.round(box.x + dx),
          // A moved layer stands on its own: no pin, and its y is its top edge.
          y: Math.round(l.type === 'text' && l.anchor === 'middle' ? y + box.h / 2 : l.type === 'text' && l.anchor === 'bottom' ? y + box.h : y),
          ...(l.pin ? { pin: null } : {}),
        })),
      }), { coalesce: `move-${d.id}` });
    } else {
      const nw = Math.max(40, box.w + dx);
      onChange((doc0) => ({
        ...doc0,
        layers: doc0.layers.map((l) => {
          if (l.id !== d.id) return l;
          if (l.type === 'text') {
            if (d.mode === 'corner') { const k = nw / box.w; return { ...l, w: Math.round(nw), size: Math.max(8, Math.round(layer.size * k)), ...(l.h ? { h: Math.round(layer.h * k) } : {}) }; }
            return { ...l, w: Math.round(nw) };
          }
          const nh = l.type === 'image' && !e.shiftKey ? nw * (box.h / box.w) : Math.max(4, box.h + dy);
          return { ...l, w: Math.round(nw), h: Math.round(nh) };
        }),
      }), { coalesce: `size-${d.id}` });
    }
  };
  const end = () => { drag.current = null; setGuides({ x: false, y: false }); };

  const sel = selected && boxes[selected] && time == null ? boxes[selected] : null;
  const selLayer = selected ? layerOf(selected) : null;
  return (
    <div className="dz-stage" ref={wrap}>
      <div className="dz-page" style={{ width: w * scale, height: h * scale }}>
        <canvas ref={canvas} width={w} height={h} style={{ width: w * scale, height: h * scale }} aria-label="Design canvas" />
        {time == null && (
          <div className="dz-overlay" onPointerDown={() => onSelect(null)} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
            {doc.layers.map((l) => {
              const b = boxes[l.id];
              if (!b || l.hidden) return null;
              return (
                <button key={l.id} type="button" className={`dz-hit ${selected === l.id ? 'is-on' : ''}`} aria-label={`Select ${l.name || l.type}`}
                  style={{ left: b.x * scale, top: b.y * scale, width: Math.max(12, b.w * scale), height: Math.max(12, b.h * scale) }}
                  onPointerDown={(e) => start(e, l.id)} onDoubleClick={() => l.type === 'text' && onEditText?.(l.id)} />
              );
            })}
            {sel && (
              <div className="dz-sel" style={{ left: sel.x * scale, top: sel.y * scale, width: sel.w * scale, height: sel.h * scale }}>
                {!selLayer?.locked && <>
                  <span className="dz-handle dz-handle--e" onPointerDown={(e) => start(e, selected, 'width')} title="Drag to change the width" />
                  <span className="dz-handle dz-handle--se" onPointerDown={(e) => start(e, selected, 'corner')} title={selLayer?.type === 'text' ? 'Drag to resize the text' : 'Drag to resize'} />
                </>}
              </div>
            )}
            {guides.x && <span className="dz-guide dz-guide--x" />}
            {guides.y && <span className="dz-guide dz-guide--y" />}
          </div>
        )}
      </div>
    </div>
  );
};

export default Stage;
