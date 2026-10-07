import React, { useEffect, useState } from 'react';
import { Mail, Send, Plus, Users, Check, FlaskConical, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import AiAssist from '../../components/AiAssist';

const AUDIENCES = [
  ['subscribers', 'Newsletter subscribers'],
  ['curators', 'Curators'],
  ['everyone', 'Everyone'],
];
const blank = { subject: '', body: '', audience: 'subscribers' };

const invoke = async (name, body) => {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = 'The email service isn’t reachable — deploy the send-campaign function.';
    try { const ctx = await error.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* default */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
};

const Campaigns = () => {
  const [list, setList] = useState([]);
  const [draft, setDraft] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [audienceSize, setAudienceSize] = useState({});
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = () => supabase.from('campaigns').select('*').order('created_at', { ascending: false })
    .then(({ data }) => setList(data || []));

  useEffect(() => {
    load();
    Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('unsubscribed', false),
      supabase.from('curator_data').select('id', { count: 'exact', head: true }),
    ]).then(([l, c]) => setAudienceSize({ subscribers: l.count ?? 0, curators: c.count ?? 0 }));
  }, []);

  const save = async () => {
    setError('');
    if (!draft.subject.trim() || !draft.body.trim()) { setError('Add a subject and a message.'); return null; }
    const row = { subject: draft.subject.trim(), body: draft.body, audience: draft.audience };
    const res = editingId
      ? await supabase.from('campaigns').update(row).eq('id', editingId).select('id').single()
      : await supabase.from('campaigns').insert(row).select('id').single();
    if (res.error) { setError(res.error.message); return null; }
    setEditingId(res.data.id);
    load();
    return res.data.id;
  };

  const test = async () => {
    const id = await save();
    if (!id) return;
    setBusy('test');
    try { await invoke('send-campaign', { campaignId: id, test: true }); setMsg('Test sent to your Systems email.'); }
    catch (e) { setError(e.message); }
    setBusy('');
  };

  const sendNow = async () => {
    const n = draft.audience === 'everyone' ? (audienceSize.subscribers || 0) + (audienceSize.curators || 0) : audienceSize[draft.audience];
    if (!window.confirm(`Send “${draft.subject}” to about ${n ?? 'all'} people? This can’t be undone.`)) return;
    const id = await save();
    if (!id) return;
    setBusy('send');
    try {
      const r = await invoke('send-campaign', { campaignId: id });
      setMsg(`Sent to ${r.sent} people${r.failed ? ` (${r.failed} failed)` : ''}.`);
      setDraft(blank); setEditingId(null); load();
    } catch (e) { setError(e.message); }
    setBusy('');
  };

  const remove = async (c) => {
    if (!window.confirm('Delete this draft?')) return;
    await supabase.from('campaigns').delete().eq('id', c.id);
    if (editingId === c.id) { setDraft(blank); setEditingId(null); }
    load();
  };

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Campaigns</p>
        <h1>Email your community</h1>
        <p className="sys-muted">
          {audienceSize.subscribers ?? '—'} subscribers · {audienceSize.curators ?? '—'} curators. Every email includes an unsubscribe link.
        </p>
      </header>

      {msg && <p className="sys-ok" onAnimationEnd={() => setMsg('')}><Check size={16} /> {msg}</p>}
      {error && <p className="sys-error">{error}</p>}

      <section className="sys-card sys-form">
        <h2><Mail size={18} /> {editingId ? 'Edit campaign' : 'New campaign'}</h2>
        <div className="sys-chips" role="radiogroup" aria-label="Audience">
          {AUDIENCES.map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={draft.audience === v}
              className={`sys-chip ${draft.audience === v ? 'is-on' : ''}`} onClick={() => setDraft({ ...draft, audience: v })}>
              <Users size={13} /> {l}
            </button>
          ))}
        </div>
        <label className="sys-field"><span>Subject</span>
          <input value={draft.subject} maxLength={120} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="The Winter Gala is coming" />
        </label>
        <label className="sys-field"><span>Message</span>
          <textarea rows={10} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            placeholder={'Blank line = new paragraph. **bold**, and links like [RSVP here](https://p31market.com/calendar).'} />
        </label>
        <AiAssist
          task="campaign"
          label="Draft this email with AI (uses your subject + notes)"
          getInput={() => ({ goal: draft.subject, details: draft.body, audience: AUDIENCES.find(([v]) => v === draft.audience)?.[1] })}
          onUse={(t) => {
            const [subject, ...rest] = t.split(/\n/);
            setDraft((d) => ({ ...d, subject: subject.replace(/^subject:\s*/i, '').trim(), body: rest.join('\n').trim() || t }));
          }}
        />
        <div className="sys-row">
          <button className="sys-btn sys-btn--ghost" onClick={save}>Save draft</button>
          <button className="sys-btn sys-btn--ghost" onClick={test} disabled={!!busy}><FlaskConical size={16} /> {busy === 'test' ? 'Sending…' : 'Send me a test'}</button>
          <button className="sys-btn sys-btn--gold" onClick={sendNow} disabled={!!busy}><Send size={16} /> {busy === 'send' ? 'Sending…' : 'Send campaign'}</button>
          {editingId && <button className="sys-linkbtn" onClick={() => { setDraft(blank); setEditingId(null); }}>New</button>}
        </div>
      </section>

      <section className="sys-results">
        {list.map((c) => (
          <article className="sys-result" key={c.id}>
            <div className="sys-result__main">
              <span className="sys-pill">{c.status}{c.status === 'sent' ? ` · ${c.sent_count}` : ''}</span>
              <h3>{c.subject}</h3>
              <div className="sys-result__meta">
                <span>{AUDIENCES.find(([v]) => v === c.audience)?.[1]}</span>
                <span>{new Date(c.sent_at || c.created_at).toLocaleDateString()}</span>
                {c.error && <span className="sys-error">{c.error}</span>}
              </div>
            </div>
            {c.status !== 'sent' && (
              <div className="sys-row">
                <button className="sys-icon-btn" onClick={() => { setEditingId(c.id); setDraft({ subject: c.subject, body: c.body, audience: c.audience }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label="Edit"><Plus size={16} /></button>
                <button className="sys-icon-btn" onClick={() => remove(c)} aria-label="Delete draft"><Trash2 size={16} /></button>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
};

export default Campaigns;
