import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plane, Loader2, Check, Send, ExternalLink, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const missing = (e) => /does not exist|schema cache|relation/i.test(e?.message || '');
const MIX = [['quote', 'Bold quotes'], ['prayer', 'Prayers'], ['scripture', 'Scripture (KJV)'], ['blank', 'Fill in the blank'], ['curator', 'Curator invitations'], ['mentorship', 'Mentorship invitations']];
const STATUS = { awaiting: 'Waiting for approval', scheduled: 'Approved and scheduled', declined: 'Set aside', expired: 'Expired' };
const day = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '');

/**
 * Content Studio → Auto-create → Autopilot: keeps the calendar full with a person approving every
 * batch. Settings (how many a day, how far ahead, the mix, who approves) and the latest batches.
 */
const AutopilotPanel = () => {
  const [s, setS] = useState(null);
  const [batches, setBatches] = useState([]);
  const [off, setOff] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('autopilot_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('autopilot_batches').select('id, status, first_day, last_day, created_at, decided_by, scheduled_count, expires_at').order('created_at', { ascending: false }).limit(5),
    ]);
    if (a.error) { if (missing(a.error)) setOff(true); else setError(a.error.message); return; }
    setS(a.data ? { ...a.data, approversText: (a.data.approvers || []).join(', ') } : null); setBatches(b.data || []);
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const save = async (e) => {
    e?.preventDefault();
    setBusy('save'); setError(''); setMsg('');
    const approvers = s.approversText.split(/[,\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
    if (!approvers.length) { setBusy(''); setError('Add at least one approver email.'); return; }
    const { data: who } = await supabase.auth.getUser();
    const { error: err, count } = await supabase.from('autopilot_settings').update({
      enabled: s.enabled, posts_per_day: Number(s.posts_per_day), days_per_batch: Number(s.days_per_batch), lead_days: Number(s.lead_days),
      mix: s.mix, approvers, updated_at: new Date().toISOString(), updated_by: who?.user?.id || null,
    }, { count: 'exact' }).eq('id', 1);
    setBusy('');
    if (err || !count) { setError(err?.message || 'Not saved: this login may not have the Content creator dashboard.'); return; }
    setMsg('Saved.'); load();
  };
  const draftNow = async () => {
    setBusy('draft'); setError(''); setMsg('');
    const { data, error: err } = await supabase.functions.invoke('content-autopilot', { body: { action: 'draft' } });
    let m = err?.message || data?.error;
    if (err) { try { m = (await err.context.json()).error || m; } catch { /* keep */ } }
    setBusy('');
    if (m) { setError(/not found|Failed to send/i.test(m) ? 'Deploy the content-autopilot function first (see the build notes).' : m); return; }
    setMsg(data.batch && data.posts ? `${data.posts} posts drafted for ${day(data.first)} to ${day(data.last)}${data.writer === 'library' ? ' (from the library; the writing helper was unavailable)' : ''}. The approvers have the email; review them below.` : data.skipped || 'Nothing to draft.');
    load();
  };

  if (off) {
    return (
      <section className="ds-card fc-card">
        <h2><Plane size={18} /> Autopilot</h2>
        <p className="fc-note"><AlertCircle size={14} /> Run <code>storefront_v46_autopilot.sql</code> and deploy the <code>content-autopilot</code> function to switch on the autopilot.</p>
      </section>
    );
  }
  if (!s) return <p className="ds-muted">Loading…</p>;
  const total = MIX.reduce((a, [k]) => a + Number(s.mix?.[k] || 0), 0) || 1;
  return (
    <div className="fc-grid ap-panel">
      <section className="ds-card fc-card">
        <h2><Plane size={18} /> Autopilot</h2>
        <p className="ds-muted">Every morning it looks at the calendar. When the next stretch has fewer than {s.posts_per_day} posts a day and starts within {s.lead_days} days, it drafts the next {s.days_per_batch} days in Melanie JC’s quote-card look, with captions and good times, and emails the approvers a review link. Nothing posts until someone approves.</p>
        <form className="ds-form" onSubmit={save}>
          <label className="fc-check"><input type="checkbox" checked={!!s.enabled} onChange={(e) => set('enabled', e.target.checked)} /> <span><b>Autopilot on</b><small>Off: it never drafts on its own (Draft a batch now still works).</small></span></label>
          <div className="fc-row3">
            <label className="k-field"><span>Posts a day</span><select value={s.posts_per_day} onChange={(e) => set('posts_per_day', e.target.value)}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <label className="k-field"><span>Days per batch</span><select value={s.days_per_batch} onChange={(e) => set('days_per_batch', e.target.value)}>{[7, 10, 14, 21, 28].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <label className="k-field"><span>Start drafting when it’s this close</span><select value={s.lead_days} onChange={(e) => set('lead_days', e.target.value)}>{[3, 5, 7, 10, 14].map((n) => <option key={n} value={n}>{n} days out</option>)}</select></label>
          </div>
          <div className="k-field"><span>The mix</span>
            <div className="ap-mix">
              {MIX.map(([k, l]) => (
                <label key={k}><span>{l}</span>
                  <input type="range" min={0} max={60} step={5} value={s.mix?.[k] || 0} onChange={(e) => set('mix', { ...s.mix, [k]: Number(e.target.value) })} />
                  <output>{Math.round(((s.mix?.[k] || 0) / total) * 100)}%</output>
                </label>
              ))}
            </div>
          </div>
          <label className="k-field"><span>Who approves (emails)</span><input className="k-input" value={s.approversText} onChange={(e) => set('approversText', e.target.value)} placeholder="ceo@p31market.com" /></label>
          <div className="fc-actions">
            <button className="k-btn k-btn--gold k-btn--sm" disabled={busy === 'save'}>{busy === 'save' ? <Loader2 size={14} className="fc-spin" /> : <Check size={14} />} Save</button>
            <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={draftNow} disabled={busy === 'draft'}>{busy === 'draft' ? <Loader2 size={14} className="fc-spin" /> : <Send size={14} />} Draft a batch now</button>
          </div>
          {error && <p className="k-error" role="alert">{error}</p>}
          {msg && <p className="fc-done"><Check size={14} /> {msg}</p>}
        </form>
      </section>
      <section className="ds-card fc-card">
        <h2>Latest batches</h2>
        {!batches.length && <p className="ds-muted">None yet. The first one is drafted when the calendar runs low, or press Draft a batch now.</p>}
        <ul className="ds-list">
          {batches.map((b) => (
            <li key={b.id} className="ds-row">
              <div>
                <strong>{day(b.first_day)} to {day(b.last_day)}</strong>
                <small>{STATUS[b.status] || b.status}{b.status === 'scheduled' ? ` · ${b.scheduled_count} posts${b.decided_by ? ` · by ${b.decided_by}` : ''}` : ''}{b.status === 'awaiting' ? ` · link works until ${new Date(b.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</small>
              </div>
              <Link className="k-btn k-btn--ghost k-btn--sm" to={`/approve/${b.id}`}>{b.status === 'awaiting' ? 'Review' : 'Open'} <ExternalLink size={13} /></Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default AutopilotPanel;
