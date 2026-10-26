import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Store, Users, Clock, Check, Save, RotateCcw, Send, Loader2, Layers, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  DAY_NAMES, MAX_PER_DAY, STREAMS, STREAM_KEYS, PLATFORM_LABEL, defaultSchedule, normalizeSchedule,
  describeStream, describeSchedule, streamProblems, streamActive, sortTimes, isTime,
} from '../../studio/factory/schedule';

// Systems > Posting schedule (v65): how often the content autopilot drafts posts, per brand. Saved to
// autopilot_settings.schedule; content-autopilot, Auto-create and the watchdog read the same row
// through src/studio/factory/schedule.js. Nothing posts without approval, whatever is set here.
// An empty schedule is the original autopilot (posts a day for the Marketplace, the best times,
// Market Instagram + Facebook); "Go back to the original" saves it empty again.

const ICON = { market: Store, collective: Users };
const MIX = [['quote', 'Bold quotes'], ['prayer', 'Prayers'], ['scripture', 'Scripture (KJV)'], ['blank', 'Fill in the blank'], ['curator', 'Curator invitations (Marketplace only)'], ['mentorship', 'Mentorship invitations']];
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // chips Monday first
const SUGGEST = ['12:30', '19:30', '15:00', '21:00', '09:00', '17:00', '11:00', '07:30'];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const missing = (e) => /does not exist|schema cache|relation/i.test(e?.message || '');

/** Times for n posts: keep the ones set, add good times that are not taken, drop the latest. */
const resizeTimes = (times, n) => {
  const list = sortTimes(times.filter(isTime));
  for (const t of SUGGEST) { if (list.length >= n) break; if (!list.includes(t)) list.push(t); }
  return sortTimes(list).slice(0, n);
};

