import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileSignature, CalendarCheck, Star, HandHeart, Search, Download, ArrowLeft, Mail, Phone, Check, Store, UserPlus, ExternalLink, MapPin, Globe } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime } from '../../lib/academy';
import { eventLabel } from '../../lib/forms';
import { AGAIN_LABEL } from '../../pages/vendors/formText';
import { DeleteRecord, EditRecord } from '../AdminRecord';

const TABS = [
  ['agreements', 'Agreements', FileSignature, 'vendor_agreements'],
  ['registrations', 'Registrations', CalendarCheck, 'vendor_registrations'],
  ['feedback', 'Feedback', Star, 'vendor_feedback'],
  ['volunteers', 'Volunteers', HandHeart, 'volunteer_signups'],
];
const STATUS = {
  agreements: [['new', 'New'], ['account_sent', 'Account link sent'], ['active', 'Storefront active'], ['cancelled', 'Cancelled']],
  registrations: [['new', 'New'], ['confirmed', 'Confirmed'], ['waitlist', 'Waitlist'], ['declined', 'Declined'], ['cancelled', 'Cancelled']],
  volunteers: [['new', 'New'], ['confirmed', 'Confirmed'], ['declined', 'Declined']],
};
const PILL = { new: 'new', account_sent: 'reviewing', active: 'approved', confirmed: 'approved', waitlist: 'waitlist', declined: 'declined', cancelled: 'declined' };
const label = (tab, s) => (STATUS[tab] || []).find(([v]) => v === s)?.[1] || s;
const dateOnly = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const name = (r) => [r.first_name, r.last_name].filter(Boolean).join(' ');
const stars = (n) => (n ? `${'★'.repeat(n)}${'☆'.repeat(5 - n)}` : '—');
const avg = (rows, k) => { const v = rows.map((r) => r[k]).filter((x) => x != null); return v.length ? (v.reduce((s, x) => s + x, 0) / v.length).toFixed(1) : '—'; };

const csvOut = (head, rows, file) => {
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `${file}-${new Date().toISOString().slice(0, 10)}.csv` }).click();
};

const Field = ({ label: l, children }) => (children ? <div className="app-field"><span>{l}</span><p>{children}</p></div> : null);
const Signature = ({ row }) => (
  <div className="app-field"><span>Signature</span>
    {row.signature ? <img className="fm-sig" src={row.signature} alt={`Signature of ${row.signed_name}`} /> : <p className="sys-muted">Typed name only</p>}
    <p>{row.signed_name} · {dateOnly(row.signed_on)}</p>
  </div>
);

