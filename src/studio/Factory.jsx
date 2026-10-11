import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wand2, Sparkles, Check, Send, Trash2, RefreshCw, Loader2, CalendarDays, Clock, Palette, ListChecks, BookOpen, Plus, ChevronDown, ChevronUp, AlertCircle, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DashHead } from '../apps/DashShell';
import { studio, uploadMedia, bestSlotsET } from './api';
import { askAi } from './ai';
import { TYPES, STYLES, DEFAULT_SLOTS, mergeLibrary } from './factory/library';
import { buildPlan, isoDate, facebookText } from './factory/generate';
import { FitCard } from './factory/Card';
import { renderCard } from './factory/render';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const tomorrow = () => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })); d.setDate(d.getDate() + 1); return isoDate(d); };
const defaultMix = () => Object.fromEntries(Object.entries(TYPES).map(([k, t]) => [k, t.share]));
const timeLabel = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const dayLabel = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const missingTable = (msg = '') => /does not exist|schema cache|column/i.test(msg);

/**
 * Content Studio → Auto-create: choose the kinds of posts, the look, how many days and the times;
 * the Studio drafts every card and caption, you look them over (pre-posts), then save them to the
 * Planner or schedule the whole run to Instagram and Facebook in one go.
 */
const StudioFactory = () => {
  const [tab, setTab] = useState('make');
  const [settings, setSettings] = useState(() => ({ start: tomorrow(), days: 30, cadence: 'daily', mix: defaultMix(), style: 'night', platforms: ['instagram', 'facebook'], timing: 'best', slots: DEFAULT_SLOTS, skipTaken: true }));
  const [library, setLibrary] = useState(() => mergeLibrary([]));
  const [libOk, setLibOk] = useState(null); // null unknown, true table present, false run v36
  const [taken, setTaken] = useState({ dates: new Set(), keys: new Set() });
  const [best, setBest] = useState(null);
  const [plan, setPlan] = useState(null);
  const [seed, setSeed] = useState(1);
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [queue, setQueue] = useState([]);
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  // The team's library, what is already booked, and the best times from Zernio.
  const loadLibrary = useCallback(async () => {
    const { data, error: err } = await supabase.from('content_library').select('*').order('created_at');
    if (err) { setLibOk(missingTable(err.message) ? false : null); setLibrary(mergeLibrary([])); return; }
    setLibOk(true); setLibrary(mergeLibrary(data || []));
  }, []);
  const loadTaken = useCallback(async () => {
    const dates = new Set(); const keys = new Set();
    const { data } = await supabase.from('content_plan').select('post_date, source_key, status').gte('post_date', isoDate(new Date(Date.now() - 120 * 864e5)));
    (data || []).forEach((r) => { if (r.status !== 'skipped') { dates.add(r.post_date); if (r.source_key) keys.add(r.source_key); } });
    try {
      const z = await studio('posts');
      (z?.scheduled || []).forEach((p) => { if (p.scheduledFor) dates.add(isoDate(new Date(new Date(p.scheduledFor).toLocaleString('en-US', { timeZone: 'America/New_York' })))); });
    } catch { /* Zernio unreachable: plan from the Planner alone */ }
    setTaken({ dates, keys });
  }, []);
  const loadQueue = useCallback(async () => {
    const { data } = await supabase.from('content_plan').select('*').not('card', 'is', null).in('status', ['draft', 'ready', 'approved']).order('post_date').limit(200);
    setQueue(data || []);
  }, []);
  useEffect(() => {
    Promise.resolve().then(() => { loadLibrary(); loadTaken(); loadQueue(); });
    studio('overview').then((o) => { const slots = bestSlotsET(o?.bestTime?.slots || [], 14); if (slots.length) setBest(slots); }).catch(() => {});
  }, [loadLibrary, loadTaken, loadQueue]);

  // Hours per weekday: from the best-time data when asked, else the defaults / the team's own.
  const slots = useMemo(() => {
    if (settings.timing === 'best' && best?.length) {
      // Best engagement hours per weekday, kept to waking hours (7 AM – 9 PM Eastern).
      const by = {};
      best.filter((s) => s.hour >= 7 && s.hour <= 21).forEach((s) => { (by[s.day] = by[s.day] || []).push(s.hour); });
      return Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, (by[d] || []).slice(0, 2).length ? by[d].slice(0, 2) : DEFAULT_SLOTS[d]]));
    }
    return settings.timing === 'custom' ? settings.slots : DEFAULT_SLOTS;
  }, [settings.timing, settings.slots, best]);

  const preview = () => {
    setError(''); setDone('');
    const rows = buildPlan({ ...settings, slots, skipDates: settings.skipTaken ? taken.dates : new Set(), library, usedKeys: taken.keys, seed });
    if (!rows.length) { setError('Nothing to plan: turn on at least one post type, or allow days that already have a post.'); return; }
    setPlan(rows);
    setTab('preview');
  };
  const reshuffle = () => { setSeed((s) => s + 1); setTimeout(() => { const rows = buildPlan({ ...settings, slots, skipDates: settings.skipTaken ? taken.dates : new Set(), library, usedKeys: taken.keys, seed: seed + 1 }); setPlan(rows); }, 0); };
  const update = (i, patch) => setPlan((p) => p.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const swap = (i) => {
    const row = plan[i];
    const kindKey = { fill: 'verse', prompt: 'prompt', choice: 'choice', quiz: 'quiz', amen: 'amen', cta: 'invite', tip: 'tip' }[row.type];
    const usedNow = new Set([...taken.keys, ...plan.map((r) => r.source_key)]);
    const pool = (library[kindKey] || []).filter((x) => x.active !== false && !usedNow.has(x.key));
    const pick = (pool.length ? pool : (library[kindKey] || []).filter((x) => x.key !== row.source_key))[0];
    if (!pick) return;
    const fresh = buildPlan({ ...settings, start: row.post_date, days: 1, cadence: 'daily', mix: { [row.type]: 1 }, slots, library: { ...library, [kindKey]: [pick] }, usedKeys: new Set(), seed: seed + i })[0];
    if (fresh) update(i, { ...fresh, post_time: row.post_time });
  };
  const rewrite = async (i) => {
    const row = plan[i];
    setBusy(`ai-${i}`); setError('');
    try {
      const [first] = await askAi('caption', { topic: `${TYPES[row.type].label}: ${row.card.text || row.card.title || ''}`, platforms: 'Instagram and Facebook', details: 'End with one question that invites a comment. Keep any scripture quote exactly as given.', maxChars: 500 });
      if (first) update(i, { caption: first.trim() });
    } catch (e) { setError(e.message); }
    setBusy('');
  };

  // Save the run to the Planner (drafts), or schedule it straight through Zernio.
  const persist = async (rows, status, extra = {}) => {
    const series = crypto.randomUUID();
    const base = rows.map((r) => ({ post_date: r.post_date, post_time: r.post_time, platforms: r.platforms, kind: 'photo', pillar: r.pillar, theme: r.theme, hook: r.hook, caption: r.caption, status, ...extra[r.post_date] }));
    let { error: err } = await supabase.from('content_plan').insert(base.map((b, i) => ({ ...b, card: rows[i].card, source_key: rows[i].source_key, series_id: series })));
    if (err && missingTable(err.message)) { ({ error: err } = await supabase.from('content_plan').insert(base)); if (!err) setLibOk(false); }
    if (err) throw new Error(err.message);
    if (libOk) await supabase.from('content_series').insert({ id: series, name: `${rows.length} posts from ${rows[0].post_date}`, settings: { ...settings, slots }, post_count: rows.length }).then(() => {});
    return series;
  };
  const saveDrafts = async () => {
    setBusy('save'); setError('');
    try { await persist(plan, 'draft'); setDone(`${plan.length} posts saved to the Planner as drafts.`); setPlan(null); setTab('queue'); await loadQueue(); await loadTaken(); }
    catch (e) { setError(e.message); }
    setBusy('');
  };
  const scheduleRows = async (rows, fromQueue = false) => {
    setBusy('schedule'); setError(''); setProgress({ done: 0, total: rows.length, failed: [] });
    const results = {};
    for (const [i, r] of rows.entries()) {
      try {
        const file = await renderCard(r.card, `p31-${r.post_date}-${r.type || r.card.type}.jpg`);
        const url = await uploadMedia(file, file.name);
        const link = r.card.type === 'cta' ? (library.invite.find((x) => x.key === r.source_key)?.url || '') : '';
        const out = await studio('create', {
          platforms: r.platforms, content: r.caption, igContent: r.caption, fbContent: facebookText(r.caption, link),
          scheduledFor: `${r.post_date}T${r.post_time}`, timezone: 'America/New_York', media: [{ type: 'image', url }], title: r.hook,
        });
        results[r.post_date] = { status: 'scheduled', media: [{ type: 'image', url }], zernio_post_id: out.post?.id || null, scheduled_for: out.post?.scheduledFor || null };
        if (fromQueue) await supabase.from('content_plan').update(results[r.post_date]).eq('id', r.id);
      } catch (e) {
        setProgress((p) => ({ ...p, failed: [...p.failed, `${dayLabel(r.post_date)}: ${e.message}`] }));
      }
      setProgress((p) => ({ ...p, done: i + 1 }));
    }
    if (!fromQueue) {
      const ok = rows.filter((r) => results[r.post_date]);
      const rest = rows.filter((r) => !results[r.post_date]);
      if (ok.length) await persist(ok, 'scheduled', results).catch((e) => setError(e.message));
      if (rest.length) await persist(rest, 'draft').catch(() => {});
      setDone(`${ok.length} of ${rows.length} posts scheduled to Instagram and Facebook.${rest.length ? ` ${rest.length} saved as drafts to retry.` : ''}`);
      setPlan(null); setTab('queue');
    } else {
      setDone(`${rows.length - (progress?.failed.length || 0)} scheduled.`);
    }
    await loadQueue(); await loadTaken();
    setBusy('');
  };

  const counts = useMemo(() => (plan || []).reduce((m, r) => ({ ...m, [r.type]: (m[r.type] || 0) + 1 }), {}), [plan]);
  const approvedQueue = queue.filter((q) => q.status === 'approved');

  return (
    <>
      <DashHead eyebrow="Content Studio" title="Auto-create" accent="a month of posts" lead="Pick the kinds of posts, the look and how many days. The Studio drafts every card and caption from your library at the times your followers are online; you look them over, then schedule the lot."
        actions={<Link to="/studio/planner" className="k-btn k-btn--ghost k-btn--sm"><CalendarDays size={15} /> Planner</Link>} />
      <div className="ds-tabs-inline fc-tabs" role="tablist">
        {[['make', 'Choose the mix', Wand2], ['preview', `Preview${plan ? ` (${plan.length})` : ''}`, Eye], ['queue', `Pre-posts${queue.length ? ` (${queue.length})` : ''}`, ListChecks], ['library', 'Library', BookOpen]].map((t) => {
          const Icon = t[2];
          return <button key={t[0]} role="tab" aria-selected={tab === t[0]} onClick={() => setTab(t[0])} disabled={t[0] === 'preview' && !plan}><Icon size={14} style={{ verticalAlign: '-2px' }} /> {t[1]}</button>;
        })}
      </div>
      {libOk === false && <p className="fc-note"><AlertCircle size={14} /> Run <code>storefront_v36_content_factory.sql</code> in Supabase to keep your own verses and prompts and remember which were used. Until then the starter library is used.</p>}
      {error && <p className="k-error" role="alert">{error}</p>}
      {done && <p className="fc-done"><Check size={14} /> {done}</p>}

      {tab === 'make' && (
        <div className="fc-grid">
          <section className="ds-card fc-card">
            <h2><ListChecks size={18} /> What to post</h2>
            <p className="ds-muted">Shares of the run. Sunday word lands on Sundays; invitations at most once a week.</p>
            <div className="fc-types">
              {Object.entries(TYPES).map(([k, t]) => (
                <label key={k} className={`fc-type ${settings.mix[k] > 0 ? 'is-on' : ''}`}>
                  <input type="checkbox" checked={settings.mix[k] > 0} onChange={(e) => set('mix', { ...settings.mix, [k]: e.target.checked ? (TYPES[k].share || 10) : 0 })} />
                  <div><strong>{t.label}</strong><small>{t.blurb}</small></div>
                  <input type="range" min="0" max="60" value={settings.mix[k]} onChange={(e) => set('mix', { ...settings.mix, [k]: Number(e.target.value) })} aria-label={`${t.label} share`} />
                  <span>{settings.mix[k]}%</span>
                </label>
              ))}
            </div>
          </section>

          <section className="ds-card fc-card">
            <h2><Palette size={18} /> The look</h2>
            <div className="fc-styles">
              {STYLES.map((s) => (
                <button type="button" key={s.id} className={`fc-style ${settings.style === s.id ? 'is-on' : ''}`} onClick={() => set('style', s.id)} aria-pressed={settings.style === s.id}>
                  <FitCard spec={{ type: 'fill', style: s.id, text: 'Who can find a virtuous woman? for her price is far above', ref: 'Proverbs 31:10' }} />
                  <strong>{s.name}</strong><small>{s.blurb}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="ds-card fc-card">
            <h2><CalendarDays size={18} /> How long</h2>
            <div className="fc-row">
              <label className="k-field"><span>Start</span><input type="date" value={settings.start} min={isoDate(new Date())} onChange={(e) => set('start', e.target.value)} /></label>
              <label className="k-field"><span>Days</span>
                <select value={settings.days} onChange={(e) => set('days', Number(e.target.value))}>{[7, 14, 21, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} days</option>)}</select>
              </label>
              <label className="k-field"><span>How often</span>
                <select value={settings.cadence} onChange={(e) => set('cadence', e.target.value === 'daily' ? 'daily' : Number(e.target.value))}>
                  <option value="daily">Every day</option><option value="5">5 a week</option><option value="4">4 a week</option><option value="3">3 a week</option><option value="2">2 a week</option>
                </select>
              </label>
            </div>
            <label className="fc-check"><input type="checkbox" checked={settings.skipTaken} onChange={(e) => set('skipTaken', e.target.checked)} /> Skip days that already have a post ({taken.dates.size} booked in the Planner and Zernio)</label>
            <div className="k-field"><span>Post to</span><div className="k-segs">{['instagram', 'facebook'].map((p) => <button type="button" key={p} aria-pressed={settings.platforms.includes(p)} onClick={() => set('platforms', settings.platforms.includes(p) ? settings.platforms.filter((x) => x !== p) : [...settings.platforms, p])}>{p === 'instagram' ? 'Instagram' : 'Facebook'}</button>)}</div></div>
          </section>

          <section className="ds-card fc-card">
            <h2><Clock size={18} /> When (Eastern)</h2>
            <div className="k-segs fc-segs">
              <button type="button" aria-pressed={settings.timing === 'best'} onClick={() => set('timing', 'best')}>Best times{best ? ' (from your data)' : ''}</button>
              <button type="button" aria-pressed={settings.timing === 'default'} onClick={() => set('timing', 'default')}>P31 defaults</button>
              <button type="button" aria-pressed={settings.timing === 'custom'} onClick={() => set('timing', 'custom')}>Custom</button>
            </div>
            <div className="fc-slots">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <div key={d} className="fc-slot">
                  <b>{DOW[d]}</b>
                  {settings.timing === 'custom' ? (
                    <input type="text" value={(settings.slots[d] || []).map((h) => timeLabel(`${Math.floor(h)}:${Math.round((h % 1) * 60)}`)).join(', ')} onChange={(e) => {
                      const hours = e.target.value.split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i); if (!m) return null; let h = Number(m[1]) % 12; if ((m[3] || '').toLowerCase() === 'pm') h += 12; if (!m[3] && Number(m[1]) > 12) h = Number(m[1]); return h + (Number(m[2] || 0) / 60); }).filter((h) => h != null);
                      set('slots', { ...settings.slots, [d]: hours.length ? hours : DEFAULT_SLOTS[d] });
                    }} placeholder="7 PM, 12:30 PM" />
                  ) : <span>{(slots[d] || []).map((h) => timeLabel(`${Math.floor(h)}:${Math.round((h % 1) * 60)}`)).join(' · ')}</span>}
                </div>
              ))}
            </div>
            <p className="ds-muted">{settings.timing === 'best' && best ? 'From Zernio’s engagement by day and hour over the last 30 days; where a day has no data, the P31 default is used.' : settings.timing === 'best' ? 'No analytics yet, so the P31 defaults apply: weekdays 12–1 PM and 7–8 PM, Saturday 6 PM, Sunday 1 PM.' : 'Posts alternate between the hours listed for each day.'}</p>
          </section>

          <div className="fc-actions">
            <button className="k-btn k-btn--gold" onClick={preview}><Sparkles size={16} /> Preview the posts</button>
          </div>
        </div>
      )}

      {tab === 'preview' && plan && (
        <>
          <div className="fc-summary">
            <strong>{plan.length} posts · {dayLabel(plan[0].post_date)} → {dayLabel(plan[plan.length - 1].post_date)}</strong>
            <span>{Object.entries(counts).map(([k, n]) => `${n} ${TYPES[k].short.toLowerCase()}`).join(' · ')}</span>
            <div className="fc-summary__btns">
              <button className="k-btn k-btn--ghost k-btn--sm" onClick={reshuffle} disabled={!!busy}><RefreshCw size={14} /> Reshuffle</button>
              <button className="k-btn k-btn--ghost k-btn--sm" onClick={saveDrafts} disabled={!!busy}>{busy === 'save' ? <Loader2 size={14} className="pe-spin" /> : <Check size={14} />} Save as drafts</button>
              <button className="k-btn k-btn--gold k-btn--sm" onClick={() => { if (window.confirm(`Schedule all ${plan.length} posts to ${settings.platforms.join(' and ')} now? Each one can still be changed or deleted on the Calendar before it goes out.`)) scheduleRows(plan); }} disabled={!!busy}><Send size={14} /> Schedule all</button>
            </div>
          </div>
          {progress && busy === 'schedule' && <Progress progress={progress} />}
          <div className="fc-list">
            {plan.map((r, i) => <Pre key={`${r.post_date}-${r.source_key}`} row={r} i={i} busy={busy} onChange={(patch) => update(i, patch)} onSwap={() => swap(i)} onRewrite={() => rewrite(i)} onRemove={() => setPlan((p) => p.filter((_, j) => j !== i))} />)}
          </div>
        </>
      )}

      {tab === 'queue' && (
        <>
          {progress && busy === 'schedule' && <Progress progress={progress} />}
          {progress && busy !== 'schedule' && progress.failed.length > 0 && <div className="fc-note"><AlertCircle size={14} /> {progress.failed.length} did not schedule: {progress.failed.join(' · ')}</div>}
          <div className="fc-summary">
            <strong>{queue.length} generated post{queue.length === 1 ? '' : 's'} waiting</strong>
            <span>Drafts and approved cards not yet sent. Open any in the Planner to edit; approve there or here.</span>
            <div className="fc-summary__btns">
              <button className="k-btn k-btn--gold k-btn--sm" onClick={() => approvedQueue.length && scheduleRows(approvedQueue.map((q) => ({ ...q, type: q.card?.type })), true)} disabled={!!busy || !approvedQueue.length}><Send size={14} /> Schedule {approvedQueue.length} approved</button>
            </div>
          </div>
          <div className="fc-list">
            {queue.map((q) => (
              <article key={q.id} className="fc-pre">
                <FitCard spec={q.card} />
                <div className="fc-pre__body">
                  <div className="fc-pre__head"><strong>{dayLabel(q.post_date)} · {timeLabel((q.post_time || '18:00').slice(0, 5))}</strong><span className={`ds-pill ${q.status === 'approved' ? 'ds-pill--green' : ''}`}>{q.status}</span></div>
                  <p className="fc-pre__cap">{q.caption}</p>
                  <div className="fc-pre__btns">
                    {q.status !== 'approved' && <button className="k-btn k-btn--plum k-btn--sm" onClick={async () => { await supabase.from('content_plan').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', q.id); loadQueue(); }}><Check size={14} /> Approve</button>}
                    <Link to="/studio/planner" className="k-btn k-btn--ghost k-btn--sm">Open in Planner</Link>
                    <button className="k-btn k-btn--ghost k-btn--sm fc-del" onClick={async () => { await supabase.from('content_plan').delete().eq('id', q.id); loadQueue(); }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </article>
            ))}
            {!queue.length && <p className="ds-muted">Nothing waiting. Generated posts you save as drafts show up here until they are scheduled.</p>}
          </div>
        </>
      )}

      {tab === 'library' && <Library library={library} libOk={libOk} onChanged={loadLibrary} />}
    </>
  );
};

const Progress = ({ progress }) => (
  <div className="fc-progress" role="status">
    <div className="fc-progress__bar"><i style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
    <span><Loader2 size={14} className="pe-spin" /> Drawing, uploading and scheduling {progress.done} of {progress.total}…{progress.failed.length ? ` ${progress.failed.length} failed so far.` : ''}</span>
  </div>
);

/** One previewed post: card, when, caption (editable), swap / rewrite / remove. */
const Pre = ({ row, i, busy, onChange, onSwap, onRewrite, onRemove }) => {
  const [open, setOpen] = useState(false);
  return (
    <article className={`fc-pre fc-pre--${row.type}`}>
      <FitCard spec={row.card} />
      <div className="fc-pre__body">
        <div className="fc-pre__head">
          <strong>{dayLabel(row.post_date)}</strong>
          <input type="time" value={row.post_time} onChange={(e) => onChange({ post_time: e.target.value })} aria-label="Time (Eastern)" />
          <span className="ds-pill">{TYPES[row.type]?.short}</span>
        </div>
        {open ? <textarea className="fc-pre__edit" rows={7} value={row.caption} onChange={(e) => onChange({ caption: e.target.value })} /> : <p className="fc-pre__cap">{row.caption}</p>}
        <div className="fc-pre__btns">
          <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => setOpen((o) => !o)}>{open ? <><ChevronUp size={14} /> Done</> : <><ChevronDown size={14} /> Edit caption</>}</button>
          <button className="k-btn k-btn--ghost k-btn--sm" onClick={onSwap} disabled={!!busy}><RefreshCw size={14} /> Swap</button>
          <button className="k-btn k-btn--ghost k-btn--sm" onClick={onRewrite} disabled={!!busy}>{busy === `ai-${i}` ? <Loader2 size={14} className="pe-spin" /> : <Wand2 size={14} />} Rewrite with AI</button>
          <button className="k-btn k-btn--ghost k-btn--sm fc-del" onClick={onRemove} disabled={!!busy} aria-label="Remove this post"><Trash2 size={14} /></button>
        </div>
      </div>
    </article>
  );
};

/** The library: everything the auto-create can draw from, with the team's own additions. */
const Library = ({ library, libOk, onChanged }) => {
  const [kind, setKind] = useState('verse');
  const [form, setForm] = useState({ kind: 'verse', text: '', answer: '', ref: '', a: '', b: '', c: '', d: '', ask: '' });
  const [msg, setMsg] = useState('');
  const kinds = [['verse', 'Verses (fill-in-the-blank)'], ['amen', 'Sunday word'], ['prompt', 'Finish the sentence'], ['choice', 'This or that'], ['quiz', 'Pop quiz'], ['tip', 'Business tips'], ['invite', 'Invitations']];
  const list = library[kind] || [];

  const add = async (e) => {
    e.preventDefault(); setMsg('');
    if (!libOk) return setMsg('Run storefront_v36_content_factory.sql first, then your additions are saved.');
    if (form.text.trim().length < 4) return setMsg('Write the text first.');
    const k = form.kind;
    const row = {
      kind: k, key: `${k}:${form.text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${Date.now().toString(36).slice(-4)}`,
      text: form.text.trim(), answer: k === 'verse' ? form.answer.trim() || null : k === 'quiz' ? (form.answer.trim().toUpperCase() || 'A') : null,
      ref: ['verse', 'amen'].includes(k) ? form.ref.trim() || null : null,
      options: k === 'choice' ? [form.a, form.b].filter(Boolean) : k === 'quiz' ? [form.a, form.b, form.c, form.d].filter(Boolean) : k === 'prompt' || k === 'tip' ? null : null,
      caption: null,
    };
    if (k === 'verse' && !row.answer) return setMsg('Give the blanked word.');
    if (k === 'choice' && row.options.length < 2) return setMsg('Both options are needed.');
    if (k === 'quiz' && row.options.length < 4) return setMsg('All four options are needed.');
    const { error } = await supabase.from('content_library').insert(row);
    if (error) return setMsg(error.message);
    setForm({ kind: k, text: '', answer: '', ref: '', a: '', b: '', c: '', d: '', ask: '' }); setMsg('Added.'); onChanged();
  };
  const toggle = async (item) => {
    if (!libOk) return setMsg('Run storefront_v36_content_factory.sql first to switch items on and off.');
    if (item.id) await supabase.from('content_library').update({ active: !item.active }).eq('id', item.id);
    else await supabase.from('content_library').insert({ kind: item.kind, key: item.key, text: item.text, answer: item.answer || null, ref: item.ref || null, options: item.options || (item.kind === 'invite' ? { eyebrow: item.eyebrow, title: item.title, items: item.items, pill: item.pill, url: item.url } : null), caption: item.caption || null, active: false });
    onChanged();
  };

  return (
    <div className="fc-lib">
      <div className="ds-tabs-inline fc-tabs" role="tablist">{kinds.map(([k, l]) => <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>{l} <small>({(library[k] || []).length})</small></button>)}</div>
      <ul className="ds-list fc-lib__list">
        {list.map((it) => (
          <li key={it.key} className={`ds-row fc-lib__row ${it.active === false ? 'is-off' : ''}`}>
            <div>
              <strong>{it.kind === 'verse' ? <>{it.text} <u>{it.answer}</u>.</> : it.kind === 'invite' ? it.eyebrow : it.text}</strong>
              <small>{it.ref ? `${it.ref} · ` : ''}{it.options && Array.isArray(it.options) ? it.options.join(' / ') + ' · ' : ''}{it.kind === 'quiz' && it.answer ? `answer ${it.answer} · ` : ''}used {it.used_count || 0}×{it.last_used ? ` · last ${it.last_used}` : ''}{it.custom ? ' · yours' : ''}</small>
            </div>
            <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => toggle(it)}>{it.active === false ? 'Turn on' : 'Turn off'}</button>
          </li>
        ))}
      </ul>
      <form className="ds-card fc-card fc-add" onSubmit={add}>
        <h2><Plus size={18} /> Add your own</h2>
        <div className="fc-row">
          <label className="k-field"><span>Kind</span><select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{kinds.filter(([k]) => k !== 'invite').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {['verse', 'amen'].includes(form.kind) && <label className="k-field"><span>Reference</span><input value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} placeholder="Proverbs 31:25" /></label>}
          {form.kind === 'verse' && <label className="k-field"><span>Blanked word</span><input value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} placeholder="come" /></label>}
          {form.kind === 'quiz' && <label className="k-field"><span>Correct letter</span><input value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} placeholder="B" maxLength={1} /></label>}
        </div>
        <label className="k-field"><span>{form.kind === 'verse' ? 'Verse, up to the blank (KJV, exact)' : form.kind === 'amen' ? 'Verse (KJV, exact)' : form.kind === 'prompt' ? 'Sentence to finish' : form.kind === 'choice' || form.kind === 'quiz' ? 'Question' : 'The tip'}</span><textarea rows={2} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} /></label>
        {(form.kind === 'choice' || form.kind === 'quiz') && (
          <div className="fc-row">
            <label className="k-field"><span>A</span><input value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} /></label>
            <label className="k-field"><span>B</span><input value={form.b} onChange={(e) => setForm({ ...form, b: e.target.value })} /></label>
            {form.kind === 'quiz' && <><label className="k-field"><span>C</span><input value={form.c} onChange={(e) => setForm({ ...form, c: e.target.value })} /></label><label className="k-field"><span>D</span><input value={form.d} onChange={(e) => setForm({ ...form, d: e.target.value })} /></label></>}
          </div>
        )}
        {msg && <p className="ds-muted">{msg}</p>}
        <div><button className="k-btn k-btn--plum k-btn--sm" type="submit"><Plus size={14} /> Add to the library</button></div>
      </form>
    </div>
  );
};

export default StudioFactory;
