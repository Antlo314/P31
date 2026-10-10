import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users, Search, Download, ArrowLeft, Mail, Phone, CalendarDays, Video, GraduationCap, Heart, Handshake, Store, Award, StickyNote,
  Sparkles, PhoneCall, Send, Check, X, UserPlus,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime } from '../../lib/academy';

const STAGES = [['all', 'Everyone'], ['lead', 'Leads'], ['prospect', 'Prospects'], ['member', 'Members'], ['alumni', 'Alumni'], ['partner', 'Partners'], ['curator', 'Curators']];
const ICON = {
  subscribed: Heart, partnership_request: Handshake, market_rsvp: Store, intro_request: PhoneCall, intro_status: PhoneCall,
  calendly_intro: CalendarDays, calendly_session: CalendarDays, calendly_connect: Handshake, calendly_unknown: CalendarDays,
  invite_sent: Send, enrolled: GraduationCap, session_joined: Video, attendance: Check, zoom_joined: Video, zoom_left: Video,
  certificate: Award, note: StickyNote, collective_application: UserPlus,
};
const iconFor = (kind) => ICON[kind] || (kind.startsWith('membership_') ? GraduationCap : Sparkles);

// Systems → CRM: everyone who has touched P31 and the Collective, with their whole story.
const Crm = () => {
  const [contacts, setContacts] = useState([]);
  const [stage, setStage] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState([]);

  const load = useCallback(async () => {
    const [c, r] = await Promise.all([
      supabase.from('crm_contacts').select('*').order('last_activity_at', { ascending: false }).limit(2000),
      supabase.from('crm_activities').select('kind, occurred_at').gte('occurred_at', new Date(Date.now() - 30 * 86400e3).toISOString()).limit(5000),
    ]);
    if (c.error) { setError(c.error.message.includes('does not exist') ? 'Run storefront_v22_crm_and_zoom.sql in Supabase to turn on the CRM.' : c.error.message); return; }
    setContacts(c.data || []); setRecent(r.data || []);
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const shown = useMemo(() => contacts.filter((c) => (stage === 'all' || c.stage === stage)
    && (!q || `${c.full_name || ''} ${c.email || ''} ${c.phone || ''} ${(c.tags || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [contacts, stage, q]);
  const count = (k) => recent.filter((a) => a.kind.startsWith(k)).length;

  const exportCsv = () => {
    const head = ['Name', 'Email', 'Phone', 'Stage', 'Sources', 'Tags', 'First seen', 'Last activity', 'Notes'];
    const rows = shown.map((c) => [c.full_name, c.email, c.phone, c.stage, (c.sources || []).join('; '), (c.tags || []).join('; '), fmtDate(c.created_at), fmtDate(c.last_activity_at), c.notes]);
    const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `p31-crm-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
  };

  if (open) return <Contact contact={open} onBack={() => { setOpen(null); load(); }} />;

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">CRM</p>
        <h1>People</h1>
        <p className="sys-muted">Every sign-up, partnership request, RSVP, intro call, Calendly booking, enrollment, session and Zoom join — in one timeline per person.</p>
      </header>
      {error && <p className="sys-error">{error}</p>}

      <div className="sys-stats" style={{ marginBottom: 16 }}>
        <div className="sys-stat"><span className="sys-stat__n">{contacts.length}</span><span className="sys-stat__l">Contacts</span></div>
        <div className="sys-stat"><span className="sys-stat__n">{count('calendly_')}</span><span className="sys-stat__l">Calendly bookings · 30 days</span></div>
        <div className="sys-stat"><span className="sys-stat__n">{count('intro_request')}</span><span className="sys-stat__l">Intro requests · 30 days</span></div>
        <div className="sys-stat"><span className="sys-stat__n">{count('session_joined') + count('zoom_joined')}</span><span className="sys-stat__l">Session joins · 30 days</span></div>
      </div>

      <div className="sys-row sys-row--center" style={{ marginBottom: 12 }}>
        <label className="sys-field sys-grow crm-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone or tag" aria-label="Search contacts" /></label>
        <button className="sys-btn sys-btn--ghost sys-btn--sm" onClick={exportCsv}><Download size={15} /> Export CSV</button>
      </div>
      <div className="sys-chips" role="tablist" style={{ marginBottom: 14 }}>
        {STAGES.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={stage === v} className={`sys-chip ${stage === v ? 'is-on' : ''}`} onClick={() => setStage(v)}>
            {l} <span className="sys-muted">{v === 'all' ? contacts.length : contacts.filter((c) => c.stage === v).length}</span>
          </button>
        ))}
      </div>

      <ul className="sys-list">
        {shown.map((c) => (
          <li key={c.id}>
            <button className="sys-result crm-row" onClick={() => setOpen(c)}>
              <span className="crm-avatar">{(c.full_name || c.email || '?').charAt(0).toUpperCase()}</span>
              <div className="sys-result__main">
                <h3>{c.full_name || c.email}</h3>
                <div className="sys-result__meta"><span>{c.email}</span>{c.phone && <span>{c.phone}</span>}<span>{(c.sources || []).join(' · ')}</span><span>active {fmtDate(c.last_activity_at)}</span></div>
              </div>
              <span className={`sys-pill crm-stage crm-stage--${c.stage}`}>{c.stage}</span>
            </button>
          </li>
        ))}
        {!shown.length && !error && <li className="sys-empty">No contacts here yet.</li>}
      </ul>
    </div>
  );
};

const Contact = ({ contact, onBack }) => {
  const [c, setC] = useState(contact);
  const [items, setItems] = useState([]);
  const [note, setNote] = useState('');
  const [tag, setTag] = useState('');
  const [saved, setSaved] = useState('');
  const load = useCallback(async () => {
    const { data } = await supabase.rpc('crm_timeline', { p_contact: contact.id });
    setItems(data || []);
  }, [contact.id]);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const patch = async (p) => {
    const { data, error } = await supabase.from('crm_contacts').update(p).eq('id', c.id).select('*').single();
    if (!error) { setC(data); setSaved('Saved'); setTimeout(() => setSaved(''), 1400); }
  };
  const addNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    await supabase.from('crm_activities').insert({ contact_id: c.id, kind: 'note', title: note.trim().slice(0, 140), detail: { body: note.trim() }, source: 'team' });
    setNote(''); load();
  };

  return (
    <div className="sys-page">
      <button className="sys-linkbtn" onClick={onBack}><ArrowLeft size={15} /> All people</button>
      <header className="sys-page__head">
        <p className="sys-eyebrow">Contact · {c.stage}</p>
        <h1>{c.full_name || c.email}</h1>
        <div className="sys-result__meta">
          {c.email && <a href={`mailto:${c.email}`}><Mail size={13} /> {c.email}</a>}
          {c.phone && <a href={`tel:${c.phone}`}><Phone size={13} /> {c.phone}</a>}
          <span>first seen {fmtDate(c.created_at)}</span>
        </div>
      </header>

      <div className="crm-grid">
        <section className="sys-card sys-form">
          <h2>Details {saved && <span className="sys-ok" style={{ margin: 0 }}>{saved}</span>}</h2>
          <label className="sys-field"><span>Name</span><input defaultValue={c.full_name || ''} onBlur={(e) => e.target.value !== (c.full_name || '') && patch({ full_name: e.target.value || null })} /></label>
          <label className="sys-field"><span>Phone</span><input defaultValue={c.phone || ''} onBlur={(e) => e.target.value !== (c.phone || '') && patch({ phone: e.target.value || null })} /></label>
          <label className="sys-field"><span>Stage</span>
            <select value={c.stage} onChange={(e) => patch({ stage: e.target.value })}>{STAGES.filter(([v]) => v !== 'all').map(([v, l]) => <option key={v} value={v}>{l.replace(/s$/, '')}</option>)}<option value="other">Other</option></select>
          </label>
          <div className="sys-field"><span>Tags</span>
            <div className="sys-chips">
              {(c.tags || []).map((t) => <button key={t} className="sys-chip is-on" onClick={() => patch({ tags: c.tags.filter((x) => x !== t) })}>{t} <X size={12} /></button>)}
              <form onSubmit={(e) => { e.preventDefault(); if (tag.trim() && !(c.tags || []).includes(tag.trim())) patch({ tags: [...(c.tags || []), tag.trim()] }); setTag(''); }}>
                <input className="crm-tag-input" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="+ tag" aria-label="Add tag" />
              </form>
            </div>
          </div>
          <label className="sys-field"><span>Notes</span><textarea rows={4} defaultValue={c.notes || ''} onBlur={(e) => e.target.value !== (c.notes || '') && patch({ notes: e.target.value || null })} /></label>
        </section>

        <section className="sys-card">
          <h2>Timeline</h2>
          <form className="sys-row" onSubmit={addNote} style={{ marginBottom: 10 }}>
            <input className="sys-grow crm-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Log a call, a follow-up, anything…" aria-label="Add a note" />
            <button className="sys-btn sys-btn--gold sys-btn--sm">Add</button>
          </form>
          <ol className="crm-timeline">
            {items.map((a) => {
              const Icon = iconFor(a.kind);
              return (
                <li key={a.id}>
                  <span className="crm-timeline__icon"><Icon size={14} /></span>
                  <div>
                    <strong>{a.title}</strong>
                    <small>{fmtDateTime(a.occurred_at)}{a.source ? ` · ${a.source}` : ''}</small>
                    {a.kind === 'note' && a.detail?.body && a.detail.body !== a.title && <p>{a.detail.body}</p>}
                    {a.detail?.message && <p>{a.detail.message}</p>}
                  </div>
                </li>
              );
            })}
            {!items.length && <li className="sys-muted">Nothing yet.</li>}
          </ol>
        </section>
      </div>
    </div>
  );
};

export default Crm;
