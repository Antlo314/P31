import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Download, ArrowLeft, Mail, Phone, MapPin, Cake, AtSign, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime } from '../../lib/academy';

const STATUSES = [['new', 'New'], ['reviewing', 'Reviewing'], ['approved', 'Approved'], ['waitlist', 'Waitlist'], ['declined', 'Declined'], ['all', 'All']];
const LABEL = Object.fromEntries(STATUSES);

// Systems → Applications: "Join P31 Collective" membership applications from thep31collective.org/join.
const Applications = () => {
  const [apps, setApps] = useState([]);
  const [status, setStatus] = useState('new');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState(0);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('collective_applications').select('*').order('created_at', { ascending: false }).limit(2000);
    if (err) {
      setError(/does not exist|schema cache/.test(err.message) ? 'Run storefront_v27_collective_join.sql in Supabase to turn on applications.' : err.message);
      return;
    }
    setError(''); setApps(data || []);
    setRecent((data || []).filter((a) => Date.now() - new Date(a.created_at) < 30 * 864e5).length);
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const shown = useMemo(() => apps.filter((a) => (status === 'all' || a.status === status)
    && (!q || `${a.full_name} ${a.email} ${a.phone} ${a.business_name || ''} ${a.city_state}`.toLowerCase().includes(q.toLowerCase()))), [apps, status, q]);

  const exportCsv = () => {
    const head = ['Submitted', 'Status', 'Name', 'Business / ministry', 'Email', 'Phone', 'City & state', 'Birthday', 'Socials', 'Found us', 'Business', 'Inspired by', 'Growth areas', 'Interested in', 'Notes'];
    const rows = shown.map((a) => [fmtDate(a.created_at), LABEL[a.status], a.full_name, a.business_name, a.email, a.phone, a.city_state, a.birthday, a.socials,
      a.heard_from, a.business_description, a.inspiration, (a.growth_areas || []).join('; '), (a.interests || []).join('; '), a.notes]);
    const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `p31-collective-applications-${new Date().toISOString().slice(0, 10)}.csv` }).click();
  };

  if (open) return <Application app={open} onBack={() => { setOpen(null); load(); }} />;

  const n = (s) => apps.filter((a) => a.status === s).length;
  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">P31 Collective</p>
        <h1>Applications</h1>
        <p className="sys-muted">Everyone who applied to join the P31 Collective at thep31collective.org/join. Each applicant is also in the CRM.</p>
      </header>
      {error && <p className="sys-error">{error}</p>}

      <div className="sys-stats" style={{ marginBottom: 16 }}>
        <div className="sys-stat"><span className="sys-stat__n">{n('new')}</span><span className="sys-stat__l">New</span></div>
        <div className="sys-stat"><span className="sys-stat__n">{n('reviewing')}</span><span className="sys-stat__l">Reviewing</span></div>
        <div className="sys-stat"><span className="sys-stat__n">{n('approved')}</span><span className="sys-stat__l">Approved</span></div>
        <div className="sys-stat"><span className="sys-stat__n">{recent}</span><span className="sys-stat__l">Applied · 30 days</span></div>
      </div>

      <div className="sys-row sys-row--center" style={{ marginBottom: 12 }}>
        <label className="sys-field sys-grow crm-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone, business or city" aria-label="Search applications" /></label>
        <button className="sys-btn sys-btn--ghost sys-btn--sm" onClick={exportCsv}><Download size={15} /> Export CSV</button>
      </div>
      <div className="sys-chips" role="tablist" style={{ marginBottom: 14 }}>
        {STATUSES.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={status === v} className={`sys-chip ${status === v ? 'is-on' : ''}`} onClick={() => setStatus(v)}>
            {l} <span className="sys-muted">{v === 'all' ? apps.length : n(v)}</span>
          </button>
        ))}
      </div>

      <ul className="sys-list">
        {shown.map((a) => (
          <li key={a.id}>
            <button className="sys-result crm-row" onClick={() => setOpen(a)}>
              <span className="crm-avatar">{a.full_name.charAt(0).toUpperCase()}</span>
              <div className="sys-result__main">
                <h3>{a.full_name}{a.business_name ? ` · ${a.business_name}` : ''}</h3>
                <div className="sys-result__meta"><span>{a.email}</span><span>{a.city_state}</span><span>{(a.growth_areas || []).join(' · ')}</span><span>applied {fmtDate(a.created_at)}</span></div>
              </div>
              <span className={`sys-pill app-status app-status--${a.status}`}>{LABEL[a.status]}</span>
            </button>
          </li>
        ))}
        {!shown.length && !error && <li className="sys-empty">No applications here yet.</li>}
      </ul>
    </div>
  );
};