/** Systems → Market → Vendor forms: the four forms that replaced JotForm, with the actions each one leads to. */
const Forms = () => {
  const [sp, setSp] = useSearchParams();
  const tab = TABS.some(([t]) => t === sp.get('tab')) ? sp.get('tab') : 'agreements';
  const setTab = (t) => setSp({ tab: t });
  const [data, setData] = useState({ agreements: [], registrations: [], feedback: [], volunteers: [], events: [] });
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    const r = await Promise.all([
      supabase.from('vendor_agreements').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('vendor_registrations').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('vendor_feedback').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('volunteer_signups').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('market_events').select('id, title, event_date, venue, is_active').order('event_date', { ascending: false }).limit(60),
    ]);
    const bad = r.find((x) => x.error);
    if (bad) {
      setError(/does not exist|schema cache/.test(bad.error.message) ? 'Run storefront_v37_forms.sql in Supabase to turn on the vendor forms.' : bad.error.message);
      return;
    }
    setError('');
    setData({ agreements: r[0].data || [], registrations: r[1].data || [], feedback: r[2].data || [], volunteers: r[3].data || [], events: (r[4].data || []).map((e) => ({ ...e, label: eventLabel(e) })) });
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const rows = data[tab];
  const shown = useMemo(() => rows.filter((r) => (filter === 'all' || r.status === filter || (tab === 'feedback' && r.again === filter))
    && (!q || `${r.business_name || ''} ${name(r)} ${r.email || ''} ${r.phone || ''} ${r.event_label || r.market_label || ''}`.toLowerCase().includes(q.toLowerCase()))), [rows, filter, q, tab]);
  const n = (s) => rows.filter((r) => r.status === s).length;
  const back = () => { setOpen(null); load(); };

  if (open) {
    const props = { row: open, events: data.events, onBack: back };
    if (tab === 'agreements') return <Agreement {...props} />;
    if (tab === 'registrations') return <Registration {...props} />;
    if (tab === 'feedback') return <Feedback {...props} />;
    return <VolunteerRow {...props} />;
  }

  const exportCsv = () => {
    if (tab === 'agreements') csvOut(['Submitted', 'Status', 'Business', 'First name', 'Last name', 'Email', 'Phone', 'Street', 'Line 2', 'City', 'State', 'Zip', 'Country', 'Signed as', 'Date signed', 'Terms version', 'Has account', 'Team notes'],
      shown.map((r) => [fmtDate(r.created_at), label(tab, r.status), r.business_name, r.first_name, r.last_name, r.email, r.phone, r.address?.street, r.address?.line2, r.address?.city, r.address?.state, r.address?.zip, r.address?.country, r.signed_name, r.signed_on, r.terms_version, r.curator_id ? 'Yes' : 'No', r.review_notes]), 'p31-storefront-agreements');
    else if (tab === 'registrations') csvOut(['Submitted', 'Status', 'Event', 'Business', 'First name', 'Last name', 'Email', 'Phone', 'Website', 'Social', 'Products or services', 'Logo', 'Signed as', 'Date signed', 'In lineup', 'Team notes'],
      shown.map((r) => [fmtDate(r.created_at), label(tab, r.status), r.event_label, r.business_name, r.first_name, r.last_name, r.email, r.phone, r.website, r.social, r.products, r.logo_url, r.signed_name, r.signed_on, r.lineup_id ? 'Yes' : 'No', r.review_notes]), 'p31-market-registrations');
    else if (tab === 'feedback') csvOut(['Submitted', 'Market', 'Business', 'Email', 'Overall', 'Venue', 'DJ', 'Organization', 'Sales', 'Vending again', 'Enjoyed most', 'Could improve', 'Comments'],
      shown.map((r) => [fmtDate(r.created_at), r.market_label, r.business_name, r.email, r.overall, r.venue, r.dj, r.organization, r.sales, AGAIN_LABEL[r.again] || r.again, r.enjoyed, r.improve, r.comments]), 'p31-vendor-feedback');
    else csvOut(['Submitted', 'Status', 'First name', 'Last name', 'Email', 'Phone', 'Emergency contact', 'Market', 'Signed as', 'Date signed', 'Team notes'],
      shown.map((r) => [fmtDate(r.created_at), label(tab, r.status), r.first_name, r.last_name, r.email, r.phone, r.emergency_contact, data.events.find((e) => e.id === r.event_id)?.label || '', r.signed_name, r.signed_on, r.review_notes]), 'p31-volunteers');
  };

  const chips = tab === 'feedback'
    ? [['all', 'All'], ['in', 'In for the next market'], ['waitlist', 'Waitlist'], ['no', 'Not a fit']]
    : [...STATUS[tab].filter(([v]) => v !== 'cancelled' || n('cancelled')), ['all', 'All']];
  const count = (v) => (v === 'all' ? rows.length : tab === 'feedback' ? rows.filter((r) => r.again === v).length : n(v));

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Market</p>
        <h1>Vendor forms</h1>
        <p className="sys-muted">Storefront agreements, market registrations, feedback surveys and volunteer acknowledgments, signed on p31market.com (these replaced the JotForms). Each signer is also in the CRM.</p>
      </header>
      {error && <p className="sys-error">{error}</p>}

      <div className="sys-chips fm-tabs" role="tablist" aria-label="Form">
        {TABS.map((def) => {
          const [t, l] = def;
          const Icon = def[2];
          return (
            <button key={t} role="tab" aria-selected={tab === t} className={`sys-chip ${tab === t ? 'is-on' : ''}`} onClick={() => { setTab(t); setFilter('all'); setQ(''); }}>
              <Icon size={13} /> {l} <span className="sys-muted">{data[t].length}</span>
            </button>
          );
        })}
      </div>

      {tab === 'agreements' && (
        <div className="sys-stats" style={{ marginBottom: 16 }}>
          <div className="sys-stat"><span className="sys-stat__n">{n('new')}</span><span className="sys-stat__l">Waiting for the account link</span></div>
          <div className="sys-stat"><span className="sys-stat__n">{n('account_sent')}</span><span className="sys-stat__l">Link sent, not signed up</span></div>
          <div className="sys-stat"><span className="sys-stat__n">{n('active')}</span><span className="sys-stat__l">Storefronts active</span></div>
          <div className="sys-stat"><span className="sys-stat__n">{rows.length}</span><span className="sys-stat__l">Signed in all</span></div>
        </div>
      )}
      {tab === 'registrations' && (
        <div className="sys-stats" style={{ marginBottom: 16 }}>
          <div className="sys-stat"><span className="sys-stat__n">{n('new')}</span><span className="sys-stat__l">New</span></div>
          <div className="sys-stat"><span className="sys-stat__n">{n('confirmed')}</span><span className="sys-stat__l">Confirmed</span></div>
          <div className="sys-stat"><span className="sys-stat__n">{rows.filter((r) => r.lineup_id).length}</span><span className="sys-stat__l">In a lineup</span></div>
          <div className="sys-stat"><span className="sys-stat__n">{n('waitlist')}</span><span className="sys-stat__l">Waitlist</span></div>
        </div>
      )}
      {tab === 'feedback' && <FeedbackSummary rows={rows} />}
      {tab === 'volunteers' && (
        <div className="sys-stats" style={{ marginBottom: 16 }}>
          <div className="sys-stat"><span className="sys-stat__n">{n('new')}</span><span className="sys-stat__l">New</span></div>
          <div className="sys-stat"><span className="sys-stat__n">{n('confirmed')}</span><span className="sys-stat__l">Confirmed</span></div>
          <div className="sys-stat"><span className="sys-stat__n">{rows.filter((r) => r.event_id && data.events[0] && r.event_id === data.events.find((e) => e.event_date >= new Date().toISOString().slice(0, 10))?.id).length}</span><span className="sys-stat__l">For the next market</span></div>
          <div className="sys-stat"><span className="sys-stat__n">{rows.length}</span><span className="sys-stat__l">Volunteers in all</span></div>
        </div>
      )}

      <div className="sys-row sys-row--center" style={{ marginBottom: 12 }}>
        <label className="sys-field sys-grow crm-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, business, email, phone or market" aria-label="Search" /></label>
        <button className="sys-btn sys-btn--ghost sys-btn--sm" onClick={exportCsv} disabled={!shown.length}><Download size={15} /> Export CSV</button>
      </div>
      <div className="sys-chips" role="tablist" style={{ marginBottom: 14 }}>
        {chips.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={filter === v} className={`sys-chip ${filter === v ? 'is-on' : ''}`} onClick={() => setFilter(v)}>{l} <span className="sys-muted">{count(v)}</span></button>
        ))}
      </div>

      <ul className="sys-list">
        {shown.map((r) => (
          <li key={r.id}>
            <button className="sys-result crm-row" onClick={() => setOpen(r)}>
              {r.logo_url ? <img className="fm-logo" src={r.logo_url} alt="" /> : <span className="crm-avatar">{(r.business_name || name(r) || '?').charAt(0).toUpperCase()}</span>}
              <div className="sys-result__main">
                <h3>{tab === 'volunteers' ? name(r) : `${r.business_name}${name(r) ? ` · ${name(r)}` : ''}`}</h3>
                <div className="sys-result__meta">
                  {tab === 'registrations' && <span>{r.event_label}</span>}
                  {tab === 'feedback' && <><span>{r.market_label}</span><span>{stars(r.overall)}</span><span>{r.sales}</span></>}
                  {r.email && <span>{r.email}</span>}
                  <span>{tab === 'feedback' ? 'sent' : 'signed'} {fmtDate(r.created_at)}</span>
                </div>
              </div>
              {tab === 'feedback'
                ? <span className={`sys-pill app-status app-status--${r.again === 'in' ? 'approved' : r.again === 'waitlist' ? 'waitlist' : 'declined'}`}>{r.again === 'in' ? 'In for next' : r.again === 'waitlist' ? 'Waitlist' : 'Not a fit'}</span>
                : <span className={`sys-pill app-status app-status--${PILL[r.status] || 'new'}`}>{label(tab, r.status)}</span>}
            </button>
          </li>
        ))}
        {!shown.length && !error && <li className="sys-empty">Nothing here yet. {tab === 'agreements' ? 'Agreements are signed at p31market.com/vendors/agreement.' : tab === 'registrations' ? 'Vendors register at p31market.com/vendors/register.' : tab === 'feedback' ? 'The survey lives at p31market.com/vendors/feedback.' : 'Volunteers sign up at p31market.com/volunteer.'}</li>}
      </ul>
    </div>
  );
};