/** One brand: on or off, posts a day, weekdays, times and platforms. */
const StreamEditor = ({ k, st, onChange }) => {
  const Icon = ICON[k];
  const set = (patch) => onChange({ ...st, ...patch });
  const setTimes = (i, v) => set({ times: st.times.map((t, j) => (j === i ? v : t)) });
  const problems = streamProblems(k, st);
  const preview = describeStream(k, Array.isArray(st.times) ? { ...st, times: sortTimes(st.times.filter(isTime)) } : st);
  return (
    <section className="sys-card">
      <h2><Icon size={18} /> {STREAMS[k].label}</h2>
      <div className="sys-chips">
        <button type="button" className={`sys-chip ${st.enabled ? 'is-on' : ''}`} aria-pressed={st.enabled} onClick={() => set({ enabled: !st.enabled })}>
          {st.enabled ? 'On: the autopilot drafts these' : 'Off: no posts drafted'}
        </button>
      </div>
      {st.enabled && (
        <>
          <div className="sys-row">
            <label className="sys-field"><span>Posts a day</span>
              <select value={st.posts_per_day} onChange={(e) => { const n = Number(e.target.value); set({ posts_per_day: n, ...(Array.isArray(st.times) ? { times: resizeTimes(st.times, n) } : {}) }); }}>
                {Array.from({ length: MAX_PER_DAY + 1 }, (_, n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div className="sys-field"><span>Days</span>
            <div className="sys-chips" role="group" aria-label={`${STREAMS[k].label} posting days`}>
              {WEEK.map((d) => {
                const on = st.days.includes(d);
                return <button type="button" key={d} className={`sys-chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => set({ days: on ? st.days.filter((x) => x !== d) : [...st.days, d].sort((a, b) => a - b) })}>{DAY_NAMES[d]}</button>;
              })}
              <button type="button" className="sys-chip" style={{ textTransform: 'none' }} onClick={() => set({ days: st.days.length === 7 ? [1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5, 6] })}>{st.days.length === 7 ? 'Mon-Sat' : 'Every day'}</button>
            </div>
          </div>
          <div className="sys-field"><span>Times (Eastern)</span>
            <div className="sys-seg" role="tablist" aria-label="Time mode">
              <button type="button" role="tab" aria-selected={st.times === 'best'} onClick={() => set({ times: 'best' })}><Clock size={15} /> Best times automatically</button>
              <button type="button" role="tab" aria-selected={Array.isArray(st.times)} onClick={() => set({ times: resizeTimes(Array.isArray(st.times) ? st.times : [], st.posts_per_day) })}>Set times</button>
            </div>
            {st.times === 'best' && <small className="sys-muted">Spread over the hours your followers are most active, at least a couple of hours apart, around anything already booked.</small>}
            {Array.isArray(st.times) && (
              <div className="sys-row" style={{ alignItems: 'center' }}>
                {st.times.map((t, i) => (
                  <label key={i} className="sys-field" style={{ flex: '0 0 auto' }}><span>Post {i + 1}</span>
                    <input type="time" step={300} value={t} onChange={(e) => setTimes(i, e.target.value)} onBlur={() => { if (st.times.every(isTime) && new Set(st.times).size === st.times.length) set({ times: sortTimes(st.times) }); }} />
                  </label>
                ))}
                {!st.times.length && <small className="sys-muted">Choose how many posts a day first.</small>}
              </div>
            )}
          </div>
          <div className="sys-field"><span>Post to</span>
            <div className="sys-chips">
              {STREAMS[k].platforms.map((p) => (
                <label key={p} className={`sys-chip ${st.platforms[p] ? 'is-on' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textTransform: 'none' }}>
                  <input type="checkbox" checked={!!st.platforms[p]} onChange={(e) => set({ platforms: { ...st.platforms, [p]: e.target.checked } })} /> {PLATFORM_LABEL[p]}
                </label>
              ))}
            </div>
            {k === 'market' && st.platforms.tiktok && <small className="sys-muted">TikTok gets the same card as a photo post. It needs the Market TikTok connected in Systems &gt; Social accounts; if it is not, the post goes out without it and the review page says so.</small>}
            {k === 'collective' && <small className="sys-muted">The Collective Instagram (@the.p31collective): quotes, prayers, scripture and mentorship or membership invitations, with Collective hashtags and links. Never curator invitations.</small>}
          </div>
        </>
      )}
      <p className="sys-muted" style={{ margin: 0 }}><b>{preview}</b></p>
      {problems.map((p) => <p key={p} className="sys-error" role="alert">{p}</p>)}
    </section>
  );
};

const PostingSchedule = () => {
  const [row, setRow] = useState(null);
  const [form, setForm] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | no-autopilot | no-schedule
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('autopilot_settings').select('*').eq('id', 1).maybeSingle();
    if (err) { if (missing(err)) setState('no-autopilot'); else { setError(err.message); setState('ready'); } return; }
    if (!data) { setState('no-autopilot'); return; }
    const saved = normalizeSchedule(data.schedule);
    setRow(data);
    setForm({
      schedule: saved || defaultSchedule(data),
      enabled: !!data.enabled, days_per_batch: data.days_per_batch, lead_days: data.lead_days,
      mix: data.mix || {}, approversText: (data.approvers || []).join(', '),
    });
    setState('schedule' in data ? 'ready' : 'no-schedule');
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  if (state === 'loading') return <div className="sys-page"><p className="sys-loading">Loading…</p></div>;
  if (state === 'no-autopilot') {
    return (
      <div className="sys-page">
        <header className="sys-page__head"><p className="sys-eyebrow">Posting schedule</p><h1>How often posts go out</h1></header>
        <p className="sys-alert"><AlertCircle size={15} /> Run <code>storefront_v46_autopilot.sql</code> and <code>storefront_v65_posting_schedule.sql</code> first (Systems &gt; Health has the commands).</p>
      </div>
    );
  }
  if (!form) return <div className="sys-page">{error && <p className="sys-error" role="alert">{error}</p>}</div>;

  const saved = normalizeSchedule(row?.schedule);
  const setStream = (k, st) => setForm((f) => ({ ...f, schedule: { ...f.schedule, [k]: st } }));
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const problems = STREAM_KEYS.flatMap((k) => streamProblems(k, form.schedule[k]));
  const approvers = form.approversText.split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => EMAIL.test(x));
  const total = MIX.reduce((a, [k]) => a + Number(form.mix?.[k] || 0), 0) || 1;
  const perWeek = STREAM_KEYS.reduce((a, k) => a + (streamActive(k, form.schedule[k]) ? form.schedule[k].posts_per_day * form.schedule[k].days.length : 0), 0);

  const write = async (patch, done) => {
    setBusy('save'); setError(''); setMsg('');
    const { data: who } = await supabase.auth.getUser();
    const { error: err, count } = await supabase.from('autopilot_settings').update({ ...patch, updated_at: new Date().toISOString(), updated_by: who?.user?.id || null }, { count: 'exact' }).eq('id', 1);
    setBusy('');
    if (err) { setError(/schedule|check constraint/i.test(err.message) && state === 'no-schedule' ? 'Run storefront_v65_posting_schedule.sql first (Systems > Health has the command).' : `Not saved: ${err.message}`); return; }
    if (!count) { setError('Not saved: this login cannot change the autopilot (it needs the Content Studio dashboard, or an admin).'); return; }
    setMsg(done); load();
  };
  const save = (e) => {
    e?.preventDefault();
    if (problems.length) { setError('Fix the notes in red first.'); return; }
    if (!approvers.length) { setError('Add at least one approver email.'); return; }
    const schedule = Object.fromEntries(STREAM_KEYS.map((k) => {
      const st = form.schedule[k];
      return [k, { ...st, times: Array.isArray(st.times) ? sortTimes(st.times) : 'best' }];
    }));
    const m = schedule.market;
    write({
      schedule, enabled: form.enabled, days_per_batch: Number(form.days_per_batch), lead_days: Number(form.lead_days), mix: form.mix, approvers,
      // The single number older screens read: the Marketplace posts a day (kept when the Marketplace is off).
      ...(m.enabled && m.posts_per_day > 0 ? { posts_per_day: Math.min(MAX_PER_DAY, m.posts_per_day) } : {}),
    }, 'Saved. The next morning run plans with it.');
  };
  const original = () => write({ schedule: null }, 'Back to the original autopilot: the Marketplace only, at the best times, on Instagram and Facebook.');
  const draftNow = async () => {
    setBusy('draft'); setError(''); setMsg('');
    const { data, error: err } = await supabase.functions.invoke('content-autopilot', { body: { action: 'draft' } });
    let m = err?.message || data?.error;
    if (err) { try { m = (await err.context.json()).error || m; } catch { /* keep */ } }
    setBusy('');
    if (m) { setError(m); return; }
    setMsg(data.batch && data.posts ? `${data.posts} posts drafted. The approvers have the email.${data.notes?.length ? ` ${data.notes.join(' ')}` : ''}` : data.skipped || 'Nothing to draft.');
  };

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Posting schedule</p>
        <h1>How often posts go out</h1>
        <p className="sys-muted">For each brand: how many posts a day, which days, what times and where. Every morning the autopilot drafts what the calendar is missing in Melanie JC’s quote-card look and emails the approvers. Nothing posts until someone approves.</p>
      </header>

      {state === 'no-schedule' && <p className="sys-alert"><AlertCircle size={15} /> Run <code>storefront_v65_posting_schedule.sql</code> to save a schedule (Systems &gt; Health has the command). Until then the autopilot keeps its original settings.</p>}
      {error && <p className="sys-error" role="alert">{error}</p>}
      {msg && <p className="sys-ok"><Check size={16} /> {msg}</p>}

      <section className="sys-card">
        <h2><CalendarClock size={18} /> Right now</h2>
        <ul className="sys-list">{describeSchedule(row).map((l) => <li key={l}><span>{l}</span></li>)}</ul>
        {!saved && <small className="sys-muted">No schedule saved yet: the boxes below start from what the autopilot does today. Save to use them.</small>}
      </section>

      <form className="sys-form" onSubmit={save}>
        {STREAM_KEYS.map((k) => <StreamEditor key={k} k={k} st={form.schedule[k]} onChange={(st) => setStream(k, st)} />)}

        <section className="sys-card">
          <h2><Layers size={18} /> Drafting and approval (both brands)</h2>
          <label className="sys-chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textTransform: 'none', justifySelf: 'start' }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => setF('enabled', e.target.checked)} /> Autopilot on (off: it never drafts on its own)
          </label>
          <div className="sys-row">
            <label className="sys-field"><span>Days per batch</span>
              <select value={form.days_per_batch} onChange={(e) => setF('days_per_batch', e.target.value)}>{[...new Set([7, 10, 14, 21, 28, Number(form.days_per_batch)])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </label>
            <label className="sys-field"><span>Start drafting when it is this close</span>
              <select value={form.lead_days} onChange={(e) => setF('lead_days', e.target.value)}>{[...new Set([3, 5, 7, 10, 14, Number(form.lead_days)])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n} days out</option>)}</select>
            </label>
          </div>
          <div className="sys-field"><span>The mix</span>
            {MIX.map(([k, l]) => (
              <label key={k} className="sys-row" style={{ alignItems: 'center', fontWeight: 600 }}>
                <span style={{ flex: '1 1 180px' }}>{l}</span>
                <input type="range" min={0} max={60} step={5} value={form.mix?.[k] || 0} onChange={(e) => setF('mix', { ...form.mix, [k]: Number(e.target.value) })} style={{ flex: '1 1 160px', minHeight: 0 }} aria-label={l} />
                <output style={{ width: 44, textAlign: 'right' }}>{Math.round(((form.mix?.[k] || 0) / total) * 100)}%</output>
              </label>
            ))}
          </div>
          <label className="sys-field"><span>Who approves (emails)</span>
            <input value={form.approversText} onChange={(e) => setF('approversText', e.target.value)} placeholder="ceo@p31market.com" />
          </label>
        </section>

        <section className="sys-card">
          <p style={{ margin: 0 }}><b>About {perWeek} {perWeek === 1 ? 'post' : 'posts'} a week</b> across both brands, each one approved before it goes out.</p>
          <div className="sys-row ps-actions">
            <button className="sys-btn sys-btn--gold" disabled={busy === 'save' || state === 'no-schedule' || problems.length > 0}>{busy === 'save' ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Save the schedule</button>
            <button type="button" className="sys-btn sys-btn--ghost" onClick={draftNow} disabled={busy === 'draft'}>{busy === 'draft' ? <Loader2 size={16} className="spin" /> : <Send size={16} />} Draft a batch now</button>
            {saved && <button type="button" className="sys-btn sys-btn--ghost" onClick={original} disabled={busy === 'save'}><RotateCcw size={16} /> Go back to the original autopilot</button>}
          </div>
          <small className="sys-muted">Draft a batch now saves nothing here: it drafts with the saved schedule, even when the calendar is not low yet.</small>
        </section>
      </form>
    </div>
  );
};

export default PostingSchedule;
