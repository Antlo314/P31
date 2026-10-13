import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mail, Send, Sparkles, EyeOff, Inbox, RefreshCw, AlertTriangle, Paperclip, Undo2, Check, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DashHead } from '../apps/DashShell';

const STATUS = [['needs_reply', 'Needs a reply'], ['sent', 'Answered'], ['ignored', 'Ignored'], ['', 'All']];
const BOXES = [['', 'Both inboxes'], ['collective', 'members@ (Collective)'], ['market', 'vendor@ (Market)']];
const BOX_LABEL = { collective: 'members@thep31collective.org', market: 'vendor@p31market.com' };
const CATEGORY = {
  applicant: 'Applicant', member: 'Member', vendor: 'Vendor', customer: 'Customer', partnership: 'Partnership',
  press: 'Press', general: 'General', spam: 'Spam', automated: 'Automated',
};
const fmt = (iso) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// Content Studio → Email: everything sent to members@ and vendor@, with Carla's draft reply.
// A person reads, edits if needed, and sends. Nothing goes out on its own.
const StudioEmail = () => {
  const [status, setStatus] = useState('needs_reply');
  const [box, setBox] = useState('');
  const [threads, setThreads] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const viewRef = useRef(null);

  const load = useCallback(async () => {
    let q = supabase.from('email_threads').select('*').order('last_message_at', { ascending: false }).limit(200);
    if (status) q = q.eq('status', status);
    if (box) q = q.eq('mailbox', box);
    const { data, error: err } = await q;
    if (err) { setError(/does not exist|schema cache/.test(err.message) ? 'Run storefront_v32_email_inbox.sql in Supabase to turn on Email.' : err.message); return; }
    setError(''); setThreads(data || []);
  }, [status, box]);
  useEffect(() => { Promise.resolve().then(load); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const pick = (t) => {
    setOpen(t);
    if (window.matchMedia('(max-width: 979px)').matches) requestAnimationFrame(() => viewRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  };

  return (
    <>
      <DashHead eyebrow="Content Studio" title="Email" lead="Everything sent to members@ and vendor@, with a reply Carla drafted. Read it, edit if you like, and send. Nothing goes out without you."
        actions={<button className="k-btn k-btn--ghost k-btn--sm" onClick={load}><RefreshCw size={15} /> Refresh</button>} />
      <div className="ds-tabs-inline" role="tablist" aria-label="Status">
        {STATUS.map(([v, l]) => <button key={l} role="tab" aria-selected={status === v} onClick={() => { setStatus(v); setOpen(null); }}>{l}</button>)}
      </div>
      <div className="ds-tabs-inline em-boxes" role="tablist" aria-label="Inbox">
        {BOXES.map(([v, l]) => <button key={l} role="tab" aria-selected={box === v} onClick={() => { setBox(v); setOpen(null); }}>{l}</button>)}
      </div>
      {error && <p className="k-error">{error}</p>}
      <div className="ds-grid ds-grid--2 em-grid" style={{ alignItems: 'start' }}>
        <ul className="ds-list">
          {(threads || []).map((t) => (
            <li key={t.id}>
              <button className={`ds-row ${open?.id === t.id ? 'is-open' : ''}`} onClick={() => pick(t)}>
                <Mail size={18} />
                <div>
                  <strong>{t.contact_name || t.contact_email}</strong>
                  <small>{t.subject}</small>
                  <small>{t.summary || (t.status === 'needs_reply' && !t.draft ? 'Carla is reading it…' : '')}</small>
                </div>
                <span className="em-meta">
                  {t.needs_human && <AlertTriangle size={14} className="em-flag" aria-label="Needs a person" />}
                  {t.category && <span className="ds-pill">{CATEGORY[t.category] || t.category}</span>}
                  <small>{fmt(t.last_message_at)}</small>
                </span>
              </button>
            </li>
          ))}
          {threads && !threads.length && <li className="ds-muted"><Inbox size={16} /> {status === 'needs_reply' ? 'All caught up. No emails waiting for a reply.' : 'Nothing here.'}</li>}
          {!threads && !error && <li className="ds-muted">Loading…</li>}
        </ul>
        <div ref={viewRef}>
          {open ? <Thread key={open.id} thread={open} onChanged={load} onDeleted={() => { setOpen(null); load(); }} /> : (
            <div className="ds-card"><p className="ds-muted"><Mail size={16} /> Pick an email to read it and Carla’s draft.</p></div>
          )}
        </div>
      </div>
    </>
  );
};

const Thread = ({ thread: initial, onChanged, onDeleted }) => {
  const [t, setT] = useState(initial);
  const [msgs, setMsgs] = useState(null);
  const [draft, setDraft] = useState(initial.draft || '');
  const [ask, setAsk] = useState('');
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    const [{ data: th }, { data: ms }] = await Promise.all([
      supabase.from('email_threads').select('*').eq('id', initial.id).single(),
      supabase.from('email_messages').select('*').eq('thread_id', initial.id).order('created_at'),
    ]);
    if (th) { setT(th); setDraft((d) => d || th.draft || ''); }
    setMsgs(ms || []);
  }, [initial.id]);
  useEffect(() => { Promise.resolve().then(reload); }, [reload]);

  // Carla's first draft can take a few seconds after a new email arrives.
  useEffect(() => {
    if (t.draft || t.status !== 'needs_reply') return undefined;
    const id = setInterval(reload, 4000);
    return () => clearInterval(id);
  }, [t.draft, t.status, reload]);

  const call = async (payload) => {
    const { data, error: err } = await supabase.functions.invoke('email-send', { body: { thread_id: t.id, ...payload } });
    if (err) {
      let msg = err.message;
      try { msg = (await err.context.json()).error || msg; } catch { /* keep message */ }
      throw new Error(msg);
    }
    return data;
  };

  const send = async () => {
    setBusy('send'); setError('');
    try {
      await call({ action: 'send', body: draft });
      setConfirm(false); setNote(`Sent to ${t.contact_email}.`); setDraft('');
      await reload(); onChanged();
    } catch (e) { setError(e.message); }
    setBusy('');
  };
  const rewrite = async () => {
    setBusy('redraft'); setError('');
    try {
      const out = await call({ action: 'redraft', instruction: ask });
      setDraft(out.draft?.reply || ''); setAsk(''); setNote('Carla wrote a new draft.');
      await reload();
    } catch (e) { setError(e.message); }
    setBusy('');
  };
  const setStatus = async (status) => {
    await supabase.from('email_threads').update({ status }).eq('id', t.id);
    setNote(status === 'ignored' ? 'Moved to Ignored.' : 'Moved back to Needs a reply.');
    await reload(); onChanged();
  };

  return (
    <div className="ds-card em-thread">
      <div className="ds-card__head">
        <h3>{t.subject}</h3>
        <span className="ds-pill">{BOX_LABEL[t.mailbox]}</span>
      </div>
      <p className="ds-muted em-who">{t.contact_name ? `${t.contact_name} · ` : ''}{t.contact_email}</p>
      {t.summary && <p className="em-summary"><Sparkles size={14} /> {t.summary}</p>}
      {t.needs_human && <p className="em-human"><AlertTriangle size={15} /> Needs a person: {(t.human_reason || 'Carla flagged this one').replace(/\.$/, '')}. Her draft is a holding reply; add the real answer before sending.</p>}

      <div className="ds-thread em-msgs">
        {(msgs || []).map((m) => (
          <div key={m.id} className={`ds-msg ${m.direction === 'out' ? 'is-mine' : ''}`}>
            <div className="em-body">{m.body_text || '(no text)'}</div>
            {(m.attachments || []).length > 0 && <small><Paperclip size={12} /> {(m.attachments || []).map((a) => a.filename).join(', ')} (open in the inbox)</small>}
            <small>{m.direction === 'out' ? `Sent from ${BOX_LABEL[t.mailbox]}` : m.from_name || m.from_email} · {fmt(m.created_at)}</small>
          </div>
        ))}
        {!msgs && <p className="ds-muted">Loading…</p>}
      </div>

      {t.status !== 'ignored' ? (
        <div className="em-draft">
          <label className="k-field" htmlFor={`draft-${t.id}`}><span>{t.draft || draft ? 'Reply (Carla’s draft, edit freely)' : t.status === 'needs_reply' ? 'Carla is writing a draft…' : 'Reply'}</span></label>
          <textarea id={`draft-${t.id}`} className="k-input em-text" rows={10} value={draft} onChange={(e) => { setDraft(e.target.value); setConfirm(false); }} placeholder="Write a reply…" />
          <div className="em-ask">
            <input id={`ask-${t.id}`} className="k-input" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask Carla to change it, e.g. shorter, mention the Winter Gala" aria-label="What should Carla change?" />
            <button className="k-btn k-btn--ghost k-btn--sm" onClick={rewrite} disabled={!!busy}><Sparkles size={15} /> {busy === 'redraft' ? 'Writing…' : ask ? 'Rewrite' : 'New draft'}</button>
          </div>
          {confirm ? (
            <div className="em-confirm" role="group" aria-label="Confirm sending">
              <span>Send this reply to <b>{t.contact_email}</b> from {BOX_LABEL[t.mailbox]}?</span>
              <button className="k-btn k-btn--gold k-btn--sm" onClick={send} disabled={!!busy}><Check size={15} /> {busy === 'send' ? 'Sending…' : 'Yes, send it'}</button>
              <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => setConfirm(false)} disabled={!!busy}>Cancel</button>
            </div>
          ) : (
            <div className="k-actions">
              <button className="k-btn k-btn--gold" onClick={() => setConfirm(true)} disabled={draft.trim().length < 2 || !!busy}><Send size={16} /> Send reply</button>
              <button className="k-btn k-btn--ghost" onClick={() => setStatus('ignored')} disabled={!!busy}><EyeOff size={16} /> No reply needed</button>
            </div>
          )}
        </div>
      ) : (
        <div className="k-actions"><button className="k-btn k-btn--ghost" onClick={() => setStatus('needs_reply')}><Undo2 size={16} /> Move back to Needs a reply</button></div>
      )}
      {note && <p className="em-note" role="status">{note}</p>}
      {error && <p className="k-error" role="alert">{error}</p>}
      <div className="k-actions em-delete">
        <button className="k-btn k-btn--ghost k-btn--sm" disabled={!!busy} onClick={async () => {
          if (!window.confirm('Delete this conversation from the inbox? The emails stay in the mailbox itself; this only removes it here. This cannot be undone.')) return;
          const { error: err, count } = await supabase.from('email_threads').delete({ count: 'exact' }).eq('id', t.id);
          if (err || count === 0) return setError(err?.message || 'It was not deleted. This login may not have the Emails dashboard.');
          onDeleted?.();
        }}><Trash2 size={15} /> Delete conversation</button>
      </div>
    </div>
  );
};

export default StudioEmail;