/** Averages per market from the surveys. */
const FeedbackSummary = ({ rows }) => {
  const byMarket = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => { if (!m.has(r.market_label)) m.set(r.market_label, []); m.get(r.market_label).push(r); });
    return [...m.entries()].slice(0, 4);
  }, [rows]);
  if (!rows.length) return null;
  return (
    <div className="fm-markets" style={{ marginBottom: 16 }}>
      {byMarket.map(([mk, list]) => (
        <div className="sys-card fm-market" key={mk}>
          <h2><Star size={15} /> {mk} <span className="sys-muted">· {list.length} survey{list.length === 1 ? '' : 's'}</span></h2>
          <div className="fm-avgs">
            <div><strong>{avg(list, 'overall')}</strong><span>Overall</span></div>
            <div><strong>{avg(list, 'venue')}</strong><span>Venue</span></div>
            <div><strong>{avg(list, 'dj')}</strong><span>DJ</span></div>
            <div><strong>{avg(list, 'organization')}</strong><span>Organization</span></div>
          </div>
          <p className="sys-muted" style={{ margin: 0, fontSize: '0.82rem' }}>
            Sales: {['Excellent', 'Good', 'Below my expectations', 'Poor'].map((s) => `${list.filter((r) => r.sales === s).length} ${s.toLowerCase()}`).join(' · ')}
            <br />Vending again: {list.filter((r) => r.again === 'in').length} in · {list.filter((r) => r.again === 'waitlist').length} waitlist · {list.filter((r) => r.again === 'no').length} not a fit
          </p>
        </div>
      ))}
    </div>
  );
};

