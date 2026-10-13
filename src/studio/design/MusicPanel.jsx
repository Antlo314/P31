import React, { useEffect, useRef, useState } from 'react';
import { Play, Square, Check, Upload, Shuffle, Music2, Trash2, Download, Loader2, Instagram, VolumeX } from 'lucide-react';
import { TRACKS, toWav } from './music';
import { listTracks, uploadTrack, deleteTrack } from './store';
import { decode, decoded, getMusicBuffer, playBuffer, stopPreview } from './audio';
import { download } from './export';
import SoundPicker from '../SoundPicker';

/** Music for a design: P31's own tracks, the team's uploads, and Instagram's catalogue for reels. */
const MusicPanel = ({ music = {}, onChange, seconds = 12 }) => {
  const [playing, setPlaying] = useState('');
  const [busy, setBusy] = useState('');
  const [team, setTeam] = useState({ rows: [], shared: null });
  const [error, setError] = useState('');
  const [showIg, setShowIg] = useState(!!music.ig);
  const live = useRef(true);
  useEffect(() => { live.current = true; listTracks().then((t) => live.current && setTeam(t)); return () => { live.current = false; stopPreview(); }; }, []);

  const set = (patch) => onChange({ ...music, ...patch });
  const preview = async (key, m) => {
    if (playing === key) { stopPreview(); setPlaying(''); return; }
    setBusy(key); setError('');
    try {
      const buf = await getMusicBuffer(m, Math.max(12, seconds));
      if (!live.current) return;
      playBuffer(buf, () => live.current && setPlaying(''));
      setPlaying(key);
    } catch (e) { setError(e.message || 'That track would not play.'); }
    setBusy('');
  };
  const isOn = (m) => (m.kind === 'track' ? (music.kind === 'track' || (!music.kind && music.track)) && music.track === m.track : music.kind === m.kind && (m.path ? music.path === m.path : music.id === m.id));

  const addFile = async (file) => {
    if (!file) return;
    setBusy('upload'); setError('');
    try {
      const buf = await decode(file);
      if (team.shared) {
        const row = await uploadTrack(file, buf.duration);
        decoded.set(row.path, buf);
        setTeam((t) => ({ ...t, rows: [row, ...t.rows] }));
        set({ kind: 'team', path: row.path, name: row.title, offset: 0 });
      } else {
        const id = `u${Date.now()}`;
        decoded.set(id, buf);
        set({ kind: 'upload', id, name: file.name, offset: 0 });
      }
    } catch (e) { setError(e.message?.includes('decode') ? 'That file isn’t a song this browser can read. Try an MP3, M4A or WAV.' : e.message); }
    setBusy('');
  };
  const removeTeam = async (row) => {
    if (!window.confirm(`Delete “${row.title}” from the team’s music?`)) return;
    try { await deleteTrack(row); setTeam((t) => ({ ...t, rows: t.rows.filter((r) => r.id !== row.id) })); if (music.path === row.path) set({ kind: 'none' }); } catch (e) { setError(e.message); }
  };
  const saveWav = async () => {
    setBusy('wav');
    try { const buf = await getMusicBuffer(music, seconds); if (buf) download(toWav(buf), `p31-${music.track || 'music'}.wav`); } catch (e) { setError(e.message); }
    setBusy('');
  };

  const row = ({ k, title, sub, m, extra }) => (
    <li key={k} className={`dz-track ${isOn(m) ? 'is-on' : ''}`}>
      <button type="button" className="ds-icon-btn" onClick={() => preview(k, m)} aria-label={playing === k ? `Stop ${title}` : `Play ${title}`} disabled={busy === k}>
        {busy === k ? <Loader2 size={15} className="dz-spin" /> : playing === k ? <Square size={14} /> : <Play size={14} />}
      </button>
      <button type="button" className="dz-track__main" onClick={() => onChange(isOn(m) ? { ...music, kind: 'none' } : { ...music, ...m, ig: music.ig })} aria-pressed={isOn(m)}>
        <strong>{title}</strong><small>{sub}</small>
      </button>
      {isOn(m) && <Check size={16} className="dz-track__tick" />}
      {extra}
    </li>
  );

  return (
    <div className="dz-music">
      <p className="ds-muted dz-small">Music plays when you make a video or reel. These tracks are P31’s own, composed right here, so they are safe to post anywhere.</p>
      {error && <p className="k-error">{error}</p>}
      <ul className="dz-tracks">
        <li className={`dz-track ${music.kind === 'none' ? 'is-on' : ''}`}>
          <span className="ds-icon-btn dz-track__mute"><VolumeX size={14} /></span>
          <button type="button" className="dz-track__main" onClick={() => set({ kind: 'none' })} aria-pressed={music.kind === 'none'}><strong>No music</strong><small>A silent video</small></button>
        </li>
        {TRACKS.map((t) => row({ k: t.key, title: t.name, sub: `${t.mood} · ${t.bpm} BPM`, m: { kind: 'track', track: t.key, seed: music.track === t.key ? music.seed || 1 : 1, volume: music.volume } }))}
      </ul>
      {(music.kind === 'track' || (!music.kind && music.track)) && (
        <div className="dz-inline">
          <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => set({ seed: (music.seed || 1) + 1 })}><Shuffle size={14} /> Another take</button>
          <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={saveWav} disabled={busy === 'wav'}><Download size={14} /> Download track</button>
        </div>
      )}
      <label className="dz-field"><span>Music volume</span>
        <span className="dz-range"><input type="range" min={0.1} max={1} step={0.05} value={music.volume ?? 0.85} onChange={(e) => set({ volume: Number(e.target.value) })} /><output>{Math.round((music.volume ?? 0.85) * 100)}%</output></span>
      </label>

      <h4><Music2 size={15} /> Your own music</h4>
      <p className="ds-muted dz-small">Upload a song you have the rights to (an MP3 or M4A). {team.shared ? 'It is saved for the whole team.' : 'It lasts until you leave this page; once v44 runs, uploads are saved for the team.'}</p>
      <label className="k-btn k-btn--ghost k-btn--sm">{busy === 'upload' ? <Loader2 size={14} className="dz-spin" /> : <Upload size={14} />} Upload a song
        <input type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; addFile(f); }} />
      </label>
      <ul className="dz-tracks">
        {music.kind === 'upload' && row({ k: music.id, title: music.name, sub: 'Uploaded just now', m: { kind: 'upload', id: music.id, name: music.name } })}
        {team.rows.map((r) => row({ k: r.path, title: r.title, sub: r.seconds ? `${Math.floor(r.seconds / 60)}:${String(r.seconds % 60).padStart(2, '0')} · team library` : 'Team library', m: { kind: 'team', path: r.path, name: r.title },
          extra: <button type="button" className="ds-icon-btn" onClick={() => removeTeam(r)} aria-label={`Delete ${r.title}`}><Trash2 size={14} /></button> }))}
      </ul>
      {(music.kind === 'upload' || music.kind === 'team') && (
        <label className="dz-field"><span>Start the song at</span>
          <span className="dz-range"><input type="range" min={0} max={180} step={1} value={music.offset || 0} onChange={(e) => set({ offset: Number(e.target.value) })} /><output>{music.offset || 0}s</output></span>
        </label>
      )}

      <h4><Instagram size={15} /> Instagram’s music on the reel</h4>
      <p className="ds-muted dz-small">Pick a trending track from Instagram’s catalogue and the reel plays it on Instagram (instead of the track above); Facebook keeps the track above. Instagram allows this on reels only, and only when the account is connected to Zernio through Facebook Login.</p>
      {showIg
        ? <SoundPicker compact value={music.ig || null} onChange={(a) => set({ ig: a })} />
        : <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => setShowIg(true)}>{music.ig ? `Change · ${music.ig.title}` : 'Pick a trending Instagram track'}</button>}
    </div>
  );
};

export default MusicPanel;
