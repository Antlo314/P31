import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays, ChevronLeft, ChevronRight, Sparkles, Plus, Check, Send, Trash2, Clapperboard, Image as ImageIcon, Images, CircleDot, X, Wand2, Music2, Copy, Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DashHead } from '../apps/DashShell';
import { studio, uploadMedia, fmtET } from './api';
import { postPack, monthPlan } from './ai';
import SoundPicker from './SoundPicker';
import { fetchUpcomingEvents, formatEventDate, showDate } from '../lib/events';
import Card from './factory/Card';
import { renderCard } from './factory/render';

const KIND = { reel: ['Reel', Clapperboard], photo: ['Photo', ImageIcon], carousel: ['Carousel', Images], story: ['Story', CircleDot] };
const STATUS = {
  idea: ['Idea', ''], draft: ['Draft', ''], ready: ['Ready for review', 'ds-pill--gold'], approved: ['Approved', 'ds-pill--green'],
  scheduled: ['Scheduled', 'ds-pill--green'], posted: ['Posted', ''], skipped: ['Skipped', ''],
};
const PILLARS = ['Market countdown', 'Curator spotlight', 'Faith & encouragement', 'Community', 'Mentorship & Collective', 'Shop the marketplace'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => iso(new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })));

/**
 * Content Studio → Planner: the social calendar, months ahead. Ideas and drafts live here
 * (with AI help for hooks, captions and hashtags); a person approves, then one tap schedules
 * the post through Zernio for its day and time.
 */