// ── Shared pieces for the detail pages ──
const useRow = (table, row) => {
  const [r, setR] = useState(row);
  const [saved, setSaved] = useState('');
  const patch = async (p) => {
    const { data: who } = await supabase.auth.getUser();
    const { data, error } = await supabase.from(table)
      .update({ ...p, ...(p.status ? { reviewed_by: who?.user?.id || null, reviewed_at: new Date().toISOString() } : {}) })
      .eq('id', r.id).select('*').single();
    if (!error && data) { setR(data); setSaved('Saved'); setTimeout(() => setSaved(''), 1400); }
    else if (error) setSaved(error.message);
  };
  const refresh = async () => { const { data } = await supabase.from(table).select('*').eq('id', r.id).single(); if (data) setR(data); };
  const remove = () => supabase.from(table).delete({ count: 'exact' }).eq('id', r.id);
  // For Edit details: the same update, reporting back to EditRecord.
  const save = async (p) => { const res = await supabase.from(table).update(p).eq('id', r.id).select('*').maybeSingle(); if (res.data) setR(res.data); return res.error ? res : res.data ? res : { error: { message: 'That did not save. This login may not have the Vendors dashboard.' } }; };
  return [r, patch, saved, refresh, remove, save];
};

const StatusChips = ({ tab, r, patch }) => (
  <div className="sys-chips">
    {STATUS[tab].map(([v, l]) => (
      <button key={v} className={`sys-chip ${r.status === v ? 'is-on' : ''}`} onClick={() => r.status !== v && patch({ status: v })}>{r.status === v && <Check size={13} />} {l}</button>
    ))}
  </div>
);
const Notes = ({ r, patch }) => (
  <label className="sys-field"><span>Team notes (private)</span>
    <textarea rows={4} defaultValue={r.review_notes || ''} onBlur={(e) => e.target.value !== (r.review_notes || '') && patch({ review_notes: e.target.value || null })} placeholder="Follow-ups, payment, booth…" />
  </label>
);
const Head = ({ eyebrow, title, meta, onBack, backLabel }) => (
  <>
    <button className="sys-linkbtn" onClick={onBack}><ArrowLeft size={15} /> {backLabel}</button>
    <header className="sys-page__head">
      <p className="sys-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <div className="sys-result__meta">{meta}</div>
    </header>
  </>
);
const EventSelect = ({ events, value, onChange, upcomingOnly = true, label: l = 'Market' }) => {
  const today = new Date().toISOString().slice(0, 10);
  const list = events.filter((e) => e.is_active !== false && (!upcomingOnly || e.event_date >= today));
  return (
    <label className="sys-field"><span>{l}</span>
      <select value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Pick a market…</option>
        {list.map((e) => <option key={e.id} value={e.id}>{e.label}{e.venue ? ` · ${e.venue}` : ''}</option>)}
      </select>
    </label>
  );
};
const invokeDecision = async (body) => {
  const { data, error } = await supabase.functions.invoke('vendor-decision', { body });
  let msg = error ? error.message : data?.error;
  if (error) { try { msg = (await error.context.json()).error || msg; } catch { /* keep */ } }
  return msg || null;
};

