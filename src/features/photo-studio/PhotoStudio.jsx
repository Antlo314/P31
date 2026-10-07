import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Eraser, Palette, Crop, Download, Save, Check, Wand2, AlertTriangle, X, Layers, Share2 } from 'lucide-react';
import { FILTERS, OUTPUTS, STAGES, drawBackdrop, subjectBox, cleanAlpha, placeSubject } from './stages';
import './PhotoStudio.css';

const MAX_EDGE = 2048;
const DEFAULT_ADJUST = { brightness: 100, contrast: 100, saturate: 100, warmth: 0, vignette: 0 };
const MAX_BATCH = 24;
const fmtMB = (b) => `${(b / 1048576).toFixed(1)} MB`;

const loadImage = async (file) => {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
};

/**
 * Product photo editor: background removal, auto-staging on backdrops,
 * looks & adjustments, framing for every channel.
 * onSave(blob, meta) — optional; shows a Save button (e.g. "Use this photo").
 * batchSave — also offer Save on every photo in a batch (e.g. Social drafts).
 * Batch mode: dial in a look on one photo, then apply it to many at once.
 */
const PhotoStudio = ({ initialFile, onSave, onClose, saveLabel = 'Save', batchSave = false }) => {
  const [source, setSource] = useState(null);     // canvas, downscaled original
  const [cutout, setCutout] = useState(null);     // canvas with alpha
  const [box, setBox] = useState(null);           // subject bounds in cutout
  const [stageId, setStageId] = useState('original');
  const [filterId, setFilterId] = useState('none');
  const [adjust, setAdjust] = useState(DEFAULT_ADJUST);
  const [outputId, setOutputId] = useState('1:1');
  const [size, setSize] = useState(1);
  const [lift, setLift] = useState(0);
  const [tab, setTab] = useState('background');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [fileName, setFileName] = useState('photo');
  const [batch, setBatch] = useState(null); // { items: [{ name, status, url, blob, saved }], running, text }

  const previewRef = useRef(null);
  const workerRef = useRef(null);

  const stage = STAGES.find((s) => s.id === stageId);
  const output = OUTPUTS.find((o) => o.id === outputId);

  const openFile = async (file) => {
    if (!file) return;
    setError(''); setCutout(null); setBox(null); setStageId('original'); setSaved(false);
    setFileName(file.name.replace(/\.[^.]+$/, '') || 'photo');
    try {
      setSource(await loadImage(file));
    } catch {
      setError('That image couldn’t be opened. Try a JPG, PNG or HEIC exported as JPG.');
    }
  };

  useEffect(() => {
    if (initialFile) Promise.resolve().then(() => openFile(initialFile));
  }, [initialFile]);
  useEffect(() => () => workerRef.current?.terminate(), []);
  const batchUrls = useRef([]);
  const releaseBatch = () => { batchUrls.current.forEach((u) => URL.revokeObjectURL(u)); batchUrls.current = []; };
  useEffect(() => () => releaseBatch(), []);

  // Cut the subject out of a photo on-device. onStatus(text, pct) reports progress.
  const cutOut = async (img, onStatus) => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('./bg.worker.js', import.meta.url), { type: 'module' });
    }
    const blob = await new Promise((r) => img.toBlob(r, 'image/png'));
    const files = {};
    return new Promise((resolve, reject) => {
      workerRef.current.onmessage = ({ data }) => {
        if (data.type === 'download') {
          files[data.file] = data;
          const loaded = Object.values(files).reduce((s, f) => s + f.loaded, 0);
          const total = Object.values(files).reduce((s, f) => s + f.total, 0);
          onStatus(`Downloading cut-out AI (one time) · ${fmtMB(loaded)} of ${fmtMB(total)}`, total ? loaded / total : -1);
        } else if (data.type === 'status') {
          onStatus(data.text, -1);
        } else if (data.type === 'done') {
          const c = document.createElement('canvas');
          c.width = data.width;
          c.height = data.height;
          const pixels = cleanAlpha(new ImageData(data.pixels, data.width, data.height));
          c.getContext('2d').putImageData(pixels, 0, 0);
          resolve({ cutout: c, box: subjectBox(pixels) });
        } else if (data.type === 'error') {
          reject(new Error(data.message));
        }
      };
      workerRef.current.postMessage({ blob });
    });
  };

  const removeBackground = async () => {
    setError('');
    setBusy({ text: 'Starting background removal…', pct: -1 });
    try {
      const out = await cutOut(source, (text, pct) => setBusy({ text, pct }));
      setCutout(out.cutout);
      setBox(out.box);
      setStageId('white');
    } catch (e) {
      setError(`Background removal failed: ${e.message}`);
    }
    setBusy(null);
  };

  const filterCss = useCallback(() => {
    const preset = FILTERS.find((f) => f.id === filterId)?.css || '';
    const a = adjust;
    return `${preset} brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturate}%) sepia(${a.warmth}%)`.trim();
  }, [filterId, adjust]);

  // Draw the finished photo at full output resolution, with the current look.
  const composeWith = useCallback((canvas, { source, cutout, box }) => {
    if (!source) return;
    const W = output.w;
    const H = output.h;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    if (stage.id === 'original' || !cutout) {
      // Cover-crop, centred on the subject when we know where it is.
      const scale = Math.max(W / source.width, H / source.height) * size;
      const sw = Math.min(source.width, W / scale);
      const sh = Math.min(source.height, H / scale);
      const fx = box ? (box.x + box.w / 2) * (source.width / cutout.width) : source.width / 2;
      const fy = box ? (box.y + box.h / 2) * (source.height / cutout.height) : source.height / 2;
      const sx = Math.max(0, Math.min(source.width - sw, fx - sw / 2));
      const sy = Math.max(0, Math.min(source.height - sh, fy - sh / 2 + lift * source.height));
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      ctx.filter = filterCss() || 'none';
      ctx.drawImage(source, sx, sy, sw, sh, (W - sw * scale) / 2, (H - sh * scale) / 2, sw * scale, sh * scale);
      ctx.restore();
    } else {
      drawBackdrop(ctx, stage, W, H);
      const p = placeSubject(box, stage, W, H, size, lift);
      const m = Math.max(W, H);

      if (stage.shadow !== false) {
        // Contact shadow where the product meets the floor.
        ctx.save();
        ctx.filter = `blur(${Math.round(m * 0.012)}px)`;
        const cy = p.y + p.h;
        const g = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, p.w * 0.55);
        g.addColorStop(0, stage.id === 'night' || stage.id === 'pedestal' ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.32)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(W / 2, cy, p.w * 0.55, Math.max(6, p.w * 0.07), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (stage.reflect) {
        // Soft mirror on glossy surfaces.
        const r = document.createElement('canvas');
        r.width = W; r.height = H;
        const rc = r.getContext('2d');
        rc.translate(0, 2 * (p.y + p.h));
        rc.scale(1, -1);
        rc.filter = filterCss() || 'none';
        rc.drawImage(cutout, box.x, box.y, box.w, box.h, p.x, p.y, p.w, p.h);
        rc.setTransform(1, 0, 0, 1, 0, 0);
        rc.filter = 'none';
        rc.globalCompositeOperation = 'destination-in';
        const fade = rc.createLinearGradient(0, p.y + p.h, 0, p.y + p.h + p.h * 0.35);
        fade.addColorStop(0, 'rgba(0,0,0,0.22)');
        fade.addColorStop(1, 'rgba(0,0,0,0)');
        rc.fillStyle = fade;
        rc.fillRect(0, 0, W, H);
        ctx.drawImage(r, 0, 0);
      }

      ctx.save();
      ctx.filter = filterCss() || 'none';
      if (stage.shadow !== false) {
        ctx.shadowColor = 'rgba(0,0,0,0.22)';
        ctx.shadowBlur = m * 0.03;
        ctx.shadowOffsetY = m * 0.012;
      }
      ctx.drawImage(cutout, box.x, box.y, box.w, box.h, p.x, p.y, p.w, p.h);
      ctx.restore();
    }

    if (adjust.vignette > 0) {
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(0,0,0,${adjust.vignette / 100})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    }
  }, [stage, output, size, lift, adjust.vignette, filterCss]);

  const compose = useCallback((canvas) => composeWith(canvas, { source, cutout, box }), [composeWith, source, cutout, box]);

  useEffect(() => {
    if (!previewRef.current) return undefined;
    const id = requestAnimationFrame(() => compose(previewRef.current));
    return () => cancelAnimationFrame(id);
  }, [compose]);

  const toBlob = (c) => new Promise((resolve) => c.toBlob(resolve, stage.id === 'transparent' ? 'image/png' : 'image/jpeg', 0.9));
  const exportBlob = () => {
    const c = document.createElement('canvas');
    compose(c);
    return toBlob(c);
  };
  const extOf = (blob) => (blob.type === 'image/png' ? 'png' : 'jpg');

  // ── Batch: same stage, look and framing on many photos ──
  const runBatch = async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith('image/')).slice(0, MAX_BATCH);
    if (!files.length) return;
    releaseBatch();
    const items = files.map((f) => ({ name: f.name.replace(/\.[^.]+$/, '') || 'photo', status: 'waiting' }));
    const needsCutout = stage.id !== 'original';
    setError('');
    setBatch({ items, running: true, text: '' });
    const update = (i, patch) => {
      items[i] = { ...items[i], ...patch };
      setBatch((b) => ({ ...b, items: [...items] }));
    };
    for (const [i, file] of files.entries()) {
      update(i, { status: 'working' });
      try {
        const src = await loadImage(file);
        let photo = { source: src, cutout: null, box: null };
        if (needsCutout) {
          const out = await cutOut(src, (text) => setBatch((b) => ({ ...b, text: `Photo ${i + 1} of ${files.length} · ${text}` })));
          photo = { source: src, ...out };
        }
        setBatch((b) => ({ ...b, text: `Photo ${i + 1} of ${files.length} · finishing` }));
        const c = document.createElement('canvas');
        composeWith(c, photo);
        const blob = await toBlob(c);
        const url = URL.createObjectURL(blob);
        batchUrls.current.push(url);
        update(i, { status: 'done', blob, url });
      } catch {
        update(i, { status: 'error' });
      }
    }
    setBatch((b) => ({ ...b, running: false, text: '' }));
  };

  const batchDone = batch?.items.filter((it) => it.status === 'done') || [];
  const batchFiles = () => batchDone.map((it) => new File([it.blob], `${it.name}-p31.${extOf(it.blob)}`, { type: it.blob.type }));

  const downloadAll = async () => {
    for (const it of batchDone) {
      Object.assign(document.createElement('a'), { href: it.url, download: `${it.name}-p31.${extOf(it.blob)}` }).click();
      await new Promise((r) => setTimeout(r, 350)); // browsers drop rapid-fire downloads
    }
  };

  const shareAll = async () => {
    try { await navigator.share({ files: batchFiles(), title: 'P31 photos' }); } catch { /* closed */ }
  };

  const saveBatchItem = async (i) => {
    const it = batch.items[i];
    try {
      await onSave(it.blob, { name: `${it.name}-p31.${extOf(it.blob)}`, stage: stage.id, filter: filterId, output: output.id });
      setBatch((b) => ({ ...b, items: b.items.map((x, k) => (k === i ? { ...x, saved: true } : x)) }));
    } catch (e) {
      setError(`Couldn’t save: ${e.message}`);
    }
  };

  const download = async () => {
    const blob = await exportBlob();
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `${fileName}-p31.${extOf(blob)}`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const save = async () => {
    try {
      const blob = await exportBlob();
      await onSave(blob, { name: `${fileName}-p31.${extOf(blob)}`, stage: stage.id, filter: filterId, output: output.id });
      setSaved(true);
    } catch (e) {
      setError(`Couldn’t save: ${e.message}`);
    }
  };

  if (!source) {
    return (
      <div className="ps">
        {onClose && <button className="ps-close" onClick={onClose} aria-label="Close"><X size={18} /></button>}
        {error && <p className="ps-error"><AlertTriangle size={16} /> {error}</p>}
        <label className="ps-drop">
          <ImagePlus size={28} />
          <strong>Choose a product photo</strong>
          <span>Remove the background, stage it, add a look — all on your device.</span>
          <input type="file" accept="image/*" hidden onChange={(e) => openFile(e.target.files[0])} />
        </label>
      </div>
    );
  }

  return (
    <div className="ps">
      {onClose && <button className="ps-close" onClick={onClose} aria-label="Close"><X size={18} /></button>}

      <div className="ps-preview">
        <canvas ref={previewRef} className={stage.id === 'transparent' ? 'is-checker' : ''} />
        {busy && (
          <div className="ps-busy">
            <div className="ps-spinner" />
            <span>{busy.text}</span>
            {busy.pct >= 0 && <div className="ps-progress"><span style={{ width: `${Math.round(busy.pct * 100)}%` }} /></div>}
          </div>
        )}
      </div>

      {error && <p className="ps-error"><AlertTriangle size={16} /> {error}</p>}

      <div className="ps-tabs" role="tablist">
        {[{ id: 'background', Icon: Eraser, label: 'Background' }, { id: 'look', Icon: Palette, label: 'Look' }, { id: 'frame', Icon: Crop, label: 'Frame' }].map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => setTab(t.id)}>
            <t.Icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'background' && (
        <div className="ps-panel">
          {!cutout ? (
            <button className="ps-btn ps-btn--gold" onClick={removeBackground} disabled={!!busy}>
              <Wand2 size={18} /> Remove background
            </button>
          ) : (
            <p className="ps-note"><Check size={14} /> Background removed — pick a stage. The product is placed and shadowed automatically.</p>
          )}
          <div className="ps-stages">
            {STAGES.filter((s) => cutout || s.id === 'original').map((s) => (
              <button key={s.id} className={`ps-stage ps-stage--${s.id} ${stageId === s.id ? 'is-on' : ''}`} onClick={() => setStageId(s.id)}>
                <span className="ps-stage__sw" />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'look' && (
        <div className="ps-panel">
          <div className="ps-filters">
            {FILTERS.map((f) => (
              <button key={f.id} className={`ps-chip ${filterId === f.id ? 'is-on' : ''}`} onClick={() => setFilterId(f.id)}>{f.name}</button>
            ))}
          </div>
          {[['brightness', 'Brightness', 60, 140], ['contrast', 'Contrast', 60, 140], ['saturate', 'Saturation', 0, 200], ['warmth', 'Warmth', 0, 60], ['vignette', 'Vignette', 0, 60]].map(([k, label, min, max]) => (
            <label className="ps-slider" key={k}>
              <span>{label}</span>
              <input type="range" min={min} max={max} value={adjust[k]} onChange={(e) => setAdjust({ ...adjust, [k]: +e.target.value })} />
            </label>
          ))}
          <button className="ps-linkbtn" onClick={() => { setAdjust(DEFAULT_ADJUST); setFilterId('none'); }}>Reset look</button>
        </div>
      )}

      {tab === 'frame' && (
        <div className="ps-panel">
          <div className="ps-outputs">
            {OUTPUTS.map((o) => (
              <button key={o.id} className={`ps-chip ${outputId === o.id ? 'is-on' : ''}`} onClick={() => setOutputId(o.id)}>
                <strong>{o.id}</strong> <span>{o.note}</span>
              </button>
            ))}
          </div>
          <label className="ps-slider">
            <span>{stage.id === 'original' ? 'Zoom' : 'Product size'}</span>
            <input type="range" min="0.6" max={stage.id === 'original' ? 2.5 : 1.3} step="0.01" value={size} onChange={(e) => setSize(+e.target.value)} />
          </label>
          <label className="ps-slider">
            <span>{stage.id === 'original' ? 'Move up / down' : 'Lift'}</span>
            <input type="range" min="-0.2" max="0.2" step="0.005" value={lift} onChange={(e) => setLift(+e.target.value)} />
          </label>
        </div>
      )}

      <div className="ps-bar">
        <label className="ps-btn ps-btn--ghost">
          <ImagePlus size={16} /> New
          <input type="file" accept="image/*" hidden onChange={(e) => openFile(e.target.files[0])} />
        </label>
        <button className="ps-btn ps-btn--ghost" onClick={download}><Download size={16} /> Download</button>
        {!onClose && (
          <label className={`ps-btn ps-btn--ghost ${batch?.running || busy ? 'is-disabled' : ''}`}>
            <Layers size={16} /> Apply to more photos
            <input type="file" accept="image/*" multiple hidden disabled={!!batch?.running || !!busy}
              onChange={(e) => { runBatch(e.target.files); e.target.value = ''; }} />
          </label>
        )}
        {onSave && (
          <button className="ps-btn ps-btn--gold" onClick={save} disabled={saved || !!busy}>
            {saved ? <><Check size={16} /> Saved</> : <><Save size={16} /> {saveLabel}</>}
          </button>
        )}
      </div>

      {batch && (
        <section className="ps-batch" aria-live="polite">
          <header>
            <strong><Layers size={16} /> Batch · {batchDone.length} of {batch.items.length} ready</strong>
            {!batch.running && <button className="ps-linkbtn" onClick={() => { releaseBatch(); setBatch(null); }}>Clear</button>}
          </header>
          <p className="ps-note">
            {batch.running ? batch.text || 'Working…' : 'Same stage, look and framing as the photo above.'}
          </p>
          <div className="ps-batch__grid">
            {batch.items.map((it, i) => (
              <figure key={`${it.name}-${i}`} className={`ps-batch__item is-${it.status}`}>
                {it.url ? <img src={it.url} alt={it.name} /> : <span className="ps-batch__ph">{it.status === 'error' ? 'Failed' : it.status === 'working' ? <span className="ps-spinner" /> : 'Waiting'}</span>}
                {it.url && (
                  <figcaption>
                    <a href={it.url} download={`${it.name}-p31.${extOf(it.blob)}`} aria-label={`Download ${it.name}`}><Download size={14} /></a>
                    {onSave && batchSave && (
                      <button onClick={() => saveBatchItem(i)} disabled={it.saved} aria-label={`${saveLabel}: ${it.name}`}>
                        {it.saved ? <Check size={14} /> : <Save size={14} />}
                      </button>
                    )}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
          {!batch.running && batchDone.length > 0 && (
            <div className="ps-bar">
              {navigator.canShare?.({ files: batchFiles() }) && (
                <button className="ps-btn ps-btn--gold" onClick={shareAll}><Share2 size={16} /> Save / share all</button>
              )}
              <button className="ps-btn ps-btn--ghost" onClick={downloadAll}><Download size={16} /> Download all</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default PhotoStudio;
