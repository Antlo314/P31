import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Undo2, Redo2, Play, Square, Save, Download, Send, LayoutTemplate, Sparkles, Palette, Plus, Music2, FolderOpen, Layers, Loader2, Check, Image as ImageIcon, Film } from 'lucide-react';
import { DashHead } from '../../apps/DashShell';
import Stage from './Stage';
import Inspector from './Inspector';
import MusicPanel from './MusicPanel';
import { getMusicBuffer, playBuffer, stopPreview } from './audio';
import { TemplatesPanel, CollectionPanel, StylesPanel, AddPanel, DesignsPanel } from './panels';
import Batch from './Batch';
import { SIZES } from './brand';
import { fromWords, resize, newId } from './templates';
import { COLLECTION, captionsFor } from './collection';
import { renderStill, renderVideo, videoLength, download, fileName, prepare } from './export';
import { saveDesign, listDesigns } from './store';
import { thumbDataUrl } from './thumbs';
import { trackOf } from './music';
import { uploadMedia } from '../api';
import { loadFonts } from './fonts';
import './designer.css';

const DRAFT = 'p31-design-draft';
const first = () => { const p = COLLECTION[0]; return { ...fromWords(p), caption: captionsFor(p).instagram }; };
const readDraft = () => { try { const d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); return d?.doc?.layers ? d : null; } catch { return null; } };

const TABS = [
  ['templates', 'Templates', LayoutTemplate], ['collection', 'Collection', Sparkles], ['styles', 'Styles', Palette], ['add', 'Add', Plus],
  ['music', 'Music', Music2], ['saved', 'Saved', FolderOpen], ['batch', 'Batch', Layers],
];

/**
 * Content Studio → Design: a Canva-style editor in the P31 look. Templates (including the CEO's
 * quote card), the brand's colour styles, text, shapes, pictures and patterns, entrances for
 * video, music, then download it, save it for the team, or send it straight to a post.
 */