// ── Storefront agreement ──
const Agreement = ({ row, onBack }) => {
  const [r, patch, saved, refresh, remove] = useRow('vendor_agreements', row);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const addr = r.address || {};
  const first = r.first_name;

  const sendLink = async () => {
    setBusy(true); setMsg('');
    const { error } = await supabase.rpc('agreement_preapprove', { p_agreement: r.id });
    if (error) { setMsg(error.message); setBusy(false); return; }
    const err = await invokeDecision({ agreement_id: r.id, decision: 'storefront', note });
    setMsg(err ? `Pre-approved, but the email did not send: ${err}` : `Pre-approved and emailed ${r.email}.`);
    await refresh();
    setBusy(false);
  };

  return (
    <div className="sys-page">
      <Head eyebrow={`Storefront agreement · ${label('agreements', r.status)}`} title={r.business_name} onBack={onBack} backLabel="All agreements" meta={<>
        <span><Store size={13} /> {name(r)}</span>
        <a href={`mailto:${r.email}`}><Mail size={13} /> {r.email}</a>
        <a href={`tel:${r.phone}`}><Phone size={13} /> {r.phone}</a>
        <span>signed {fmtDateTime(r.created_at)}</span>
      </>} />
      <div className="crm-grid">
        <section className="sys-card">
          <h2>What she signed</h2>
          <Field label="Business">{r.business_name}</Field>
          <Field label="Contact person">{name(r)}</Field>
          <Field label="Business address">{[addr.street, addr.line2, [addr.city, addr.state, addr.zip].filter(Boolean).join(', '), addr.country].filter(Boolean).join('\n')}</Field>
          <Field label="Agreement">{`Agreed to the Proverbs 31 Virtual Marketplace Agreement terms · version ${r.terms_version}`}</Field>
          <Signature row={r} />
          <Field label="Curator account">{r.curator_id ? 'Yes: her storefront is linked to this agreement.' : 'Not yet. Pre-approve and send the account link below.'}</Field>
        </section>
        <section className="sys-card sys-form">
          <h2>Review {saved && <span className="sys-ok" style={{ margin: 0 }}>{saved}</span>}</h2>
          <StatusChips tab="agreements" r={r} patch={patch} />
          {r.reviewed_at && <p className="sys-muted" style={{ margin: 0 }}>Last updated {fmtDateTime(r.reviewed_at)}</p>}
          <Notes r={r} patch={patch} />
          <div className="adm-actions"><DeleteRecord what={`the agreement signed by ${r.business_name}`} note="Her storefront stays; it just loses the link to this agreement." onDelete={remove} onDone={onBack} /></div>
          <label className="sys-field"><span>A personal line for the email (optional)</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Welcome aboard! Call me if you get stuck on the setup." />
          </label>
          <button className="sys-btn sys-btn--gold" onClick={sendLink} disabled={busy}>
            <UserPlus size={15} /> {busy ? 'Working…' : r.curator_id ? `Email ${first}: storefront active` : `Pre-approve & email ${first} the account link`}
          </button>
          <p className="sys-muted" style={{ margin: 0 }}>{msg || (r.curator_id
            ? 'She already has an account. This marks her storefront approved and emails her that it is active.'
            : 'Adds her email to the pre-approved list (her studio opens the moment she registers with it) and emails the link to create her account, the 7–10 day promise on the form.')}</p>
          <a className="sys-linkbtn" href="https://www.p31market.com/vendors/agreement" target="_blank" rel="noreferrer"><ExternalLink size={14} /> The agreement as vendors see it</a>
        </section>
      </div>
    </div>
  );
};

