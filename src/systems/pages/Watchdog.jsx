import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCw, Loader2, BellOff, CheckCircle2, ExternalLink, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmtDateTime } from '../../lib/academy';

const missing = (e) => /does not exist|schema cache|relation/i.test(e?.message || '');
const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString();
const AREA = { social: 'Instagram & Facebook', posts: 'Posts', forms: 'Forms', site: 'Site' };
const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

/**
 * Systems → Health → Watchdog: what the hourly check found, what it fixed on its own, and what
 * still needs a person. Each alert says how to fix it; snooze one to stop the emails about it.
 */
const Watchdog = () => {
  const [alerts, setAlerts] = useState(null);
  const [closed, setClosed] = useState([]);
  const [last, setLast] = useState(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [off, setOff] = useState(false);

  const load = useCallback(async () => {
    const week = new Date(Date.now() - 7 * 864e5).toISOString();
    const [a, c, r] = await Promise.all([
      supabase.from('ops_alerts').select('*').is('resolved_at', null).order('severity').order('first_seen'),
      supabase.from('ops_alerts').select('id, title, area, resolved_at, resolved_by').not('resolved_at', 'is', null).gte('resolved_at', week).order('resolved_at', { ascending: false }).limit(8),
      supabase.from('ops_runs').select('*').order('ran_at', { ascending: false }).limit(1),
    ]);
    if (a.error) { if (missing(a.error)) setOff(true); else setError(a.error.message); setAlerts([]); return; }
    setAlerts(a.data || []); setClosed(c.data || []); setLast(r.data?.[0] || null);
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const runNow = async () => {
    setBusy('run'); setError(''); setNote('');
    const { data, error: err } = await supabase.functions.invoke('watchdog', { body: { action: 'run' } });
    let msg = err?.message || data?.error;
    if (err) { try { msg = (await err.context.json()).error || msg; } catch { /* keep */ } }
    if (msg) setError(/not found|Failed to send/i.test(msg) ? 'Deploy the watchdog function first (see the build notes).' : msg);
    else setNote(data.open ? `Checked. ${data.open} open${data.healed?.length ? `; fixed on its own: ${data.healed.join('; ')}` : ''}.` : `Checked. Everything is running${data.healed?.length ? ` (fixed on its own: ${data.healed.join('; ')})` : ''}.`);
    setBusy(''); load();
  };
  const update = async (a, patch, done) => {
    setBusy(a.id); setError('');
    const { error: err, count } = await supabase.from('ops_alerts').update(patch, { count: 'exact' }).eq('id', a.id);
    if (err || !count) setError(err?.message || 'Not saved: only admins can change alerts.');
    else setNote(done);
    setBusy(''); load();
  };
  const snooze = (a, days) => update(a, { snoozed_until: inDays(days) }, `Snoozed for ${days === 1 ? 'a day' : 'a week'}: no emails about it until then.`);
  const fixed = async (a) => {
    const { data: who } = await supabase.auth.getUser();
    update(a, { resolved_at: new Date().toISOString(), resolved_by: who?.user?.email || 'admin' }, 'Marked fixed. If the check still fails, it opens again within the hour.');
  };

  if (off) {
    return (
      <section className="sys-card wd">
        <h2 className="sys-subhead" style={{ marginTop: 0 }}><ShieldCheck size={18} /> Watchdog</h2>
        <p className="sys-muted">The hourly system check switches on with the v45 database update and the watchdog function (both listed above and in the build notes).</p>
      </section>
    );
  }
  const awake = (alerts || []).filter((a) => !a.snoozed_until || new Date(a.snoozed_until) < new Date());
  const healed = last?.healed || [];
  return (
    <section className={`sys-card wd ${awake.length ? 'wd--alert' : 'wd--ok'}`} data-tour="watchdog">
      <div className="wd-head">
        <span className="wd-badge">{awake.length ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}</span>
        <div>
          <h2>{alerts === null ? 'Checking…' : awake.length ? `${awake.length} ${awake.length === 1 ? 'thing needs' : 'things need'} attention` : 'Everything is running'}</h2>
          <p className="sys-muted">{last ? `Last checked ${ago(last.ran_at)} (${fmtDateTime(last.ran_at)})${last.emailed ? `, ${last.emailed === 'summary' ? 'morning summary' : 'alert'} emailed` : ''}.` : 'The watchdog has not run yet.'} It checks Instagram and Facebook, posts, forms, emails, scheduled jobs and site errors every hour.</p>
        </div>
        <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={runNow} disabled={busy === 'run'}>{busy === 'run' ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Run checks now</button>
      </div>
      {healed.length > 0 && <p className="wd-healed"><Wrench size={14} /> Fixed on its own last run: {healed.join('; ')}.</p>}
      {error && <p className="sys-error" role="alert">{error}</p>}
      {note && <p className="sys-ok" role="status">{note}</p>}
      {(alerts || []).length > 0 && (
        <ul className="wd-list">
          {alerts.map((a) => {
            const snoozed = a.snoozed_until && new Date(a.snoozed_until) > new Date();
            return (
              <li key={a.id} className={`wd-item wd-item--${a.severity} ${snoozed ? 'is-snoozed' : ''}`}>
                <div className="wd-item__main">
                  <small>{a.severity === 'fail' ? 'Needs attention' : 'Heads up'} · {AREA[a.area] || a.area} · since {ago(a.first_seen)}{snoozed ? ` · snoozed until ${fmtDateTime(a.snoozed_until)}` : ''}</small>
                  <strong>{a.title}</strong>
                  {a.detail && <p>{a.detail}</p>}
                  {a.fix && <p className="wd-fix"><b>Fix:</b> {a.fix}</p>}
                </div>
                <div className="wd-item__tools">
                  {a.link && <a className="sys-btn sys-btn--ghost sys-btn--sm" href={a.link} target={a.link.startsWith('http') ? '_blank' : undefined} rel="noreferrer"><ExternalLink size={14} /> Open</a>}
                  <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => snooze(a, 1)} disabled={busy === a.id}><BellOff size={14} /> Snooze a day</button>
                  <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => snooze(a, 7)} disabled={busy === a.id}>A week</button>
                  <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => fixed(a)} disabled={busy === a.id}><CheckCircle2 size={14} /> Mark fixed</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {closed.length > 0 && (
        <details className="wd-closed">
          <summary>Resolved this week ({closed.length})</summary>
          <ul>{closed.map((c) => <li key={c.id}><CheckCircle2 size={13} /> {c.title} <small>· {c.resolved_by === 'watchdog' ? 'cleared on its own' : `by ${c.resolved_by}`} · {ago(c.resolved_at)}</small></li>)}</ul>
        </details>
      )}
    </section>
  );
};

export default Watchdog;