const Designer = () => {
  const navigate = useNavigate();
  const [initial] = useState(readDraft);
  const [doc, setDoc] = useState(() => initial?.doc || first());
  const [meta, setMeta] = useState(() => ({ id: initial?.id || null, title: initial?.title || 'Untitled design' }));
  const [histN, setHistN] = useState([0, 0]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('collection');
  const [time, setTime] = useState(null);
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [shared, setShared] = useState(null);
  const [savedKey, setSavedKey] = useState(0);
  const hist = useRef({ past: [], future: [], key: '', at: 0 });
  const docRef = useRef(doc);
  const raf = useRef(0);

  useEffect(() => { loadFonts(); listDesigns().then((r) => setShared(r.shared)).catch(() => {}); }, []);
  // Keep a draft in this browser so a refresh never loses work.
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(DRAFT, JSON.stringify({ doc, ...meta })); } catch { /* storage full: the draft is optional */ } }, 500);
    return () => clearTimeout(t);
  }, [doc, meta]);

  const commit = useCallback((next) => { docRef.current = next; setDoc(next); setHistN([hist.current.past.length, hist.current.future.length]); }, []);
  /** Change the design. Rapid changes with the same key (a slider, a drag) are one undo step. */
  const change = useCallback((updater, { coalesce } = {}) => {
    const d = docRef.current;
    const next = typeof updater === 'function' ? updater(d) : updater;
    if (next === d) return;
    const h = hist.current; const now = Date.now();
    if (!(coalesce && h.key === coalesce && now - h.at < 900)) { h.past.push(d); if (h.past.length > 80) h.past.shift(); }
    h.key = coalesce || ''; h.at = now; h.future = [];
    commit(next);
  }, [commit]);
  const undo = useCallback(() => { const h = hist.current; if (!h.past.length) return; h.future.push(docRef.current); h.key = ''; commit(h.past.pop()); }, [commit]);
  const redo = useCallback(() => { const h = hist.current; if (!h.future.length) return; h.past.push(docRef.current); h.key = ''; commit(h.future.pop()); }, [commit]);
  const stop = () => { cancelAnimationFrame(raf.current); stopPreview(); setTime(null); };
  const replace = (next, m = { id: null, title: 'Untitled design' }) => { stop(); change(next); setMeta(m); setSelected(null); setNote(''); setError(''); };

  const layerAction = useCallback((what, id = selected) => {
    if (!id) return;
    change((d) => {
      const i = d.layers.findIndex((l) => l.id === id);
      if (i < 0) return d;
      const layers = [...d.layers];
      if (what === 'delete') layers.splice(i, 1);
      else if (what === 'duplicate') { const c = { ...layers[i], id: newId(), x: layers[i].x + 30, y: layers[i].y + 30, pin: null }; layers.splice(i + 1, 0, c); setTimeout(() => setSelected(c.id)); }
      else if (what === 'up' && i < layers.length - 1) [layers[i], layers[i + 1]] = [layers[i + 1], layers[i]];
      else if (what === 'down' && i > 0) [layers[i], layers[i - 1]] = [layers[i - 1], layers[i]];
      // Anything pinned to a deleted layer keeps its place.
      return { ...d, layers: what === 'delete' ? layers.map((l) => (l.pin?.to === id ? { ...l, pin: null } : l)) : layers };
    });
    if (what === 'delete') setSelected(null);
  }, [change, selected]);

  // Keyboard: undo/redo, delete, duplicate, nudge.
  useEffect(() => {
    const onKey = (e) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
      if (typing || !selected) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); layerAction('delete'); }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); layerAction('duplicate'); }
      else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const s = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0; const dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0;
        change((d) => ({ ...d, layers: d.layers.map((l) => (l.id === selected && !l.locked ? { ...l, x: l.x + dx, y: l.y + dy, pin: null } : l)) }), { coalesce: `nudge-${selected}` });
      } else if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, undo, redo, layerAction, change]);

  // ── Preview: the entrances with the music, in real time ──
  const play = async () => {
    if (time != null) { stop(); return; }
    setBusy('mix'); setError('');
    try {
      await prepare(doc);
      const len = videoLength(doc);
      const audio = await getMusicBuffer(doc.music, len);
      setBusy('');
      if (audio) playBuffer(audio);
      const t0 = performance.now();
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        if (t >= len) { stop(); return; }
        setTime(t); raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) { setBusy(''); setError(e.message); }
  };
  useEffect(() => () => { cancelAnimationFrame(raf.current); stopPreview(); }, []);

  // ── Files ──
  const still = async (type = 'image/png') => renderStill(doc, { type });
  const video = async () => {
    const len = videoLength(doc);
    setBusy('video'); setProgress(0);
    const audio = await getMusicBuffer(doc.music, len);
    return renderVideo(doc, { seconds: len, audio, onProgress: setProgress });
  };
  const run = async (label, job) => {
    stop(); setBusy(label); setError(''); setNote('');
    try { await job(); } catch (e) { if (e.name !== 'AbortError') setError(e.message || 'Something went wrong.'); }
    setBusy(''); setProgress(0);
  };
  const downloadStill = (type) => run('image', async () => download(await still(type), fileName(doc, type === 'image/png' ? 'png' : 'jpg')));
  const downloadVideo = () => run('video', async () => { const out = await video(); download(out.blob, fileName(doc, out.type === 'video/mp4' ? 'mp4' : 'webm')); });
  const sendToPost = (kind) => run(kind === 'video' ? 'video' : 'upload', async () => {
    let file;
    if (kind === 'video') { const out = await video(); file = new File([out.blob], fileName(doc, out.type === 'video/mp4' ? 'mp4' : 'webm'), { type: out.type }); }
    else file = new File([await still('image/jpeg')], fileName(doc, 'jpg'), { type: 'image/jpeg' });
    setBusy('upload');
    const url = await uploadMedia(file, file.name);
    const alt = doc.layers.filter((l) => l.type === 'text' && !l.hidden).map((l) => l.text).join(' ').slice(0, 400);
    navigate('/studio/compose', { state: { copy: { platforms: ['instagram', 'facebook'], content: doc.caption || '', media: [{ type: kind === 'video' ? 'video' : 'image', url, name: file.name, altText: alt }], audio: kind === 'video' ? doc.music?.ig || null : null } } });
  });
  const save = () => run('save', async () => {
    const title = meta.title?.trim() || 'Untitled design';
    const row = await saveDesign({ id: meta.id && !(shared && String(meta.id).startsWith('local-')) ? meta.id : null, title, doc, thumb: await thumbDataUrl(doc) }, shared !== false);
    setMeta({ id: row.id, title: row.title }); setSavedKey((k) => k + 1);
    if (row.local) setShared(false);
    setNote(row.local ? 'Saved in this browser (the team library opens once the v44 database update runs).' : 'Saved for the team.');
  });

  const size = SIZES[doc.size] || SIZES.post;
  const len = videoLength(doc);
  const track = doc.music?.kind === 'none' ? null : doc.music?.kind === 'team' || doc.music?.kind === 'upload' ? doc.music.name : trackOf(doc.music?.track)?.name;
  const canUndo = histN[0] > 0; const canRedo = histN[1] > 0;

  return (
    <>
      <DashHead eyebrow="Content Studio" title="Design" accent="studio" lead="Make posts, stories and reels in the P31 look: start from Melanie JC’s quote cards or a template, change anything, add music, then post it." />
      <div className="dz-bar">
        <input className="k-input dz-title" value={meta.title} onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))} aria-label="Design name" />
        <div className="dz-seg" role="group" aria-label="Size">
          {Object.entries(SIZES).map(([k, s]) => <button key={k} type="button" aria-pressed={doc.size === k} onClick={() => change((d) => resize(d, k))} title={`${s.label} · ${s.note}`}>{s.short}</button>)}
        </div>
        <span className="dz-bar__group">
          <button type="button" className="ds-icon-btn" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 size={16} /></button>
          <button type="button" className="ds-icon-btn" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Y)"><Redo2 size={16} /></button>
        </span>
        <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={play} disabled={busy && busy !== 'mix'}>
          {busy === 'mix' ? <Loader2 size={14} className="dz-spin" /> : time != null ? <Square size={14} /> : <Play size={14} />} {time != null ? 'Stop' : `Play ${len}s`}
        </button>
        <span className="dz-bar__push" />
        <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={save} disabled={!!busy}><Save size={14} /> Save</button>
        <details className="dz-menu">
          <summary className="k-btn k-btn--ghost k-btn--sm"><Download size={14} /> Download</summary>
          <div>
            <button type="button" onClick={(e) => { e.currentTarget.closest('details').open = false; downloadStill('image/png'); }}><ImageIcon size={14} /> Image (PNG)</button>
            <button type="button" onClick={(e) => { e.currentTarget.closest('details').open = false; downloadStill('image/jpeg'); }}><ImageIcon size={14} /> Image (JPG)</button>
            <button type="button" onClick={(e) => { e.currentTarget.closest('details').open = false; downloadVideo(); }}><Film size={14} /> Video with music (MP4)</button>
          </div>
        </details>
        <details className="dz-menu dz-menu--right">
          <summary className="k-btn k-btn--gold k-btn--sm"><Send size={14} /> Use in a post</summary>
          <div>
            <button type="button" onClick={(e) => { e.currentTarget.closest('details').open = false; sendToPost('image'); }}><ImageIcon size={14} /> As an image post</button>
            <button type="button" onClick={(e) => { e.currentTarget.closest('details').open = false; sendToPost('video'); }}><Film size={14} /> As a reel with music</button>
          </div>
        </details>
      </div>
      {(busy && busy !== 'mix') && (
        <p className="dz-progress" role="status">
          <Loader2 size={14} className="dz-spin" /> {busy === 'video' ? `Making the video${progress ? ` · ${Math.round(progress * 100)}%` : ''}` : busy === 'upload' ? 'Uploading…' : busy === 'save' ? 'Saving…' : 'Drawing…'}
          {busy === 'video' && <span style={{ width: `${progress * 100}%` }} />}
        </p>
      )}
      {error && <p className="k-error" role="alert">{error}</p>}
      {note && <p className="fc-done"><Check size={14} /> {note}</p>}

      <div className="dz">
        <aside className="dz-side">
          <div className="dz-tabs" role="tablist">
            {TABS.map((t) => { const Icon = t[2]; return <button key={t[0]} role="tab" aria-selected={tab === t[0]} onClick={() => setTab(t[0])}><Icon size={16} /><span>{t[1]}</span></button>; })}
          </div>
          <div className="dz-panel">
            {tab === 'templates' && <TemplatesPanel doc={doc} onReplace={(d) => replace({ ...d, caption: '' })} />}
            {tab === 'collection' && <CollectionPanel doc={doc} onReplace={(d) => replace(d)} />}
            {tab === 'styles' && <StylesPanel doc={doc} onChange={change} />}
            {tab === 'add' && <AddPanel doc={doc} onAdd={(l) => { change((d) => ({ ...d, layers: [...d.layers, l] })); setSelected(l.id); }} />}
            {tab === 'music' && <MusicPanel music={doc.music || {}} seconds={len} onChange={(m) => change((d) => ({ ...d, music: m }), { coalesce: 'music' })} />}
            {tab === 'saved' && <DesignsPanel refreshKey={savedKey} shared={shared} setShared={setShared} current={meta.id} onOpen={(r) => replace(r.doc, { id: r.id, title: r.title })} />}
            {tab === 'batch' && <Batch doc={doc} shared={shared} />}
          </div>
        </aside>
        <section className="dz-center">
          <Stage doc={doc} selected={selected} onSelect={setSelected} onChange={change} time={time}
            onEditText={(id) => setTimeout(() => document.getElementById(`dz-text-${id}`)?.focus())} />
          <p className="dz-under">
            {size.label} · {size.w}×{size.h}
            {track ? <> · <Music2 size={12} /> {track}{doc.music?.ig ? ` · Instagram: ${doc.music.ig.title}` : ''}</> : ' · no music'}
          </p>
          <label className="dz-field dz-caption"><span>Caption (goes to the post)</span>
            <textarea className="k-input dz-textarea" rows={3} value={doc.caption || ''} onChange={(e) => change((d) => ({ ...d, caption: e.target.value }), { coalesce: 'caption' })} placeholder="Optional: write the caption here and it comes along when you use the design in a post." />
          </label>
        </section>
        <aside className="dz-right">
          <Inspector doc={doc} selected={selected} onChange={change} onLayer={layerAction} onSelect={setSelected} />
        </aside>
      </div>
    </>
  );
};

export default Designer;