const Field = ({ label, children }) => (children ? <div className="app-field"><span>{label}</span><p>{children}</p></div> : null);

const Application = ({ app, onBack }) => {
  const [a, setA] = useState(app);
  const [saved, setSaved] = useState('');
  const patch = async (p) => {
    const { data: who } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('collective_applications')
      .update({ ...p, ...(p.status ? { reviewed_by: who?.user?.id || null, reviewed_at: new Date().toISOString() } : {}) })
      .eq('id', a.id).select('*').single();
    if (!error) { setA(data); setSaved('Saved'); setTimeout(() => setSaved(''), 1400); }
  };
  const first = a.full_name.split(' ')[0];
  const nextStep = `mailto:${a.email}?subject=${encodeURIComponent('Your P31 Collective membership')}&body=${encodeURIComponent(`Hi ${first},\n\nThank you for applying to join the P31 Collective. `)}`;

  return (
    <div className="sys-page">
      <button className="sys-linkbtn" onClick={onBack}><ArrowLeft size={15} /> All applications</button>
      <header className="sys-page__head">
        <p className="sys-eyebrow">Application · {LABEL[a.status]}</p>
        <h1>{a.full_name}</h1>
        <div className="sys-result__meta">
          <a href={`mailto:${a.email}`}><Mail size={13} /> {a.email}</a>
          <a href={`tel:${a.phone}`}><Phone size={13} /> {a.phone}</a>
          <span><MapPin size={13} /> {a.city_state}</span>
          <span><Cake size={13} /> {a.birthday}</span>
          {a.socials && <span><AtSign size={13} /> {a.socials}</span>}
          <span>applied {fmtDateTime(a.created_at)}</span>
        </div>
      </header>

      <div className="crm-grid">
        <section className="sys-card">
          <h2>Their answers</h2>
          <Field label="Business or ministry">{a.business_name}</Field>
          <Field label="How they found us">{a.heard_from}</Field>
          <Field label="About their business">{a.business_description}</Field>
          <Field label="What inspired them to join">{a.inspiration}</Field>
          <Field label="Hoping to grow in">{(a.growth_areas || []).join(' · ')}</Field>
          <Field label="Interested in">{(a.interests || []).join(' · ')}</Field>
          <Field label="Agreed to the membership terms">{a.agreed ? 'Yes, including the 18–35 age requirement' : 'No'}</Field>
        </section>

        <section className="sys-card sys-form">
          <h2>Review {saved && <span className="sys-ok" style={{ margin: 0 }}>{saved}</span>}</h2>
          <div className="sys-chips">
            {STATUSES.filter(([v]) => v !== 'all').map(([v, l]) => (
              <button key={v} className={`sys-chip ${a.status === v ? 'is-on' : ''}`} onClick={() => a.status !== v && patch({ status: v })}>
                {a.status === v && <Check size={13} />} {l}
              </button>
            ))}
          </div>
          {a.reviewed_at && <p className="sys-muted" style={{ margin: 0 }}>Last updated {fmtDateTime(a.reviewed_at)}</p>}
          <label className="sys-field"><span>Team notes (private)</span>
            <textarea rows={5} defaultValue={a.notes || ''} onBlur={(e) => e.target.value !== (a.notes || '') && patch({ notes: e.target.value || null })} placeholder="Follow-ups, call notes, next steps…" />
          </label>
          <a className="sys-btn sys-btn--gold" href={nextStep}><Mail size={15} /> Email {first} the next step</a>
          <p className="sys-muted" style={{ margin: 0 }}>Opens your email with their address filled in. Send the membership payment link or welcome details from there.</p>
        </section>
      </div>
    </div>
  );
};

export default Applications;
