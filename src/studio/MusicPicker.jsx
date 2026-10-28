import React, { useEffect, useRef, useState } from 'react';
import { Music2, Play, Square, Search, X, Check, Loader2 } from 'lucide-react';
import { trackName } from './musicPick';
import './music.css';

const fmtDur = (ms) => (ms ? `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}` : '');
const PLATFORM = { tiktok: 'TikTok', instagram: 'Instagram' };

// One preview plays at a time across the page: starting one stops the last.
let stopCurrent = null;

/** A play/stop button for a track's preview (nothing when the track has none). */
const Preview = ({ track }) => {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => { ref.current?.pause(); }, []);
  if (!track?.previewUrl) return null;
  const stop = () => { ref.current?.pause(); setOn(false); };
  const toggle = () => {
    if (on) { stop(); stopCurrent = null; return; }
    if (stopCurrent) stopCurrent();
    const el = ref.current;
    if (!el) return;
    el.src = track.previewUrl;
    el.play().then(() => { setOn(true); setFailed(false); stopCurrent = stop; }, () => setFailed(true));
  };
  return (
    <>
      <audio ref={ref} onEnded={() => setOn(false)} hidden preload="none" />
      <button type="button" className="mu-icon" onClick={toggle} aria-label={on ? `Stop ${trackName(track)}` : `Preview ${trackName(track)}`} title={failed ? 'The preview did not play. The track still goes on the post.' : on ? 'Stop' : 'Preview'}>
        {on ? <Square size={13} /> : <Play size={13} />}
      </button>
    </>
  );
};

/**
 * The trending list, a search and a preview for each track; Choose picks one. `load(q)` resolves to
 * {tracks, note} (./music.js trendingMusic); `trending` is the list already read.
 */
export const MusicPicker = ({ platform, trending, load, value, onChoose, onClose }) => {
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null); // a search's {tracks, note}, or null for the trending list
  const [busy, setBusy] = useState(false);
  const shown = found || trending;
  const search = async () => {
    if (!q.trim()) { setFound(null); return; }
    setBusy(true);
    try { setFound(await load(q.trim())); } finally { setBusy(false); }
  };
  return (
    <div className="mu-picker" role="group" aria-label={`Pick ${PLATFORM[platform] || ''} music`}>
      {/* Not a <form>: this sits inside the composer's form, and forms can't nest. */}
      <div className="mu-search">
        <Search size={14} aria-hidden="true" />
        <input value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setFound(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }} placeholder={platform === 'tiktok' ? 'Search the trending list: song, artist or genre' : 'Song, artist or mood'} aria-label="Search music" />
        <button type="button" className="mu-btn" onClick={search} disabled={busy}>{busy ? <Loader2 size={13} className="mu-spin" /> : 'Search'}</button>
        <button type="button" className="mu-icon" onClick={onClose} aria-label="Close the music list"><X size={14} /></button>
      </div>
      {found && <small className="mu-muted">{found.tracks.length ? `${found.tracks.length} found for “${q.trim()}”.` : `Nothing found for “${q.trim()}”.`} <button type="button" className="mu-link" onClick={() => { setQ(''); setFound(null); }}>Back to trending</button></small>}
      {shown?.note && <small className="mu-note">{shown.note}</small>}
      {!shown && <small className="mu-muted"><Loader2 size={13} className="mu-spin" /> Loading trending music…</small>}
      <ul className="mu-list">
        {(shown?.tracks || []).map((t, i) => {
          const on = value?.track?.id === t.id;
          return (
            <li key={t.id} className={`mu-row${on ? ' is-on' : ''}`}>
              {t.artwork ? <img src={t.artwork} alt="" loading="lazy" /> : <span className="mu-art"><Music2 size={15} /></span>}
              <span className="mu-main">
                <strong>{t.title || 'Untitled'}</strong>
                <small>{[t.artist, fmtDur(t.durationMs), !found && (t.rank || i + 1) ? `#${t.rank || i + 1} trending` : '', t.explicit ? 'explicit' : ''].filter(Boolean).join(' · ')}</small>
              </span>
              <Preview track={t} />
              <button type="button" className={`mu-btn${on ? ' is-on' : ''}`} onClick={() => onChoose(t)} aria-pressed={on}>{on ? <><Check size={13} /> Chosen</> : 'Choose'}</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

/**
 * One post's music: "Music: Title - Artist", a preview, the loudness (video posts), and Change /
 * our own music. `value` is {track, volume, originalVolume} or null (no trending track); `auto` marks
 * the Studio's own pick. `list` is the trending {tracks, note} (null while loading).
 */
const MusicChoice = ({
  platform = 'tiktok', value, onChange, list, load, auto = false, disabled = false, volumes = false,
  noneText = 'our original music', noneAction = 'Use our original music', originalLabel = 'Our music under it', label = 'Music',
  showNote = true, extra = null, onOpen = null,
}) => {
  const [open, setOpen] = useState(false);
  const track = value?.track || null;
  const choose = (t) => { onChange({ ...(value || {}), track: t }); setOpen(false); };
  const vol = (k, v) => onChange({ ...value, [k]: Number(v) });
  return (
    <div className="mu">
      <p className="mu-line">
        <Music2 size={14} aria-hidden="true" />
        <span><b>{label}:</b> {track ? trackName(track) : noneText}
          {track && auto && <em className="mu-tag">auto-picked{track.rank ? ` · #${track.rank} trending` : ''}</em>}
          {!list && !track && <em className="mu-muted"> (looking for trending music…)</em>}
        </span>
        <Preview track={track} />
        {!disabled && (
          <span className="mu-actions">
            <button type="button" className="mu-link" onClick={() => (onOpen ? onOpen() : setOpen((o) => !o))} aria-expanded={onOpen ? undefined : open}>{open ? 'Close' : 'Change'}</button>
            {track && <button type="button" className="mu-link" onClick={() => { onChange(null); setOpen(false); }}>{noneAction}</button>}
          </span>
        )}
      </p>
      {track && volumes && !disabled && (
        <div className="mu-vols">
          <label><span>Track {value?.volume ?? 0}%</span><input type="range" min={0} max={100} step={5} value={value?.volume ?? 0} onChange={(e) => vol('volume', e.target.value)} /></label>
          <label><span>{originalLabel} {value?.originalVolume ?? 0}%</span><input type="range" min={0} max={100} step={5} value={value?.originalVolume ?? 0} onChange={(e) => vol('originalVolume', e.target.value)} /></label>
        </div>
      )}
      {extra}
      {showNote && list?.note && !track && <small className="mu-note">{list.note}</small>}
      {open && !disabled && <MusicPicker platform={platform} trending={list} load={load} value={value} onChoose={choose} onClose={() => setOpen(false)} />}
    </div>
  );
};

export default MusicChoice;
