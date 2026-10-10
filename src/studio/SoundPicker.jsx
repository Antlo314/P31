import React, { useEffect, useRef, useState } from 'react';
import { Music2, Search, Play, Square, Bookmark, BookmarkCheck, Check, X, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { studio } from './api';

const fmtDur = (ms) => (ms ? `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}` : '');

/**
 * Pick an Instagram catalog track for a reel: what's trending right now (from Instagram, through
 * Zernio), a search, and the team's own sound board. `value` is {id, title, artist} or null.
 */
const SoundPicker = ({ value, onChange, compact = false }) => {
  const [tab, setTab] = useState('trending');
  const [q, setQ] = useState('');
  const [list, setList] = useState(null);
  const [board, setBoard] = useState([]);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState('');
  const audioRef = useRef(null);

  const loadBoard = () => supabase.from('sound_board').select('*').order('created_at', { ascending: false }).limit(100).then(({ data }) => setBoard(data || []));
  useEffect(() => { loadBoard(); }, []);

  const search = async (query = '') => {
    setError(''); setList(null);
    try {
      const out = await studio('audio', { q: query, type: 'music' });
      setList(out.audio || []);
    } catch (e) { setError(e.message); setList([]); }
  };
  useEffect(() => { if (tab === 'trending') Promise.resolve().then(() => search('')); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = (a) => {
    const el = audioRef.current;
    if (!el) return;
    if (playing === a.id) { el.pause(); setPlaying(''); return; }
    if (!a.preview) { setError('No preview for this track. Pick it and it plays in the published reel.'); return; }
    el.src = a.preview; el.play().catch(() => setError('Preview did not play. It still works in the published reel.'));
    setPlaying(a.id);
  };
  const save = async (a) => {
    await supabase.from('sound_board').upsert({ audio_id: a.id, title: a.title, artist: a.artist, audio_type: a.type, duration_ms: a.durationMs, artwork_url: a.artwork, trending_seen_at: tab === 'trending' ? new Date().toISOString() : null }, { onConflict: 'audio_id' });
    loadBoard();
  };
  const remove = async (b) => { await supabase.from('sound_board').delete().eq('id', b.id); loadBoard(); };
  const saved = new Set(board.map((b) => b.audio_id));
  const pick = (a) => onChange(value?.id === a.id ? null : { id: a.id, title: a.title, artist: a.artist });

  const Row = ({ a, onBoard }) => (
    <li className={`sp-row ${value?.id === a.id ? 'is-on' : ''}`}>
      {a.artwork ? <img src={a.artwork} alt="" /> : <span className="sp-art"><Music2 size={16} /></span>}
      <button type="button" className="sp-main" onClick={() => pick(a)} aria-pressed={value?.id === a.id}>
        <strong>{a.title || 'Untitled'}</strong>
        <small>{[a.artist, fmtDur(a.durationMs)].filter(Boolean).join(' · ')}</small>
      </button>
      {a.preview && <button type="button" className="ds-icon-btn" onClick={() => preview(a)} aria-label={playing === a.id ? 'Stop' : 'Preview'}>{playing === a.id ? <Square size={14} /> : <Play size={14} />}</button>}
      {onBoard
        ? <button type="button" className="ds-icon-btn" onClick={() => remove(onBoard)} aria-label="Remove from sound board"><X size={14} /></button>
        : <button type="button" className="ds-icon-btn" onClick={() => save(a)} aria-label={saved.has(a.id) ? 'On the sound board' : 'Save to the sound board'}>{saved.has(a.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}</button>}
    </li>
  );

  return (
    <div className={`sp ${compact ? 'sp--compact' : ''}`}>
      <audio ref={audioRef} onEnded={() => setPlaying('')} hidden />
      {value && <p className="sp-picked"><Check size={14} /> <span>{value.title}{value.artist ? ` · ${value.artist}` : ''}</span><button type="button" className="k-link" onClick={() => onChange(null)}>Remove</button></p>}
      <div className="ds-tabs-inline" role="tablist">
        <button role="tab" aria-selected={tab === 'trending'} onClick={() => setTab('trending')}><TrendingUp size={14} /> Trending now</button>
        <button role="tab" aria-selected={tab === 'search'} onClick={() => setTab('search')}><Search size={14} /> Search</button>
        <button role="tab" aria-selected={tab === 'board'} onClick={() => setTab('board')}><Bookmark size={14} /> Sound board {board.length ? `(${board.length})` : ''}</button>
      </div>
      {tab === 'search' && (
        <form className="sp-search" onSubmit={(e) => { e.preventDefault(); search(q); }}>
          <input className="k-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Song, artist or mood" aria-label="Search Instagram audio" />
          <button className="k-btn k-btn--ghost k-btn--sm">Search</button>
        </form>
      )}
      {error && <p className="k-error">{error}</p>}
      <ul className="sp-list">
        {tab === 'board'
          ? (board.length ? board.map((b) => <Row key={b.id} a={{ id: b.audio_id, title: b.title, artist: b.artist, durationMs: b.duration_ms, artwork: b.artwork_url }} onBoard={b} />) : <li className="ds-muted">Save trending tracks here to find them again.</li>)
          : list === null && !error ? <li className="ds-muted">Loading…</li>
            : (list || []).length ? (list || []).map((a) => <Row key={a.id} a={a} />) : !error && <li className="ds-muted">Nothing found.</li>}
      </ul>
      <p className="ds-muted sp-note">Instagram only offers tracks cleared for business accounts, so the list differs from the app. The track is attached when the reel publishes; the published reel can’t be previewed first.</p>
    </div>
  );
};

export default SoundPicker;