// ── Market registration ──
const Registration = ({ row, events, onBack }) => {
  const [r, patch, saved, refresh, remove, save] = useRow('vendor_registrations', row);
  const [eventId, setEventId] = useState(row.event_id || '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const first = r.first_name;
  const decision = ['confirmed', 'waitlist', 'declined'].includes(r.status) ? r.status : null;
  const ev = events.find((e) => e.id === (eventId || r.event_id));

  const toLineup = async () => {
    setBusy(true); setMsg('');
    const { error } = await supabase.rpc('registration_to_lineup', { p_registration: r.id, p_event: eventId || r.event_id || null });
    setMsg(error ? error.message : `Added to the ${ev?.label || 'market'} lineup as confirmed.`);
    await refresh();
    setBusy(false);
  };
  const emailDecision = async () => {
    setBusy(true); setMsg('');
    if (eventId && eventId !== r.event_id) await patch({ event_id: eventId });
    const err = await invokeDecision({ registration_id: r.id, decision, note });
    if (!err && decision === 'confirmed' && !r.lineup_id && (eventId || r.event_id)) {
      await supabase.rpc('registration_to_lineup', { p_registration: r.id, p_event: eventId || r.event_id });
    }
    setMsg(err ? `Not sent: ${err}` : `Emailed ${r.email}${decision === 'confirmed' && (eventId || r.event_id) ? ' and added to the lineup' : ''}.`);
    await refresh();
    setBusy(false);
  };

  return (
    <div className="sys-page">
      <Head eyebrow={`Market registration · ${label('registrations', r.status)}`} title={r.business_name} onBack={onBack} backLabel="All registrations" meta={<>
        <span><CalendarCheck size={13} /> {r.event_label}</span>
        <span><Store size={13} /> {name(r)}</span>
        <a href={`mailto:${r.email}`}><Mail size={13} /> {r.email}</a>
        <a href={`tel:${r.phone}`}><Phone size={13} /> {r.phone}</a>
        <span>registered {fmtDateTime(r.created_at)}</span>
      </>} />
      <div className="crm-grid">
        <section className="sys-card">
          <h2>Her registration</h2>
          {r.logo_url && <div className="app-field"><span>Business logo</span><img className="fm-logo fm-logo--lg" src={r.logo_url} alt={`${r.business_name} logo`} /></div>}
          <Field label="Event">{r.event_label}</Field>
          <Field label="Products or services on event day">{r.products}</Field>
          <Field label="Website">{r.website}</Field>
          <Field label="Social media">{r.social}</Field>
          <Field label="Vendor Rules & Regulations">{r.agreed ? 'Agreed and signed' : 'Not signed'}</Field>
          <Signature row={r} />
          <Field label="Lineup">{r.lineup_id ? 'In the lineup (see Markets & events).' : 'Not in a lineup yet.'}</Field>
          {r.application_id && <Field label="Vendor application">Matched by email to an application in Vendor applications.</Field>}
        </section>
        <section className="sys-card sys-form">
          <h2>Review {saved && <span className="sys-ok" style={{ margin: 0 }}>{saved}</span>}</h2>
          <StatusChips tab="registrations" r={r} patch={patch} />
          {r.reviewed_at && <p className="sys-muted" style={{ margin: 0 }}>Last updated {fmtDateTime(r.reviewed_at)}</p>}
          <EventSelect events={events} value={eventId} onChange={setEventId} label={r.event_id ? 'Market' : 'Which market is this for?'} />
          {!r.lineup_id && (
            <button className="sys-btn sys-btn--ghost" onClick={toLineup} disabled={busy || !(eventId || r.event_id)}><Store size={15} /> Add to lineup</button>
          )}
          <Notes r={r} patch={patch} />
          <div className="adm-actions">
            <EditRecord value={r} onSave={save} fields={[['business_name', 'Business name'], ['first_name', 'First name'], ['last_name', 'Last name'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['website', 'Website'], ['social', 'Social media'], ['products', 'What she will sell', 'textarea']]} />
            <DeleteRecord what={`the registration from ${r.business_name}`} note="A lineup spot made from it stays." onDelete={remove} onDone={onBack} />
          </div>
          {decision ? (
            <>
              <label className="sys-field"><span>A personal line for the email (optional)</span>
                <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={decision === 'confirmed' ? 'e.g. Load-in opens at 1:30pm; your booth is by the entrance.' : 'e.g. We hope to see you at the spring market.'} />
              </label>
              <button className="sys-btn sys-btn--gold" onClick={emailDecision} disabled={busy}><Mail size={15} /> {busy ? 'Working…' : `Email ${first}: ${label('registrations', decision).toLowerCase()}`}</button>
              <p className="sys-muted" style={{ margin: 0 }}>{msg || `Sends the ${decision} note from vendor@p31market.com with the market details${decision === 'confirmed' ? ' and puts her in the lineup' : ''}, and records it here.`}</p>
            </>
          ) : <p className="sys-muted" style={{ margin: 0 }}>{msg || 'Set the status to Confirmed, Waitlist or Declined and the email button appears here.'}</p>}
        </section>
      </div>
    </div>
  );
};

// ── Feedback survey answer ──
const Feedback = ({ row, events, onBack }) => {
  const [r, , , refresh, remove] = useRow('vendor_feedback', row);
  const [eventId, setEventId] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const invite = async () => {
    setBusy(true); setMsg('');
    const { error } = await supabase.rpc('feedback_to_lineup', { p_feedback: r.id, p_event: eventId });
    setMsg(error ? error.message : 'Invited into the lineup. Confirm her from Markets & events once she replies.');
    await refresh();
    setBusy(false);
  };
  return (
    <div className="sys-page">
      <Head eyebrow={`Vendor feedback · ${r.market_label}`} title={r.business_name} onBack={onBack} backLabel="All feedback" meta={<>
        {r.email && <a href={`mailto:${r.email}`}><Mail size={13} /> {r.email}</a>}
        <span>sent {fmtDateTime(r.created_at)}</span>
      </>} />
      <div className="crm-grid">
        <section className="sys-card">
          <h2>Her answers</h2>
          <Field label="Which market did you attend?">{r.market_label}</Field>
          <Field label="Overall experience">{`${stars(r.overall)} ${r.overall}/5`}</Field>
          <Field label="Venue and atmosphere">{`${stars(r.venue)} ${r.venue}/5`}</Field>
          <Field label="DJ and sounds">{r.dj ? `${stars(r.dj)} ${r.dj}/5` : 'Not rated'}</Field>
          <Field label="Organization, including the Host and team">{`${stars(r.organization)} ${r.organization}/5`}</Field>
          <Field label="Sales based on the customer traffic">{r.sales}</Field>
          <Field label="Vending with P31 again">{AGAIN_LABEL[r.again] || r.again}</Field>
          <Field label="Enjoyed most">{r.enjoyed}</Field>
          <Field label="Could improve">{r.improve}</Field>
          <Field label="Additional comments">{r.comments}</Field>
        </section>
        <section className="sys-card sys-form">
          <h2>Follow up</h2>
          {r.again === 'in' ? (
            r.lineup_id ? <p className="sys-ok" style={{ margin: 0 }}><Check size={13} /> Invited into a lineup.</p> : (
              <>
                <p className="sys-muted" style={{ margin: 0 }}>She is in for the next market. Invite her straight into a lineup; she gets confirmed once she registers or replies.</p>
                <EventSelect events={events} value={eventId} onChange={setEventId} label="Invite to" />
                <button className="sys-btn sys-btn--gold" onClick={invite} disabled={busy || !eventId}><Store size={15} /> Invite into the lineup</button>
              </>
            )
          ) : r.again === 'waitlist' ? <p className="sys-muted" style={{ margin: 0 }}>Asked to stay on the waitlist for future events.</p>
            : <p className="sys-muted" style={{ margin: 0 }}>Said P31 is not the right fit. A kind thank-you is enough.</p>}
          {msg && <p className="sys-muted" style={{ margin: 0 }}>{msg}</p>}
          {r.email && <a className="sys-linkbtn" href={`mailto:${r.email}?subject=${encodeURIComponent(`Thank you for your feedback on ${r.market_label}`)}`}><Mail size={14} /> Write back</a>}
          <div className="adm-actions"><DeleteRecord what={`the feedback from ${r.business_name}`} onDelete={remove} onDone={onBack} /></div>
        </section>
      </div>
    </div>
  );
};

// ── Volunteer ──
const VolunteerRow = ({ row, events, onBack }) => {
  const [r, patch, saved, , remove, save] = useRow('volunteer_signups', row);
  const ev = events.find((e) => e.id === r.event_id);
  return (
    <div className="sys-page">
      <Head eyebrow={`Volunteer · ${label('volunteers', r.status)}`} title={name(r)} onBack={onBack} backLabel="All volunteers" meta={<>
        <a href={`mailto:${r.email}`}><Mail size={13} /> {r.email}</a>
        <a href={`tel:${r.phone}`}><Phone size={13} /> {r.phone}</a>
        {ev && <span><MapPin size={13} /> {ev.label}</span>}
        <span>signed {fmtDateTime(r.created_at)}</span>
      </>} />
      <div className="crm-grid">
        <section className="sys-card">
          <h2>Day-of-Event Acknowledgment</h2>
          <Field label="Emergency contact">{r.emergency_contact}</Field>
          <Field label="Market">{ev?.label || 'Not chosen yet'}</Field>
          <Field label="Acknowledged">{r.acknowledged ? 'All five statements (tasks as assigned, photo/video, conduct and safety, no liability for injury or belongings, confidentiality).' : 'No'}</Field>
          <Signature row={r} />
        </section>
        <section className="sys-card sys-form">
          <h2>Review {saved && <span className="sys-ok" style={{ margin: 0 }}>{saved}</span>}</h2>
          <StatusChips tab="volunteers" r={r} patch={patch} />
          <EventSelect events={events} value={r.event_id} onChange={(v) => patch({ event_id: v })} label="Market she will serve at" />
          <Notes r={r} patch={patch} />
          <div className="adm-actions">
            <EditRecord value={r} onSave={save} fields={[['first_name', 'First name'], ['last_name', 'Last name'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['emergency_contact', 'Emergency contact']]} />
            <DeleteRecord what={`${name(r)} as a volunteer`} onDelete={remove} onDone={onBack} />
          </div>
          <a className="sys-linkbtn" href={`mailto:${r.email}?subject=${encodeURIComponent('Volunteering at the Proverbs 31 Market')}`}><Mail size={14} /> Email {r.first_name} the assignment and arrival time</a>
          <a className="sys-linkbtn" href="https://www.p31market.com/volunteer" target="_blank" rel="noreferrer"><Globe size={14} /> The form as volunteers see it</a>
        </section>
      </div>
    </div>
  );
};

export default Forms;
