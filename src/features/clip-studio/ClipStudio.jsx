import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Film, X, ChevronUp, ChevronDown, Wand2, Captions, Music2, Scissors, Download, Share2, RotateCcw, Save, Check, AlertTriangle, Stamp } from 'lucide-react';
import { CLIP_STYLES, ASPECTS, LENGTHS } from './styles';
import { probeVideo, decodeForMix, toAnalysisPcm, findActiveRanges, buildTimeline, timelinePcm, mapToOutput, pageCaptions, MAX_FILE_BYTES } from './analyze';
import { renderClip, canRender } from './render';
import './ClipStudio.css';

const MAX_CLIPS = 12;
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const fmtMB = (b) => `${(b / 1048576).toFixed(b > 10485760 ? 0 : 1)} MB`;
const BRAND_KEY = 'p31_clip_brand_v1';
const CORNERS = [['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right']];

const loadImage = (src, cors) => new Promise((resolve, reject) => {
  const img = new Image();
  if (cors) img.crossOrigin = 'anonymous';
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Image could not be loaded'));
  img.src = src;
});

// Shrink a logo to 480px or less and return it as a PNG data URL (keeps transparency).
const shrinkLogo = (img) => {
  const k = Math.min(1, 480 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
};

// Re-time an edited caption line evenly across its original span.
const retimePage = (page, text) => {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  const step = (page.end - page.start) / tokens.length;
  return { ...page, words: tokens.map((t, i) => ({ text: t, start: page.start + i * step, end: page.start + (i + 1) * step })) };
};

/**
 * Mobile-first auto editor. Raw footage in → cut, transitioned, captioned clip out.
 * onSave(blob, meta) is optional; when given, a "Save" button appears.
 */
const ClipStudio = ({ onSave, saveLabel = 'Save', initialFiles, brandLogo }) => {
  const [clips, setClips] = useState([]);
  const [styleId, setStyleId] = useState('clean');
  const [aspectId, setAspectId] = useState('9:16');
  const [length, setLength] = useState(30);
  const [captions, setCaptions] = useState(true);
  const [removeSilence, setRemoveSilence] = useState(true);
  const [title, setTitle] = useState('');
  const [music, setMusic] = useState(null);
  const [levels, setLevels] = useState({ voice: 1, music: 0.6 });

  const [phase, setPhase] = useState('setup'); // setup | working | review | rendering | done
  const [progress, setProgress] = useState({ stage: '', pct: 0 });
  const [error, setError] = useState('');
  const [pages, setPages] = useState([]);
  const [results, setResults] = useState([]); // one finished video per size
  const [saved, setSaved] = useState([]); // indexes of saved results
  const [extraAspects, setExtraAspects] = useState([]);
  const [brand, setBrand] = useState(null); // { src, img }
  const [brandCorner, setBrandCorner] = useState('tr');

  const audioCtxRef = useRef(null);
  const analysisRef = useRef(new Map()); // clip id → { buffer, pcm }
  const captionCache = useRef(new Map()); // timeline signature → words
  const timelineRef = useRef(null);
  const canvasRef = useRef(null);
  const abortRef = useRef(null);
  const workerRef = useRef(null);

  const style = CLIP_STYLES.find((s) => s.id === styleId);
  const aspect = ASPECTS.find((a) => a.id === aspectId);
  const supported = useMemo(() => canRender(), []);
  const rawTotal = clips.reduce((s, c) => s + (c.duration || 0), 0);
  const extraCount = extraAspects.filter((x) => x !== aspectId).length;

  useEffect(() => () => {
    clips.forEach((c) => URL.revokeObjectURL(c.url));
    workerRef.current?.terminate();
    audioCtxRef.current?.close?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Finished videos stay playable until the next render or leaving the page.
  const resultUrls = useRef([]);
  const releaseResults = () => { resultUrls.current.forEach((u) => URL.revokeObjectURL(u)); resultUrls.current = []; };
  useEffect(() => () => releaseResults(), []);

  // Brand mark: the last logo used on this device, else the shop's logo.
  useEffect(() => {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(BRAND_KEY) || 'null'); } catch { /* storage blocked */ }
    const src = stored?.src || brandLogo;
    if (!src) return;
    loadImage(src, !stored?.src)
      .then((img) => {
        const data = stored?.src ? src : shrinkLogo(img); // throws if the host blocks canvas use
        return loadImage(data).then((ready) => {
          setBrand({ src: data, img: ready });
          if (stored?.corner) setBrandCorner(stored.corner);
        });
      })
      .catch(() => {});
  }, [brandLogo]);

  const rememberBrand = (next, corner) => {
    try {
      if (next) localStorage.setItem(BRAND_KEY, JSON.stringify({ src: next.src, corner }));
      else localStorage.removeItem(BRAND_KEY);
    } catch { /* storage full or blocked */ }
  };

  const pickBrand = async (file) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const data = shrinkLogo(await loadImage(url));
      const next = { src: data, img: await loadImage(data) };
      setBrand(next);
      rememberBrand(next, brandCorner);
    } catch {
      setError('That logo couldn’t be read. Try a PNG with a transparent background.');
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  // Footage handed in by the host page (e.g. a share target or test harness).
  useEffect(() => {
    if (initialFiles?.length) Promise.resolve().then(() => addFiles(initialFiles));
  }, [initialFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  const ensureAudio = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  // ── Footage ─────────────────────────────────────────────
  const addFiles = async (fileList) => {
    setError('');
    const files = [...fileList].filter((f) => f.type.startsWith('video/') || /\.(mov|mp4|m4v|webm)$/i.test(f.name));
    const room = MAX_CLIPS - clips.length;
    for (const file of files.slice(0, room)) {
      if (file.size > MAX_FILE_BYTES) {
        setError(`${file.name} is ${fmtMB(file.size)} — export it at 1080p (or trim it) and try again.`);
        continue;
      }
      const url = URL.createObjectURL(file);
      const id = `${file.name}-${file.size}-${file.lastModified}`;
      try {
        const meta = await probeVideo(url);
        setClips((cs) => (cs.some((c) => c.id === id) ? cs : [...cs, { id, file, url, name: file.name, size: file.size, ...meta }]));
      } catch (e) {
        URL.revokeObjectURL(url);
        setError(`${file.name}: ${e.message}`);
      }
    }
  };

  const move = (i, d) => setClips((cs) => {
    const next = [...cs];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return next;
  });

  const removeClip = (id) => setClips((cs) => {
    const c = cs.find((x) => x.id === id);
    if (c) URL.revokeObjectURL(c.url);
    analysisRef.current.delete(id);
    return cs.filter((x) => x.id !== id);
  });

  const pickMusic = async (file) => {
    if (!file) return setMusic(null);
    const ctx = ensureAudio();
    const buffer = await decodeForMix(file, ctx);
    if (!buffer) return setError('That music file couldn’t be read. Try an MP3 or M4A.');
    setMusic({ name: file.name, buffer });
  };

  // ── Pipeline ────────────────────────────────────────────
  const transcribe = (pcm) => new Promise((resolve, reject) => {
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('./whisper.worker.js', import.meta.url), { type: 'module' });
    }
    const files = {};
    workerRef.current.onmessage = ({ data }) => {
      if (data.type === 'download') {
        files[data.file] = data;
        const loaded = Object.values(files).reduce((s, f) => s + f.loaded, 0);
        const total = Object.values(files).reduce((s, f) => s + f.total, 0);
        setProgress({ stage: 'Downloading caption AI (one time)', pct: total ? loaded / total : 0, detail: `${fmtMB(loaded)} of ${fmtMB(total)}` });
      } else if (data.type === 'status') {
        setProgress({ stage: 'Writing captions', pct: -1 });
      } else if (data.type === 'done') resolve(data.words);
      else if (data.type === 'error') reject(new Error(data.message));
    };
    workerRef.current.postMessage({ pcm }, [pcm.buffer]);
  });

  const analyse = async () => {
    setError('');
    setPhase('working');
    const ctx = ensureAudio();
    try {
      for (let i = 0; i < clips.length; i++) {
        const c = clips[i];
        if (analysisRef.current.has(c.id)) continue;
        setProgress({ stage: `Listening to clip ${i + 1} of ${clips.length}`, pct: i / clips.length });
        const buffer = await decodeForMix(c.file, ctx);
        const pcm = buffer ? await toAnalysisPcm(buffer) : null;
        analysisRef.current.set(c.id, { buffer, pcm });
      }

      setProgress({ stage: 'Finding the best moments', pct: -1 });
      const prepared = clips.map((c) => {
        const a = analysisRef.current.get(c.id);
        return { ...c, ranges: findActiveRanges(a.pcm, c.duration, style.silence).ranges };
      });
      const timeline = buildTimeline(prepared, style, length, removeSilence);
      if (!timeline.length) throw new Error('Nothing usable was found in this footage.');
      timelineRef.current = timeline;

      let words = [];
      if (captions && clips.some((c) => analysisRef.current.get(c.id).pcm)) {
        const sig = JSON.stringify(timeline.map((s) => [clips[s.clipIndex].id, s.start.toFixed(2), s.end.toFixed(2), s.outStart.toFixed(2)]));
        if (captionCache.current.has(sig)) {
          words = captionCache.current.get(sig);
        } else {
          setProgress({ stage: 'Preparing captions', pct: -1 });
          const { pcm, map } = timelinePcm(timeline, clips.map((c) => analysisRef.current.get(c.id).pcm));
          const raw = await transcribe(pcm);
          words = raw.map((w) => ({ ...w, start: mapToOutput(w.start, map), end: mapToOutput(w.end, map) }));
          captionCache.current.set(sig, words);
        }
      }
      setPages(pageCaptions(words, style.caption.words));
      setPhase('review');
    } catch (e) {
      setError(e.message || 'Something went wrong while analysing the footage.');
      setPhase('setup');
    }
  };

  const render = async () => {
    setError('');
    setPhase('rendering');
    releaseResults();
    setResults([]);
    setSaved([]);
    const ctx = ensureAudio();
    const abort = new AbortController();
    abortRef.current = abort;
    // Main size first, then any extra sizes, one after another.
    const sizes = [aspect, ...ASPECTS.filter((a) => a.id !== aspect.id && extraAspects.includes(a.id))];
    const done = [];
    try {
      for (const [k, size] of sizes.entries()) {
        const stage = sizes.length > 1 ? `Rendering ${size.label} · ${k + 1} of ${sizes.length}` : 'Rendering';
        setProgress({ stage, pct: 0, aspect: size });
        const out = await renderClip({
          clips,
          timeline: timelineRef.current,
          style,
          aspect: size,
          pages: captions ? pages : [],
          audioCtx: ctx,
          clipBuffers: clips.map((c) => analysisRef.current.get(c.id)?.buffer || null),
          music,
          levels,
          title: title.trim(),
          brand: brand ? { image: brand.img, corner: brandCorner } : null,
          canvas: canvasRef.current,
          signal: abort.signal,
          onProgress: (p) => setProgress({ stage, pct: p, aspect: size }),
        });
        const ext = out.type.includes('mp4') ? 'mp4' : 'webm';
        const url = URL.createObjectURL(out.blob);
        resultUrls.current.push(url);
        done.push({
          ...out,
          aspect: size,
          url,
          name: `p31-${style.id}-${size.id.replace(':', 'x')}-${new Date().toISOString().slice(0, 10)}.${ext}`,
        });
        setResults([...done]);
      }
      setPhase('done');
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
      // Keep whatever sizes finished before the stop.
      setPhase(done.length ? 'done' : 'review');
    }
  };

  const share = async (result) => {
    const file = new File([result.blob], result.name, { type: result.type });
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: title || 'P31 clip' });
    } catch { /* closed */ }
  };

  const save = async (result, i) => {
    try {
      await onSave(result.blob, { name: result.name, type: result.type, style: style.id, aspect: result.aspect.id, duration: result.duration, title });
      setSaved((s) => [...s, i]);
    } catch (e) {
      setError(`Couldn’t save: ${e.message}`);
    }
  };

  if (!supported) {
    return (
      <div className="cs cs--center">
        <AlertTriangle size={28} />
        <p>This browser can’t record video. Open Clip Studio in an up-to-date Safari or Chrome.</p>
      </div>
    );
  }

  // ── UI ──────────────────────────────────────────────────
  return (
    <div className="cs">
      {error && <p className="cs-error" role="alert"><AlertTriangle size={16} /> {error}</p>}

      {phase === 'setup' && (
        <>
          <section className="cs-block">
            <h3><Film size={16} /> Footage <span>{clips.length ? `${clips.length} clip${clips.length > 1 ? 's' : ''} · ${fmtTime(rawTotal)}` : ''}</span></h3>
            <div className="cs-clips">
              {clips.map((c, i) => (
                <div className="cs-clip" key={c.id}>
                  <img src={c.thumb} alt="" />
                  <div className="cs-clip__info">
                    <strong>{c.name}</strong>
                    <span>{fmtTime(c.duration)} · {fmtMB(c.size)}</span>
                  </div>
                  <div className="cs-clip__btns">
                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier"><ChevronUp size={16} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === clips.length - 1} aria-label="Move later"><ChevronDown size={16} /></button>
                    <button onClick={() => removeClip(c.id)} aria-label="Remove clip"><X size={16} /></button>
                  </div>
                </div>
              ))}
              {clips.length < MAX_CLIPS && (
                <label className="cs-drop">
                  <Upload size={22} />
                  <strong>{clips.length ? 'Add more footage' : 'Add raw footage'}</strong>
                  <span>Videos from your camera roll — up to {MAX_CLIPS}</span>
                  <input type="file" accept="video/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                </label>
              )}
            </div>
          </section>

          <section className="cs-block">
            <h3><Wand2 size={16} /> Style</h3>
            <div className="cs-styles">
              {CLIP_STYLES.map((s) => (
                <button key={s.id} className={`cs-style ${styleId === s.id ? 'is-on' : ''}`} onClick={() => setStyleId(s.id)} aria-pressed={styleId === s.id}>
                  <span className="cs-style__sw" style={{ background: `linear-gradient(135deg, ${s.swatch[0]} 0 50%, ${s.swatch[1]} 50% 100%)` }} />
                  <strong>{s.name}</strong>
                  <span>{s.blurb}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="cs-block">
            <h3>Format</h3>
            <div className="cs-seg">
              {ASPECTS.map((a) => (
                <button key={a.id} className={aspectId === a.id ? 'is-on' : ''} onClick={() => setAspectId(a.id)}>
                  <strong>{a.label}</strong><span>{a.note}</span>
                </button>
              ))}
            </div>
            <h3>Length</h3>
            <div className="cs-seg cs-seg--tight">
              {LENGTHS.map((l) => (
                <button key={l.id} className={length === l.id ? 'is-on' : ''} onClick={() => setLength(l.id)}>{l.label}</button>
              ))}
            </div>
          </section>

          <section className="cs-block">
            <h3>Options</h3>
            <label className="cs-toggle">
              <span><Captions size={16} /> Auto captions <small>On-device AI · ~40 MB the first time</small></span>
              <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} />
            </label>
            <label className="cs-toggle">
              <span><Scissors size={16} /> Cut silences &amp; dead air</span>
              <input type="checkbox" checked={removeSilence} onChange={(e) => setRemoveSilence(e.target.checked)} />
            </label>
            {(style.titleCard || style.endCard) && (
              <label className="cs-field">
                <span>Title {style.titleCard ? '(opening card)' : '(end card)'}</span>
                <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Winter Gala · Dec 27" />
              </label>
            )}
            <label className="cs-field">
              <span><Music2 size={14} /> Music bed (optional)</span>
              <input type="file" accept="audio/*" onChange={(e) => pickMusic(e.target.files[0])} />
              {music && <small>{music.name}</small>}
            </label>
            <div className="cs-field">
              <span><Stamp size={14} /> Brand mark (your logo on every frame)</span>
              {brand ? (
                <div className="cs-brand">
                  <img src={brand.src} alt="Your logo" />
                  <div className="cs-corners" role="radiogroup" aria-label="Logo position">
                    {CORNERS.map(([id, label]) => (
                      <button key={id} type="button" role="radio" aria-checked={brandCorner === id} aria-label={label}
                        className={`cs-corner cs-corner--${id} ${brandCorner === id ? 'is-on' : ''}`}
                        onClick={() => { setBrandCorner(id); rememberBrand(brand, id); }}><i /></button>
                    ))}
                  </div>
                  <button type="button" className="cs-linkbtn" onClick={() => { setBrand(null); rememberBrand(null); }}>Remove</button>
                </div>
              ) : (
                <input type="file" accept="image/png,image/webp,image/svg+xml,image/jpeg" onChange={(e) => { pickBrand(e.target.files[0]); e.target.value = ''; }} />
              )}
            </div>
            <div className="cs-levels">
              <label>Voice <input type="range" min="0" max="1.5" step="0.05" value={levels.voice} onChange={(e) => setLevels({ ...levels, voice: +e.target.value })} /></label>
              {music && <label>Music <input type="range" min="0" max="1" step="0.05" value={levels.music} onChange={(e) => setLevels({ ...levels, music: +e.target.value })} /></label>}
            </div>
          </section>

          <div className="cs-bar">
            <button className="cs-btn cs-btn--gold" disabled={!clips.length} onClick={analyse}>
              <Wand2 size={18} /> Create my edit
            </button>
          </div>
        </>
      )}

      {phase === 'working' && (
        <div className="cs-working">
          <div className="cs-spinner" aria-hidden="true" />
          <strong>{progress.stage}</strong>
          {progress.pct >= 0 && <div className="cs-progress"><span style={{ width: `${Math.round(progress.pct * 100)}%` }} /></div>}
          {progress.detail && <small>{progress.detail}</small>}
        </div>
      )}

      {phase === 'review' && (
        <>
          <section className="cs-block">
            <h3><Scissors size={16} /> Your edit</h3>
            <p className="cs-note">
              {timelineRef.current.length} shots · {fmtTime(timelineRef.current[timelineRef.current.length - 1].outEnd)} · {style.name} · {aspect.label}
            </p>
          </section>
          {captions && (
            <section className="cs-block">
              <h3><Captions size={16} /> Captions <span>tap to fix any word</span></h3>
              {pages.length === 0 && <p className="cs-note">No speech was found, so there are no captions.</p>}
              <div className="cs-pages">
                {pages.map((pg, i) => (
                  <label className="cs-page" key={`${i}-${pg.start}`}>
                    <span>{fmtTime(pg.start)}</span>
                    <input
                      defaultValue={pg.words.map((w) => w.text).join(' ')}
                      onBlur={(e) => {
                        const next = retimePage(pg, e.target.value);
                        setPages((ps) => (next ? ps.map((p, k) => (k === i ? next : p)) : ps.filter((_, k) => k !== i)));
                      }}
                    />
                  </label>
                ))}
              </div>
            </section>
          )}
          <section className="cs-block">
            <h3>Also export as <span>for other platforms — renders one after another</span></h3>
            <div className="cs-seg">
              {ASPECTS.filter((a) => a.id !== aspect.id).map((a) => {
                const on = extraAspects.includes(a.id);
                return (
                  <button key={a.id} className={on ? 'is-on' : ''} aria-pressed={on}
                    onClick={() => setExtraAspects((xs) => (on ? xs.filter((x) => x !== a.id) : [...xs, a.id]))}>
                    <strong>{a.label}</strong><span>{a.note}</span>
                  </button>
                );
              })}
            </div>
          </section>
          <div className="cs-bar">
            <button className="cs-btn cs-btn--ghost" onClick={() => setPhase('setup')}><RotateCcw size={16} /> Change</button>
            <button className="cs-btn cs-btn--gold" onClick={render}>
              <Film size={18} /> {extraCount ? `Render ${1 + extraCount} videos` : 'Render video'}
            </button>
          </div>
        </>
      )}

      <div className={`cs-stage ${phase === 'rendering' ? '' : 'is-hidden'}`}>
        <canvas ref={canvasRef} className="cs-canvas" style={{ aspectRatio: `${(progress.aspect || aspect).w} / ${(progress.aspect || aspect).h}` }} />
        <div className="cs-progress"><span style={{ width: `${Math.round(progress.pct * 100)}%` }} /></div>
        <p className="cs-note">{progress.stage} in real time — keep this screen open. {Math.round(progress.pct * 100)}%</p>
        <button className="cs-btn cs-btn--ghost" onClick={() => abortRef.current?.abort()}>Cancel</button>
      </div>

      {phase === 'done' && results.length > 0 && (
        <>
          <div className={`cs-results ${results.length > 1 ? 'is-multi' : ''}`}>
            {results.map((r, i) => (
              <div className="cs-out" key={r.url}>
                <video className="cs-result" src={r.url} controls playsInline style={{ aspectRatio: `${r.aspect.w} / ${r.aspect.h}` }} />
                <p className="cs-note">{r.aspect.label} · {fmtTime(r.duration)} · {r.type.includes('mp4') ? 'MP4' : 'WebM'} · {fmtMB(r.blob.size)}</p>
                <div className="cs-bar cs-bar--wrap cs-bar--inline">
                  <a className="cs-btn cs-btn--gold" href={r.url} download={r.name}><Download size={18} /> Download</a>
                  {navigator.canShare && <button className="cs-btn cs-btn--ghost" onClick={() => share(r)}><Share2 size={16} /> Share</button>}
                  {onSave && (
                    <button className="cs-btn cs-btn--ghost" onClick={() => save(r, i)} disabled={saved.includes(i)}>
                      {saved.includes(i) ? <><Check size={16} /> Saved</> : <><Save size={16} /> {saveLabel}</>}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="cs-bar cs-bar--wrap">
            <button className="cs-btn cs-btn--ghost" onClick={() => setPhase('setup')}><RotateCcw size={16} /> Try another style</button>
          </div>
        </>
      )}
    </div>
  );
};

export default ClipStudio;