const StudioPlanner = () => {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [view, setView] = useState(window.matchMedia('(max-width: 720px)').matches ? 'list' : 'month');

  const first = iso(month);
  const last = iso(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('content_plan').select('*').gte('post_date', first).lte('post_date', last).order('post_date').order('post_time');
    if (err) { setError(/does not exist|schema cache/.test(err.message) ? 'Run storefront_v33_content_and_vendors.sql in Supabase to turn on the planner.' : err.message); return; }
    setError(''); setItems(data || []);
  }, [first, last]);
  useEffect(() => { Promise.resolve().then(load); fetchUpcomingEvents().then(setEvents); }, [load]);

  const byDay = useMemo(() => {
    const m = new Map();
    items.forEach((it) => { if (!m.has(it.post_date)) m.set(it.post_date, []); m.get(it.post_date).push(it); });
    return m;
  }, [items]);
  const days = useMemo(() => {
    const start = new Date(month);
    start.setDate(1 - start.getDay());
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);
  const eventsByDay = useMemo(() => Object.fromEntries(events.filter((e) => showDate(e)).map((e) => [e.event_date, e])), [events]);

  const add = async (date) => {
    const { data } = await supabase.from('content_plan').insert({ post_date: date, post_time: '18:00', status: 'idea', kind: 'reel' }).select('*').single();
    await load();
    if (data) setOpen(data);
  };

  // A month of ideas from the writing helper, dropped into empty days.
  const planMonth = async () => {
    setBusy('plan'); setError('');
    try {
      const name = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const evs = events.filter((e) => e.event_date >= first && e.event_date <= last).map((e) => `${e.title} on ${formatEventDate(e.event_date)}`).join('; ');
      const ideas = await monthPlan({ month: name, count: 12, events: evs });
      const rows = ideas.map((p) => ({
        post_date: `${month.getFullYear()}-${pad(month.getMonth() + 1)}-${pad(Math.min(p.day, new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()))}`,
        post_time: '18:00', kind: p.kind, pillar: p.pillar, theme: p.theme, hook: p.hook, caption: p.caption, hashtags: p.hashtags, status: 'draft',
      }));
      if (rows.length) await supabase.from('content_plan').insert(rows);
      await load();
    } catch (e) { setError(e.message); }
    setBusy('');
  };

  const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, items.filter((i) => i.status === k).length]));
  const title = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <>
      <DashHead eyebrow="Content Studio" title="Content" accent="planner" lead="Plan months ahead. The writing helper drafts hooks, captions and hashtags; you approve; one tap schedules it to Instagram and Facebook."
        actions={<button className="k-btn k-btn--gold" onClick={planMonth} disabled={!!busy}>{busy === 'plan' ? <><Loader2 size={16} className="pe-spin" /> Planning…</> : <><Sparkles size={16} /> Plan this month with AI</>}</button>} />
      <div className="pl-bar">
        <div className="pl-nav">
          <button className="ds-icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={18} /></button>
          <h2>{title}</h2>
          <button className="ds-icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={18} /></button>
        </div>
        <div className="pl-counts">
          {['draft', 'ready', 'approved', 'scheduled'].map((k) => counts[k] ? <span key={k} className={`ds-pill ${STATUS[k][1]}`}>{counts[k]} {STATUS[k][0].toLowerCase()}</span> : null)}
        </div>
        <div className="ds-tabs-inline pl-view" role="tablist">
          <button role="tab" aria-selected={view === 'month'} onClick={() => setView('month')}>Month</button>
          <button role="tab" aria-selected={view === 'list'} onClick={() => setView('list')}>List</button>
        </div>
      </div>
      {error && <p className="k-error">{error}</p>}

      {view === 'month' ? (
        <div className="pl-month" role="grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="pl-dow">{d}</div>)}
          {days.map((d) => {
            const key = iso(d);
            const inMonth = d.getMonth() === month.getMonth();
            const list = byDay.get(key) || [];
            const ev = eventsByDay[key];
            return (
              <div key={key} className={`pl-day ${inMonth ? '' : 'is-out'} ${key === todayISO() ? 'is-today' : ''}`} role="gridcell">
                <div className="pl-day__head"><span>{d.getDate()}</span><button type="button" className="pl-add" onClick={() => add(key)} aria-label={`Add a post on ${key}`}><Plus size={13} /></button></div>
                {ev && <span className="pl-event" title={ev.title}><CalendarDays size={11} /> {ev.title}</span>}
                {list.map((it) => { const Icon = (KIND[it.kind] || KIND.reel)[1]; return (
                  <button type="button" key={it.id} className={`pl-item pl-item--${it.status}`} onClick={() => setOpen(it)} title={it.theme || it.hook || ''}>
                    <Icon size={11} /> <span>{it.hook || it.theme || 'Untitled'}</span>
                  </button>
                ); })}
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="ds-list">
          {items.map((it) => { const Icon = (KIND[it.kind] || KIND.reel)[1]; return (
            <li key={it.id}><button className="ds-row" onClick={() => setOpen(it)}>
              <Icon size={18} />
              <div><strong>{it.hook || it.theme || 'Untitled'}</strong><small>{new Date(`${it.post_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}{it.post_time ? ` · ${it.post_time.slice(0, 5)}` : ''}{it.pillar ? ` · ${it.pillar}` : ''}</small></div>
              <span className={`ds-pill ${STATUS[it.status]?.[1] || ''}`}>{STATUS[it.status]?.[0] || it.status}</span>
            </button></li>
          ); })}
          {!items.length && <li className="ds-muted">Nothing planned this month yet. Tap “Plan this month with AI”, or add a day.</li>}
          <li><button className="k-btn k-btn--ghost k-btn--sm" onClick={() => add(first)}><Plus size={14} /> Add a post</button></li>
        </ul>
      )}

      {open && <PlanItem item={open} events={events} onClose={() => setOpen(null)} onChanged={async (next) => { await load(); if (next) setOpen(next); }} />}
    </>
  );
};

/** One planned post: edit, draft with AI, pick a sound, add media, approve, schedule. */
const PlanItem = ({ item, events, onClose, onChanged }) => {
  const navigate = useNavigate();
  const [f, setF] = useState(item);
  const [pack, setPack] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [sound, setSound] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const media = Array.isArray(f.media) ? f.media : [];

  const save = async (patch = {}) => {
    const row = { ...f, ...patch };
    const { data, error: err } = await supabase.from('content_plan').update({
      post_date: row.post_date, post_time: row.post_time || null, platforms: row.platforms, kind: row.kind, pillar: row.pillar || null, theme: row.theme || null,
      hook: row.hook || null, caption: row.caption || null, hashtags: row.hashtags || null, first_comment: row.first_comment || null, media: row.media || [],
      audio_id: row.audio_id || null, audio_title: row.audio_title || null, status: row.status, notes: row.notes || null,
      ...(patch.status === 'approved' ? { approved_at: new Date().toISOString(), approved_by: (await supabase.auth.getUser()).data.user?.id || null } : {}),
    }).eq('id', f.id).select('*').single();
    if (err) { setError(err.message); return null; }
    setF(data); onChanged(data); return data;
  };

  const draft = async () => {
    setBusy('ai'); setError('');
    try {
      const ev = events.find((e) => Math.abs(new Date(e.event_date) - new Date(f.post_date)) < 10 * 864e5);
      const p = await postPack({ kind: f.kind, topic: f.theme || f.hook || 'a post for Proverbs 31 Marketplace', pillar: f.pillar, event: ev ? `${ev.title} on ${formatEventDate(ev.event_date)}` : '' });
      setPack(p);
      setF((x) => ({ ...x, hook: x.hook || p.hooks[0] || '', caption: x.caption || p.captions[0] || '', hashtags: x.hashtags || p.hashtags.join(' '), first_comment: x.first_comment || p.firstComment, status: x.status === 'idea' ? 'draft' : x.status }));
    } catch (e) { setError(e.message); }
    setBusy('');
  };

  const addFiles = async (files) => {
    setError('');
    for (const file of [...files].slice(0, 10 - media.length)) {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      setBusy(`Uploading ${file.name}…`);
      try { const url = await uploadMedia(file); setF((x) => ({ ...x, media: [...(x.media || []), { type, url, name: file.name }] })); } catch (e) { setError(e.message); }
    }
    setBusy('');
  };

  const schedule = async () => {
    setError('');
    if (!media.length && !f.card && f.platforms.includes('instagram')) return setError('Instagram needs a photo or video. Add media first.');
    if (!f.caption) return setError('Write (or draft) the caption first.');
    setBusy('schedule');
    try {
      // A generated card is drawn and uploaded on the way out.
      let items = media;
      if (!items.length && f.card) {
        const file = await renderCard(f.card, `p31-${f.post_date}-${f.card.type}.jpg`);
        const url = await uploadMedia(file, file.name);
        items = [{ type: 'image', url, name: file.name }];
      }
      const when = `${f.post_date}T${(f.post_time || '18:00').slice(0, 5)}`;
      const out = await studio('create', {
        platforms: f.platforms, content: `${f.caption}${f.hashtags ? `\n\n${f.hashtags}` : ''}`.trim(), scheduledFor: when, timezone: 'America/New_York',
        media: items.map((m) => ({ type: m.type, url: m.url })), audioId: f.audio_id || undefined, firstComment: f.first_comment || undefined,
        title: f.hook || f.theme || undefined,
      });
      await save({ status: 'scheduled', media: items, zernio_post_id: out.post?.id || null, scheduled_for: out.post?.scheduledFor || null });
    } catch (e) { setError(e.message); }
    setBusy('');
  };

  const remove = async () => {
    if (!window.confirm('Delete this planned post? This cannot be undone.')) return;
    await supabase.from('content_plan').delete().eq('id', f.id); onChanged(null); onClose();
  };
  const KindIcon = (KIND[f.kind] || KIND.reel)[1];

  return (
    <div className="ds-sheet" role="dialog" aria-modal="true" aria-label="Planned post" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ds-sheet__panel pl-sheet">
        <div className="ds-sheet__head">
          <strong><KindIcon size={16} /> {new Date(`${f.post_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} <span className={`ds-pill ${STATUS[f.status]?.[1] || ''}`}>{STATUS[f.status]?.[0]}</span></strong>
          <button className="ds-icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="pl-form">
          <div className="pl-row3">
            <label className="k-field"><span>Day</span><input type="date" value={f.post_date} onChange={set('post_date')} /></label>
            <label className="k-field"><span>Time (Eastern)</span><input type="time" value={(f.post_time || '18:00').slice(0, 5)} onChange={set('post_time')} /></label>
            <label className="k-field"><span>Format</span><select value={f.kind} onChange={set('kind')}>{Object.entries(KIND).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
          </div>
          <div className="pl-row3">
            <label className="k-field"><span>Pillar</span><select value={f.pillar || ''} onChange={set('pillar')}><option value="">—</option>{PILLARS.map((p) => <option key={p}>{p}</option>)}</select></label>
            <div className="k-field"><span>Post to</span><div className="k-segs">{['instagram', 'facebook'].map((p) => <button type="button" key={p} aria-pressed={f.platforms.includes(p)} onClick={() => setF({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] })}>{p === 'instagram' ? 'Instagram' : 'Facebook'}</button>)}</div></div>
          </div>
          <label className="k-field"><span>What it’s about</span><input value={f.theme || ''} onChange={set('theme')} placeholder="e.g. Behind the scenes setting up the Winter Gala" /></label>
          <div className="pl-ai">
            <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={draft} disabled={!!busy}>{busy === 'ai' ? <><Loader2 size={14} className="pe-spin" /> Writing…</> : <><Wand2 size={14} /> Draft hook, caption & hashtags</>}</button>
            {pack && <span className="ds-muted">{pack.bestTime}</span>}
          </div>
          <label className="k-field"><span>Hook (on screen, first 2 seconds)</span><input value={f.hook || ''} onChange={set('hook')} maxLength={60} placeholder="3–8 words that stop the scroll" /></label>
          {pack?.hooks?.length > 1 && <div className="pl-options">{pack.hooks.map((h) => <button type="button" key={h} className="sys-chip" onClick={() => setF({ ...f, hook: h })}>{h}</button>)}</div>}
          <label className="k-field"><span>Caption</span><textarea rows={5} value={f.caption || ''} onChange={set('caption')} /></label>
          {pack?.captions?.length > 1 && <div className="pl-options">{pack.captions.map((c, i) => <button type="button" key={i} className="sys-chip" onClick={() => setF({ ...f, caption: c })}>Caption {i + 1}</button>)}</div>}
          <div className="pl-row2">
            <label className="k-field"><span>Hashtags</span><input value={f.hashtags || ''} onChange={set('hashtags')} placeholder="#five #specific #tags" /></label>
            <label className="k-field"><span>First comment (photos & carousels)</span><input value={f.first_comment || ''} onChange={set('first_comment')} placeholder="A link or a question" /></label>
          </div>
          <div className="k-field"><span>Media {f.platforms.includes('instagram') ? '(needed for Instagram)' : ''}</span>
            <div className="pl-media">
              {f.card && !media.length && <Card spec={f.card} scale={0.0667} />}
              {media.map((m, i) => <figure key={m.url}>{m.type === 'video' ? <video src={m.url} muted playsInline /> : <img src={m.url} alt="" />}<button type="button" className="ds-icon-btn" onClick={() => setF({ ...f, media: media.filter((_, j) => j !== i) })} aria-label="Remove"><X size={12} /></button></figure>)}
              <label className="pl-drop"><Plus size={16} /> Add<input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} /></label>
              <button type="button" className="pl-drop" onClick={() => navigate('/studio/create', { state: { planId: f.id } })}><Clapperboard size={16} /> Make a reel</button>
            </div>
          </div>
          {f.kind === 'reel' && (
            <div className="k-field"><span><Music2 size={14} /> Instagram audio {f.audio_title ? `· ${f.audio_title}` : ''}</span>
              {sound ? <SoundPicker compact value={f.audio_id ? { id: f.audio_id, title: f.audio_title } : null} onChange={(a) => { setF({ ...f, audio_id: a?.id || null, audio_title: a ? [a.title, a.artist].filter(Boolean).join(' · ') : null }); }} />
                : <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => setSound(true)}><Music2 size={14} /> {f.audio_id ? 'Change track' : 'Pick a trending track'}</button>}
            </div>
          )}
          <label className="k-field"><span>Notes for the team</span><input value={f.notes || ''} onChange={set('notes')} /></label>
          {error && <p className="k-error" role="alert">{error}</p>}
          {busy && busy !== 'ai' && busy !== 'schedule' && <p className="ds-muted" role="status">{busy}</p>}
        </div>
        <div className="ds-sheet__foot pl-foot">
          <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => save()} disabled={!!busy}><Check size={14} /> Save</button>
          {f.status !== 'scheduled' && f.status !== 'posted' && <>
            {['idea', 'draft'].includes(f.status) && <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => save({ status: 'ready' })} disabled={!!busy}>Ready for review</button>}
            {f.status !== 'approved' && <button className="k-btn k-btn--plum k-btn--sm" onClick={() => save({ status: 'approved' })} disabled={!!busy}><Check size={14} /> Approve</button>}
            {f.status === 'approved' && <button className="k-btn k-btn--gold k-btn--sm" onClick={schedule} disabled={!!busy}>{busy === 'schedule' ? 'Scheduling…' : <><Send size={14} /> Schedule it</>}</button>}
          </>}
          {f.status === 'scheduled' && <span className="ds-muted">Scheduled {f.scheduled_for ? fmtET(f.scheduled_for) : ''} · manage it on the Calendar</span>}
          <button className="k-btn k-btn--ghost k-btn--sm" onClick={async () => { const { data } = await supabase.from('content_plan').insert({ ...f, id: undefined, status: 'draft', zernio_post_id: null, scheduled_for: null, approved_at: null, approved_by: null, created_at: undefined, updated_at: undefined }).select('*').single(); if (data) { onChanged(data); } }} disabled={!!busy}><Copy size={14} /> Duplicate</button>
          <button className="k-btn k-btn--ghost k-btn--sm pl-del" onClick={remove} disabled={!!busy}><Trash2 size={14} /> Delete</button>
        </div>
      </div>
    </div>
  );
};

export default StudioPlanner;
