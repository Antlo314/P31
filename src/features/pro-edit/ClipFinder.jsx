import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Film, Scissors, Music2, Upload, Play, Square, Trash2, Plus, Wand2, Loader2, ChevronLeft, ChevronRight,
  Download, Send, CheckCircle2, Shuffle, RotateCcw, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { IRIS_STYLES } from './irisStyles';
import { readFootage, clipPlan, analyzeFootage, pickMoments, momentThumbs, cutMoment, fmtTime } from './findMoments';
import './ClipFinder.css';

const LENGTHS = [15, 30, 45, 60, 90];
const ASPECTS = ['9:16', '4:5', '1:1', '16:9'];
const cleanName = (n) => n.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_').slice(0, 60);
const tooBig = (msg = '') => /size|large|exceed|413/i.test(msg);
// What DaVinci (Iris) can use as a music bed.
const MUSIC_TYPES = ['.mp3', '.m4a', '.wav', '.aac', '.flac', '.aif', '.aiff'];

/**
 * DaVinci clip finder: long raw footage in, several finished clips out.
 * Pick the footage (it stays on this device), choose how many clips and how long,
 * give each one a look and a music track, then send them to Iris/DaVinci.
 */
const ClipFinder = ({ userId, onSent }) => {
  const [file, setFile] = useState(null);
  const [info, setInfo] = useState(null);
  const [url, setUrl] = useState('');
  const [length, setLength] = useState(30);
  const [count, setCount] = useState(4);
  const [aspect, setAspect] = useState('9:16');
  const [look, setLook] = useState(IRIS_STYLES[0]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [tracks, setTracks] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [moments, setMoments] = useState([]);
  const [progress, setProgress] = useState(null);
  const [sending, setSending] = useState(null);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(null);
  const videoRef = useRef(null);

  const plan = useMemo(() => (info ? clipPlan(info.duration, length) : { max: 1, suggested: 1 }), [info, length]);

  // The music library: every track uploaded to this account.
  const loadTracks = () => supabase.storage.from('studio').list(`${userId}/music`, { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
    .then(({ data }) => setTracks((data || []).filter((f) => f.name && !f.name.startsWith('.')).map((f) => ({ path: `${userId}/music/${f.name}`, name: f.name.replace(/^\d+-/, '').replace(/_/g, ' ') }))));
  useEffect(() => { if (userId) loadTracks(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const pickFile = async (f) => {
    if (!f) return;
    setError(''); setAnalysis(null); setMoments([]); setSent(null);
    setProgress({ value: 0, label: 'Opening the footage…' });
    try {
      const meta = await readFootage(f);
      setFile(f);
      setInfo(meta);
      setUrl(URL.createObjectURL(f));
      setTitle((t) => t || f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
      const p = clipPlan(meta.duration, length);
      setCount(p.suggested);
    } catch (e) {
      setError(e.message || 'This file couldn’t be opened.');
    }
    setProgress(null);
  };

  const changeLength = (l) => {
    setLength(l);
    if (info) setCount(clipPlan(info.duration, l).suggested);
  };

  const withThumbs = async (list) => {
    try {
      const thumbs = await momentThumbs(file, list);
      return list.map((m, i) => ({ ...m, thumb: thumbs[i] }));
    } catch { return list; }
  };

  const findClips = async () => {
    setError(''); setSent(null);
    const ctrl = new AbortController();
    const cancel = () => ctrl.abort();
    try {
      const a = analysis || await analyzeFootage(file, { signal: ctrl.signal, onProgress: (value, label) => setProgress({ value, label, cancel }) });
      setAnalysis(a);
      setProgress({ value: 1, label: 'Picking the best moments…' });
      const picks = pickMoments(a, { count, length });
      const named = picks.map((m, i) => ({ ...m, id: `${Date.now()}-${i}`, look, music: 'auto', title: '' }));
      setMoments(await withThumbs(named));
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || 'Analysis stopped.');
    }
    setProgress(null);
  };

  const findAnother = async () => {
    const [m] = pickMoments(analysis, { count: 1, length, exclude: moments.map((x) => [x.start, x.end]) });
    if (!m) return setError('No more strong moments left that don’t overlap the ones you have.');
    const [withThumb] = await withThumbs([{ ...m, id: `${Date.now()}`, look, music: 'auto', title: '' }]);
    setMoments((list) => [...list, withThumb].sort((a, b) => a.start - b.start));
  };

  const update = (id, patch) => setMoments((list) => list.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const shift = async (m, by) => {
    const span = m.end - m.start;
    const start = Math.max(0, Math.min(info.duration - span, m.start + by));
    const moved = { ...m, start, end: start + span };
    const [t] = await withThumbs([moved]);
    update(m.id, { start, end: start + span, thumb: t.thumb });
  };
  const mixLooks = () => setMoments((list) => list.map((m, i) => ({ ...m, look: IRIS_STYLES[i % IRIS_STYLES.length] })));
  const lookForAll = (l) => { setLook(l); setMoments((list) => list.map((m) => ({ ...m, look: l }))); };

  // Preview a moment in the player, stopping at its end.
  const preview = (m) => {
    const v = videoRef.current;
    if (!v) return;
    if (playing === m.id) { v.pause(); setPlaying(null); return; }
    v.currentTime = m.start;
    v.play().catch(() => {});
    setPlaying(m.id);
    const stopAt = () => { if (v.currentTime >= m.end) { v.pause(); setPlaying(null); v.removeEventListener('timeupdate', stopAt); } };
    v.addEventListener('timeupdate', stopAt);
  };

  const uploadMusic = async (files) => {
    setError('');
    for (const f of files) {
      if (!MUSIC_TYPES.some((x) => f.name.toLowerCase().endsWith(x))) { setError(`${f.name}: use MP3, M4A, WAV, AAC, FLAC or AIFF.`); continue; }
      setProgress({ value: 0, label: `Uploading ${f.name}…` });
      const path = `${userId}/music/${Date.now()}-${cleanName(f.name)}${(f.name.match(/\.[^.]+$/) || [''])[0].toLowerCase()}`;
      const { error: err } = await supabase.storage.from('studio').upload(path, f, { contentType: f.type || 'audio/mpeg' });
      if (err) { setError(`${f.name}: ${err.message}`); break; }
    }
    setProgress(null);
    loadTracks();
  };
  const removeTrack = async (t) => {
    await supabase.storage.from('studio').remove([t.path]);
    setMoments((list) => list.map((m) => (m.music === t.path ? { ...m, music: 'auto' } : m)));
    loadTracks();
  };
  const musicFor = (m, i) => (m.music === 'none' ? null : m.music === 'auto' ? tracks[i % tracks.length]?.path || null : m.music);

  const download = async (m, i) => {
    setProgress({ value: 0, label: `Cutting clip ${i + 1}…` });
    try {
      const blob = await cutMoment(file, m, { onProgress: (p) => setProgress({ value: p, label: `Cutting clip ${i + 1}…` }) });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${cleanName(title || 'clip')}-${String(i + 1).padStart(2, '0')}.mp4`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { setError(e.message); }
    setProgress(null);
  };

  // Cut each moment, upload it, and queue one DaVinci job per clip.
  const send = async () => {
    setError('');
    const batch = crypto.randomUUID();
    const folder = `${userId}/davinci/${batch}`;
    const done = [];
    for (let i = 0; i < moments.length; i++) {
      const m = moments[i];
      const label = `Clip ${i + 1} of ${moments.length}`;
      try {
        setSending({ i, label: `${label}: cutting…`, value: i / moments.length });
        let blob = await cutMoment(file, m);
        const path = `${folder}/clip-${String(i + 1).padStart(2, '0')}.mp4`;
        setSending({ i, label: `${label}: uploading ${(blob.size / 1048576).toFixed(0)} MB…`, value: (i + 0.5) / moments.length });
        let { error: upErr } = await supabase.storage.from('studio').upload(path, blob, { contentType: 'video/mp4', upsert: true });
        if (upErr && tooBig(upErr.message)) {
          setSending({ i, label: `${label}: making a smaller copy…`, value: (i + 0.5) / moments.length });
          blob = await cutMoment(file, m, { smaller: true });
          ({ error: upErr } = await supabase.storage.from('studio').upload(path, blob, { contentType: 'video/mp4', upsert: true }));
        }
        if (upErr) throw new Error(upErr.message);
        const { error: insErr } = await supabase.from('pro_edit_jobs').insert({
          requested_by: userId, kind: 'clip', batch_id: batch, clip_index: i + 1, clip_count: moments.length,
          title: m.title || `${title || 'Clip'} · ${i + 1}`, style: m.look, aspect, notes: notes || null,
          source_paths: [path], music_path: musicFor(m, i), source_name: file.name,
          clip_start: Math.round(m.start * 10) / 10, clip_end: Math.round(m.end * 10) / 10,
        });
        if (insErr) throw new Error(insErr.message.includes('row-level') ? 'DaVinci isn’t turned on for this account.' : insErr.message);
        done.push(i + 1);
      } catch (e) {
        setError(`${label}: ${e.message}`);
        break;
      }
    }
    setSending(null);
    if (done.length) setSent({ count: done.length, of: moments.length });
  };

  const busy = !!progress || !!sending;

  return (
    <div className="cf">
      <section className="cf-card">
        <h3><Film size={16} /> 1 · Footage</h3>
        <p className="pe-muted">Long raw footage, straight from the camera or phone. It stays on this device. Only the clips you send are uploaded.</p>
        {info ? (
          <div className="cf-source">
            {info.cover && <img src={info.cover} alt="" />}
            <div>
              <strong>{file.name}</strong>
              <span>{fmtTime(info.duration)} · {(file.size / 1073741824 >= 1 ? `${(file.size / 1073741824).toFixed(1)} GB` : `${Math.round(file.size / 1048576)} MB`)} · {info.width}×{info.height}{info.hasAudio ? '' : ' · no sound'}</span>
            </div>
            <label className="pe-linkbtn">Change<input type="file" accept="video/*" hidden onChange={(e) => { pickFile(e.target.files[0]); e.target.value = ''; }} /></label>
          </div>
        ) : (
          <label className="pe-drop"><Upload size={18} /> Choose footage
            <input type="file" accept="video/*" hidden onChange={(e) => { pickFile(e.target.files[0]); e.target.value = ''; }} />
          </label>
        )}
      </section>

      {info && (
        <section className="cf-card">
          <h3><Scissors size={16} /> 2 · Clips</h3>
          <div className="cf-lengths" role="radiogroup" aria-label="Clip length">
            {LENGTHS.map((l) => (
              <button type="button" key={l} role="radio" aria-checked={length === l} className={length === l ? 'is-on' : ''} onClick={() => changeLength(l)} disabled={l > info.duration}>{l}s</button>
            ))}
          </div>
          <label className="cf-count">
            <span><span>How many clips <b>{count}</b></span><small>{fmtTime(info.duration)} of footage holds up to {plan.max} · we suggest {plan.suggested}</small></span>
            <input type="range" min="1" max={plan.max} value={Math.min(count, plan.max)} onChange={(e) => setCount(+e.target.value)} />
          </label>
          <div className="pe-row">
            <label className="pe-field"><span>Look for every clip</span>
              <select value={look} onChange={(e) => lookForAll(e.target.value)}>{IRIS_STYLES.map((s) => <option key={s}>{s}</option>)}</select>
            </label>
            <label className="pe-field"><span>Format</span>
              <select value={aspect} onChange={(e) => setAspect(e.target.value)}>{ASPECTS.map((a) => <option key={a}>{a}</option>)}</select>
            </label>
          </div>
          <label className="pe-field"><span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Winter Gala" />
          </label>
          <label className="pe-field"><span>Notes for the editor (optional)</span>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Captions on, keep the speech, end on the logo…" />
          </label>
        </section>
      )}

      {info && (
        <section className="cf-card">
          <h3><Music2 size={16} /> 3 · Music</h3>
          <p className="pe-muted">Upload as many tracks as you like. Each clip can use one, or rotate through all of them.</p>
          {tracks.length > 0 && (
            <ul className="cf-tracks">
              {tracks.map((t) => (
                <li key={t.path}><Music2 size={14} /> <span>{t.name}</span>
                  <button type="button" onClick={() => removeTrack(t)} aria-label={`Remove ${t.name}`}><X size={14} /></button>
                </li>
              ))}
            </ul>
          )}
          <label className="pe-drop pe-drop--sm"><Plus size={16} /> Add music
            <input type="file" accept={MUSIC_TYPES.join(',')} multiple hidden onChange={(e) => { uploadMusic([...e.target.files]); e.target.value = ''; }} />
          </label>
        </section>
      )}

      {info && (
        <div className="cf-go">
          <button type="button" className="pe-btn" onClick={findClips} disabled={busy}>
            <Wand2 size={17} /> {moments.length ? `Find ${count} clips again` : `Find the best ${count} clip${count > 1 ? 's' : ''}`}
          </button>
          {progress && (
            <div className="cf-progress" role="status">
              <span><Loader2 size={15} className="pe-spin" /> {progress.label}</span>
              <progress value={progress.value} max="1" />
              {progress.cancel && <button type="button" className="pe-linkbtn" onClick={progress.cancel}>Cancel</button>}
            </div>
          )}
        </div>
      )}

      {error && <p className="pe-error" role="alert">{error}</p>}

      {moments.length > 0 && (
        <section className="cf-card cf-review">
          <div className="cf-review__head">
            <h3><Scissors size={16} /> 4 · Your clips</h3>
            <button type="button" className="pe-linkbtn" onClick={mixLooks}><Shuffle size={14} /> Mix up the looks</button>
          </div>
          <video ref={videoRef} src={url} className="cf-player" playsInline controls onPause={() => setPlaying(null)} />
          <ol className="cf-list">
            {moments.map((m, i) => (
              <li key={m.id} className="cf-clip">
                <button type="button" className="cf-clip__thumb" onClick={() => preview(m)} aria-label={playing === m.id ? 'Stop preview' : `Preview clip ${i + 1}`}>
                  {m.thumb ? <img src={m.thumb} alt="" /> : <span />}
                  <em>{playing === m.id ? <Square size={16} /> : <Play size={16} />}</em>
                </button>
                <div className="cf-clip__body">
                  <div className="cf-clip__top">
                    <strong>Clip {i + 1}</strong>
                    <span>{fmtTime(m.start)}–{fmtTime(m.end)}</span>
                    {m.reason && <span className="pe-pill">{m.reason}</span>}
                  </div>
                  <input className="cf-clip__title" value={m.title} onChange={(e) => update(m.id, { title: e.target.value })} placeholder={`${title || 'Clip'} · ${i + 1}`} aria-label={`Clip ${i + 1} title`} />
                  <div className="cf-clip__opts">
                    <select value={m.look} onChange={(e) => update(m.id, { look: e.target.value })} aria-label={`Clip ${i + 1} look`}>
                      {IRIS_STYLES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <select value={m.music} onChange={(e) => update(m.id, { music: e.target.value })} aria-label={`Clip ${i + 1} music`}>
                      <option value="auto">{tracks.length ? `Music: rotate (${tracks[i % tracks.length]?.name})` : 'Music: none uploaded'}</option>
                      {tracks.map((t) => <option key={t.path} value={t.path}>{t.name}</option>)}
                      <option value="none">No music</option>
                    </select>
                  </div>
                  <div className="cf-clip__actions">
                    <button type="button" onClick={() => shift(m, -5)} aria-label="Start 5 seconds earlier"><ChevronLeft size={15} /> 5s</button>
                    <button type="button" onClick={() => shift(m, 5)} aria-label="Start 5 seconds later">5s <ChevronRight size={15} /></button>
                    <button type="button" onClick={() => download(m, i)} disabled={busy}><Download size={14} /> Cut</button>
                    <button type="button" onClick={() => setMoments((list) => list.filter((x) => x.id !== m.id))} aria-label={`Remove clip ${i + 1}`}><Trash2 size={14} /></button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="cf-review__foot">
            <button type="button" className="pe-linkbtn" onClick={findAnother} disabled={busy}><Plus size={14} /> Find another</button>
            <button type="button" className="pe-linkbtn" onClick={() => { setMoments([]); setSent(null); }} disabled={busy}><RotateCcw size={14} /> Start over</button>
          </div>
          {sending ? (
            <div className="cf-progress" role="status"><span><Loader2 size={15} className="pe-spin" /> {sending.label}</span><progress value={sending.value} max="1" /></div>
          ) : sent ? (
            <div className="cf-sent"><CheckCircle2 size={18} /> <span>{sent.count} of {sent.of} clips are in the DaVinci queue. Iris edits them one by one.</span>
              {onSent && <button type="button" className="pe-linkbtn" onClick={onSent}>Open the Edit queue</button>}</div>
          ) : (
            <button type="button" className="pe-btn" onClick={send} disabled={busy}><Send size={16} /> Send {moments.length} clip{moments.length > 1 ? 's' : ''} to DaVinci</button>
          )}
        </section>
      )}
    </div>
  );
};

export default ClipFinder;
