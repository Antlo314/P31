import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { Check, X, Loader2, RotateCcw, Pencil, CalendarCheck, AlertTriangle, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Thumb from '../design/Thumb';
import { fromWords } from '../design/templates';
import { renderStill } from '../design/export';
import logo from '../../assets/academy/collective-mark.webp';
import './approve.css';

const TZ = 'America/New_York';
const when = (iso) => new Date(iso).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const dayName = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '');
const KIND = { quote: 'Quote', prayer: 'Prayer', scripture: 'Scripture', blank: 'Fill in the blank', curator: 'Curator invitation', mentorship: 'Mentorship invitation' };

async function call(body) {
  const { data, error } = await supabase.functions.invoke('content-autopilot', { body });
  if (error) {
    let msg = 'The autopilot could not be reached. Try again in a minute.';
    try { const ctx = await error.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* keep */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

/**
 * /approve/:batchId?t=… — the autopilot's review page (from the email, or the Studio). Each drafted
 * post with its card, time and caption; remove any or change a caption; Approve draws every card
 * in this browser, uploads it and schedules it. Nothing posts until then.
 */
const Approve = () => {
  const { batchId } = useParams();
  const [params] = useSearchParams();
  const token = params.get('t') || undefined;
  const [batch, setBatch] = useState(null);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [progress, setProgress] = useState(null); // { done, total, failed }
  const [finished, setFinished] = useState(null);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState('');

  const base = useMemo(() => ({ batch: batchId, token }), [batchId, token]);
  const load = useCallback(async () => {
    try { const out = await call({ ...base, action: 'get' }); setBatch(out.batch); setItems(out.items); setError(''); }
    catch (e) { setError(e.message); }
  }, [base]);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const docs = useMemo(() => Object.fromEntries(items.map((it) => [it.id, fromWords({ template: it.template, style: it.style, pattern: it.pattern, seed: it.seed, words: it.words })])), [items]);
  const live = items.filter((it) => it.status === 'pending' || it.status === 'failed');
  const set = (id, patch) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const toggle = async (it) => {
    const remove = it.status !== 'removed';
    set(it.id, { status: remove ? 'removed' : 'pending' });
    try { await call({ ...base, action: 'update', item: it.id, remove }); } catch (e) { setError(e.message); load(); }
  };
  const saveCaption = async (it, caption) => {
    setEditing(null);
    set(it.id, { caption_ig: caption });
    try { await call({ ...base, action: 'update', item: it.id, caption_ig: caption, caption_fb: caption.replace(/link in bio/gi, it.kind === 'mentorship' ? 'https://www.thep31collective.org/join' : it.kind === 'curator' ? 'https://www.p31market.com/storefront' : 'link in bio') }); }
    catch (e) { setError(e.message); load(); }
  };

  // Approve: draw, upload and schedule each post in turn (one failure never stops the rest).
  const approve = async () => {
    setError('');
    const todo = live;
    setProgress({ done: 0, total: todo.length, failed: 0 });
    let failed = 0;
    for (const [i, it] of todo.entries()) {
      try {
        const blob = await renderStill(docs[it.id], { type: 'image/jpeg', quality: 0.92 });
        const { uploadUrl } = await call({ ...base, action: 'presign', item: it.id, size: blob.size });
        const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
        if (!put.ok) throw new Error('The card did not upload.');
        const { item } = await call({ ...base, action: 'schedule', item: it.id });
        set(it.id, item);
        if (item.status !== 'scheduled') failed += 1;
      } catch (e) { failed += 1; set(it.id, { status: 'failed', error: e.message }); }
      setProgress({ done: i + 1, total: todo.length, failed });
    }
    try { const out = await call({ ...base, action: 'finish' }); setFinished(out.scheduled); } catch (e) { setError(e.message); }
    setProgress(null);
  };
  const decline = async () => {
    try { await call({ ...base, action: 'decline', note }); setDeclining(false); load(); } catch (e) { setError(e.message); }
  };

  const busy = !!progress;
  const scheduled = items.filter((it) => it.status === 'scheduled').length;
  return (
    <div className="ap">
      <header className="ap-top">
        <img src={logo} alt="" />
        <div><strong>Content autopilot</strong><small>P31 Marketplace · The P31 Collective</small></div>
      </header>

      {error && <p className="ap-error" role="alert"><AlertTriangle size={16} /> {error}</p>}
      {!batch && !error && <p className="ap-muted ap-center"><Loader2 size={18} className="ap-spin" /> Loading the posts…</p>}

      {batch && (
        <>
          <section className="ap-head">
            <p className="ap-eyebrow"><Sparkles size={14} /> Ready for your yes</p>
            <h1>{items.length} posts for {dayName(batch.first_day)} to {dayName(batch.last_day)}</h1>
            {batch.open
              ? <p className="ap-muted">Nothing posts until you approve. Remove any post or change its caption, then tap Approve: each card is drawn and scheduled for its time on Instagram and Facebook.</p>
              : <p className="ap-done">{batch.status === 'scheduled' ? <><CalendarCheck size={16} /> Approved{batch.decided_by ? ` by ${batch.decided_by}` : ''}: {batch.scheduled_count} posts scheduled.</> : batch.status === 'declined' ? 'Set aside. A new batch is drafted when the calendar needs it.' : 'This review link has expired. A new batch comes when the calendar needs it.'}</p>}
            {finished != null && <p className="ap-done"><CalendarCheck size={16} /> Done: {finished} posts scheduled. They are on the Studio calendar now.</p>}
          </section>

          <ul className="ap-list">
            {items.map((it) => (
              <li key={it.id} className={`ap-item is-${it.status}`}>
                <div className="ap-card">{docs[it.id] && <Thumb doc={docs[it.id]} width={320} label={it.line} />}</div>
                <div className="ap-body">
                  <p className="ap-meta"><b>{when(it.post_at)}</b> · {KIND[it.kind] || it.kind}
                    {it.status === 'scheduled' && <span className="ap-tag ap-tag--ok"><Check size={12} /> Scheduled</span>}
                    {it.status === 'removed' && <span className="ap-tag">Removed</span>}
                    {it.status === 'skipped' && <span className="ap-tag">Time passed</span>}
                    {it.status === 'failed' && <span className="ap-tag ap-tag--bad">Not scheduled</span>}
                  </p>
                  {editing === it.id
                    ? <CaptionEditor value={it.caption_ig} onSave={(v) => saveCaption(it, v)} onCancel={() => setEditing(null)} />
                    : <p className="ap-caption">{it.caption_ig}</p>}
                  {it.error && it.status === 'failed' && <p className="ap-error ap-error--sm">{it.error}</p>}
                  {batch.open && it.status !== 'scheduled' && !busy && (
                    <div className="ap-tools">
                      {it.status !== 'removed' && editing !== it.id && <button type="button" onClick={() => setEditing(it.id)}><Pencil size={14} /> Edit caption</button>}
                      <button type="button" onClick={() => toggle(it)}>{it.status === 'removed' ? <><RotateCcw size={14} /> Put it back</> : <><X size={14} /> Remove</>}</button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {batch.open && (
            <div className="ap-bar">
              {progress
                ? <p className="ap-progress"><Loader2 size={16} className="ap-spin" /> Scheduling {progress.done} of {progress.total}{progress.failed ? ` (${progress.failed} not scheduled)` : ''}…<span style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} /></p>
                : declining
                  ? (
                    <div className="ap-decline">
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional: what should change next time?" aria-label="Why not this batch" />
                      <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setDeclining(false)}>Back</button>
                      <button type="button" className="ap-btn" onClick={decline}>Set this batch aside</button>
                    </div>
                  )
                  : (
                    <>
                      <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setDeclining(true)}>Not this batch</button>
                      <button type="button" className="ap-btn ap-btn--gold" onClick={approve} disabled={!live.length}><Check size={18} /> Approve {live.length} {live.length === 1 ? 'post' : 'posts'}</button>
                    </>
                  )}
            </div>
          )}
          {!batch.open && scheduled > 0 && <p className="ap-muted ap-center"><Link to="/studio/calendar">Open the Studio calendar</Link></p>}
        </>
      )}
    </div>
  );
};

const CaptionEditor = ({ value, onSave, onCancel }) => {
  const [v, setV] = useState(value);
  return (
    <div className="ap-edit">
      <textarea value={v} onChange={(e) => setV(e.target.value)} rows={Math.min(12, Math.max(5, v.split('\n').length + 2))} aria-label="Caption" />
      <div className="ap-tools">
        <button type="button" onClick={onCancel}>Cancel</button>
        <button type="button" className="is-primary" onClick={() => onSave(v)}><Check size={14} /> Save caption</button>
      </div>
    </div>
  );
};

export default Approve;
