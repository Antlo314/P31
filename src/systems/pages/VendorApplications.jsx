import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Download, ArrowLeft, Mail, Phone, AtSign, Check, Store } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime } from '../../lib/academy';

const STATUSES = [['new', 'New'], ['reviewing', 'Reviewing'], ['approved', 'Approved'], ['waitlist', 'Waitlist'], ['declined', 'Declined'], ['all', 'All']];
const LABEL = Object.fromEntries(STATUSES);

// Systems → Vendor applications: the vendor interest form at p31market.com/apply.
const VendorApplications = () => {
  const [apps, setApps] = useState([]);
  const [status, setStatus] = useState('new');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('vendor_applications').select('*').order('created_at', { ascending: false }).limit(2000);
    if (err) {
      setError(/does not exist|schema cache/.test(err.message) ? 'Run storefront_v31_vendor_applications.sql in Supabase to turn on vendor applications.' : err.message);
      return;
    }
    setError(''); setApps(data || []);
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const shown = useMemo(() => apps.filter((a) => (status === 'all' || a.status === status)
    && (!q || `${a.full_name} ${a.business_name} ${a.email} ${a.phone} ${(a.categories || []).join(' ')}`.toLowerCase().includes(q.toLowerCase()))), [apps, status, q]);

  const exportCsv = () => {
    const head = ['Submitted', 'Status', 'Serious', 'Name', 'Business / brand', 'Email', 'Phone', 'Website / social', 'Referred by', 'Categories', 'Anything else', 'Team notes'];
    const rows = shown.map((a) => [fmtDate(a.created_at), LABEL[a.status], a.serious, a.full_name, a.business_name, a.email, a.phone, a.website_social,
      a.referred_by, (a.categories || []).join('; '), a.notes, a.review_notes]);
    const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `p31-vendor-applications-${new Date().toISOString().slice(0, 10)}.csv` }).click();
  };

  if (open) return <VendorApplication app={open} onBack={() => { setOpen(null); load(); }} />;

  const n = (s) => apps.filter((a) => a.status === s).length;
  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Market</p>
        <h1>Vendor applications</h1>
        <p className="sys-muted">Everyone who applied to vend at p31market.com/apply. Each applicant is also in the CRM.</p>
      </header>
      {error && <p className="sys-error">{error}</p>}

      <div className="sys-stats" style={{ marginBottom: 16 }}>
        <div className="sys-stat"><span className="sys-stat__n">{n('new')}</span><span className="sys-stat__l">New</span></div>
        <div className="sys-stat"><span className="sys-stat__n">{n('reviewing')}</span><span className="sys-stat__l">Reviewing</span></div>
        <div className="sys-stat"><span className="sys-stat__n">{n('approved')}</span><span className="sys-stat__l">Approved</span></div>
        <div className="sys-stat"><span className="sys-stat__n">{n('waitlist')}</span><span className="sys-stat__l">Waitlist</span></div>
      </div>

      <div className="sys-row sys-row--center" style={{ marginBottom: 12 }}>
        <label className="sys-field sys-grow crm-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, brand, email, phone or category" aria-label="Search vendor applications" /></label>
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
              <span className="crm-avatar">{(a.business_name || a.full_name).charAt(0).toUpperCase()}</span>
              <div className="sys-result__main">
                <h3>{a.business_name} · {a.full_name}</h3>
                <div className="sys-result__meta"><span>{a.email}</span><span>{(a.categories || []).join(' · ')}</span><span>applied {fmtDate(a.created_at)}</span></div>
              </div>
              <span className={`sys-pill app-status app-status--${a.status}`}>{LABEL[a.status]}</span>
            </button>
          </li>
        ))}
        {!shown.length && !error && <li className="sys-empty">No vendor applications here yet.</li>}
      </ul>
    </div>
  );
};

const Field = ({ label, children }) => (children ? <div className="app-field"><span>{label}</span><p>{children}</p></div> : null);

const VendorApplication = ({ app, onBack }) => {
  const [a, setA] = useState(app);
  const [saved, setSaved] = useState('');
  const patch = async (p) => {
    const { data: who } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('vendor_applications')
      .update({ ...p, ...(p.status ? { reviewed_by: who?.user?.id || null, reviewed_at: new Date().toISOString() } : {}) })
      .eq('id', a.id).select('*').single();
    if (!error) { setA(data); setSaved('Saved'); setTimeout(() => setSaved(''), 1400); }
  };
  const first = a.full_name.split(' ')[0];
  const nextStep = `mailto:${a.email}?subject=${encodeURIComponent('Your Proverbs 31 Market vendor application')}&body=${encodeURIComponent(`Hi ${first},\n\nThank you for applying to vend at the Proverbs 31 Market with ${a.business_name}. `)}`;

  return (
    <div className="sys-page">
      <button className="sys-linkbtn" onClick={onBack}><ArrowLeft size={15} /> All vendor applications</button>
      <header className="sys-page__head">
        <p className="sys-eyebrow">Vendor application · {LABEL[a.status]}</p>
        <h1>{a.business_name}</h1>
        <div className="sys-result__meta">
          <span><Store size={13} /> {a.full_name}</span>
          <a href={`mailto:${a.email}`}><Mail size={13} /> {a.email}</a>
          <a href={`tel:${a.phone}`}><Phone size={13} /> {a.phone}</a>
          <span><AtSign size={13} /> {a.website_social}</span>
          <span>applied {fmtDateTime(a.created_at)}</span>
        </div>
      </header>

      <div className="crm-grid">
        <section className="sys-card">
          <h2>Their answers</h2>
          <Field label="Serious about joining and participating">{a.serious}</Field>
          <Field label="What they sell or offer">{(a.categories || []).join(' · ')}</Field>
          <Field label="Website / social media">{a.website_social}</Field>
          <Field label="Referred by">{a.referred_by}</Field>
          <Field label="Anything else">{a.notes}</Field>
          <Field label="Agreed to the vendor terms">{a.agreed ? 'Yes' : 'No'}</Field>
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
            <textarea rows={5} defaultValue={a.review_notes || ''} onBlur={(e) => e.target.value !== (a.review_notes || '') && patch({ review_notes: e.target.value || null })} placeholder="Booth size, follow-ups, payment…" />
          </label>
          <a className="sys-btn sys-btn--gold" href={nextStep}><Mail size={15} /> Email {first}</a>
          <p className="sys-muted" style={{ margin: 0 }}>Opens your email with their address filled in. Send acceptance and event details from there.</p>
        </section>
      </div>
    </div>
  );
};

export default VendorApplications;
