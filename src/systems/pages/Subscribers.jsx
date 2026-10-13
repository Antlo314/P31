import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Search, Download, UserPlus, BellOff, Bell } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DeleteRecord, EditRecord } from '../AdminRecord';

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const FILTERS = [['subscribed', 'Subscribed'], ['unsubscribed', 'Unsubscribed'], ['all', 'All']];

/** Systems → Campaigns → Subscribers: everyone on the newsletter list (the pop-up, the footer, imports). */
const Subscribers = () => {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('subscribed');
  const [add, setAdd] = useState({ full_name: '', email: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('leads').select('id, full_name, email, phone, source, unsubscribed, created_at, welcome_step')
      .order('created_at', { ascending: false }).limit(5000);
    if (err) { setError(err.message); setRows([]); return; }
    setRows(data || []);
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const shown = useMemo(() => (rows || []).filter((r) => (filter === 'all' || (filter === 'unsubscribed' ? r.unsubscribed : !r.unsubscribed))
    && (!q || `${r.full_name} ${r.email} ${r.phone || ''} ${r.source || ''}`.toLowerCase().includes(q.toLowerCase()))), [rows, filter, q]);

  const change = async (r, patch) => {
    const { data, error: err } = await supabase.from('leads').update(patch).eq('id', r.id).select('id, full_name, email, phone, source, unsubscribed, created_at, welcome_step').maybeSingle();
    if (err || !data) return { error: err || { message: 'Not saved: this login may not have the Emails dashboard.' } };
    setRows((list) => list.map((x) => (x.id === r.id ? data : x)));
    return { data };
  };
  const toggle = async (r) => {
    const res = await change(r, { unsubscribed: !r.unsubscribed });
    setError(res.error ? res.error.message : '');
    setMsg(res.error ? '' : `${r.email} is ${r.unsubscribed ? 'subscribed again' : 'unsubscribed'}.`);
  };
  const addOne = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    const email = add.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError('Enter a valid email.');
    if ((rows || []).some((r) => r.email?.toLowerCase() === email)) return setError('That email is already on the list.');
    // Added by the team; like any new subscriber they get the welcome emails (Settings → Automatic emails).
    const { error: err } = await supabase.from('leads').insert({ full_name: add.full_name.trim() || email.split('@')[0], email, source: 'team' });
    if (err) return setError(err.message);
    setAdd({ full_name: '', email: '' }); setMsg(`${email} added.`); load();
  };
  const exportCsv = () => {
    const head = ['Name', 'Email', 'Phone', 'Source', 'Subscribed', 'Joined'];
    const csv = [head, ...shown.map((r) => [r.full_name, r.email, r.phone, r.source, r.unsubscribed ? 'no' : 'yes', fmt(r.created_at)])]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `p31-subscribers-${new Date().toISOString().slice(0, 10)}.csv` }).click();
  };

  const count = (f) => (rows || []).filter((r) => (f === 'all' ? true : f === 'unsubscribed' ? r.unsubscribed : !r.unsubscribed)).length;
  return (
    <section className="sys-card sys-form" data-tour="subscribers">
      <h2><Users size={18} /> Subscribers</h2>
      <p className="sys-muted" style={{ margin: 0 }}>Everyone on the newsletter list. Edit a name or email, unsubscribe or resubscribe someone, add someone by hand, or delete them.</p>
      <div className="sys-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="sys-chips">{FILTERS.map(([v, l]) => <button key={v} type="button" className={`sys-chip ${filter === v ? 'is-on' : ''}`} onClick={() => setFilter(v)}>{l} <span className="sys-muted">{count(v)}</span></button>)}</div>
        <label className="sys-field sys-grow crm-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or source" aria-label="Search subscribers" /></label>
        <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={exportCsv} disabled={!shown.length}><Download size={14} /> CSV</button>
      </div>
      <form className="sys-row" onSubmit={addOne} style={{ flexWrap: 'wrap', gap: 8 }}>
        <input className="sys-grow" value={add.full_name} onChange={(e) => setAdd({ ...add, full_name: e.target.value })} placeholder="Name (optional)" aria-label="New subscriber name" />
        <input className="sys-grow" type="email" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} placeholder="email@example.com" aria-label="New subscriber email" />
        <button className="sys-btn sys-btn--gold sys-btn--sm"><UserPlus size={14} /> Add</button>
      </form>
      {error && <p className="sys-error" role="alert">{error}</p>}
      {msg && <p className="sys-ok" role="status">{msg}</p>}
      {rows === null ? <p className="sys-muted">Loading…</p> : (
        <ul className="sys-list sub-list">
          {shown.slice(0, 300).map((r) => (
            <li key={r.id} className="sub-row">
              <span className="sub-row__main"><strong>{r.full_name}</strong><small>{r.email}{r.phone ? ` · ${r.phone}` : ''} · {r.source || 'site'} · joined {fmt(r.created_at)}{r.unsubscribed ? ' · unsubscribed' : ''}</small></span>
              <span className="adm-actions">
                <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => toggle(r)}>{r.unsubscribed ? <><Bell size={14} /> Resubscribe</> : <><BellOff size={14} /> Unsubscribe</>}</button>
                <EditRecord title="Edit" value={r} fields={[['full_name', 'Name'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel']]} onSave={(p) => change(r, p)} />
                <DeleteRecord what={r.email} note="They leave the list and get no more emails." onDelete={() => supabase.from('leads').delete({ count: 'exact' }).eq('id', r.id)}
                  onDone={() => setRows((list) => list.filter((x) => x.id !== r.id))} />
              </span>
            </li>
          ))}
          {shown.length > 300 && <li className="sys-muted">Showing the first 300. Search to narrow it down.</li>}
          {!shown.length && <li className="sys-muted">Nobody here.</li>}
        </ul>
      )}
    </section>
  );
};

export default Subscribers;
