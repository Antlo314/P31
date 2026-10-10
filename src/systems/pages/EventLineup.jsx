import React, { useEffect, useState } from 'react';
import { Store, Plus, Check, UserCheck, X, Eye, EyeOff, Download, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const STATUS = [['invited', 'Invited'], ['confirmed', 'Confirmed'], ['paid', 'Paid'], ['checked_in', 'Checked in'], ['no_show', 'No-show'], ['cancelled', 'Cancelled']];
const LABEL = Object.fromEntries(STATUS);

/**
 * The vendor lineup for one market: invite approved applicants, set booths, track confirmed /
 * paid / checked-in on the day, and publish the lineup on Market dates.
 */
const EventLineup = ({ event, onEventChanged }) => {
  const [rows, setRows] = useState([]);
  const [apps, setApps] = useState([]);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [{ data: v, error: err }, { data: a }] = await Promise.all([
      supabase.from('event_vendors').select('*').eq('event_id', event.id).order('booth', { nullsFirst: false }).order('business_name'),
      supabase.from('vendor_applications').select('id, full_name, business_name, email, categories, status').in('status', ['approved', 'reviewing', 'new']).order('created_at', { ascending: false }).limit(500),
    ]);
    if (err) { setError(/does not exist|schema cache/.test(err.message) ? 'Run storefront_v33_content_and_vendors.sql to turn on lineups.' : err.message); return; }
    setRows(v || []); setApps(a || []);
  };
  useEffect(() => { Promise.resolve().then(load); }, [event.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const inLineup = new Set(rows.map((r) => r.application_id).filter(Boolean));
  const invite = async (app) => {
    const { error: err } = await supabase.rpc('lineup_add_application', { p_event: event.id, p_application: app.id });
    if (err) setError(err.message); else load();
  };
  const patch = async (r, p) => {
    setRows((list) => list.map((x) => (x.id === r.id ? { ...x, ...p } : x)));
    const { error: err } = await supabase.from('event_vendors').update(p).eq('id', r.id);
    if (err) { setError(err.message); load(); }
  };
  const remove = async (r) => { await supabase.from('event_vendors').delete().eq('id', r.id); load(); };
  const exportCsv = () => {
    const head = ['Booth', 'Business', 'Contact', 'Email', 'Website / social', 'Categories', 'Status', 'Notes'];
    const csv = [head, ...rows.map((r) => [r.booth, r.business_name, r.contact_name, r.email, r.website_social, (r.categories || []).join('; '), LABEL[r.status], r.notes])]
      .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `${event.title.toLowerCase().replace(/\W+/g, '-')}-lineup.csv` }).click();
  };

  const n = (s) => rows.filter((r) => r.status === s).length;
  const candidates = apps.filter((a) => !inLineup.has(a.id) && (!q || `${a.business_name} ${a.full_name} ${(a.categories || []).join(' ')}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="lu">
      {error && <p className="sys-error">{error}</p>}
      <div className="lu-head">
        <strong><Store size={15} /> Lineup · {rows.length} vendor{rows.length === 1 ? '' : 's'}</strong>
        <span className="sys-muted">{n('confirmed') + n('paid') + n('checked_in')} confirmed · {n('paid') + n('checked_in')} paid · {n('checked_in')} checked in</span>
        <div className="lu-actions">
          <button className={`sys-chip ${event.lineup_public ? 'is-on' : ''}`} onClick={() => onEventChanged({ lineup_public: !event.lineup_public })}>
            {event.lineup_public ? <Eye size={13} /> : <EyeOff size={13} />} {event.lineup_public ? 'Lineup is public' : 'Lineup hidden'}
          </button>
          <button className="sys-btn sys-btn--ghost sys-btn--sm" onClick={exportCsv} disabled={!rows.length}><Download size={14} /> CSV</button>
          <button className="sys-btn sys-btn--gold sys-btn--sm" onClick={() => setAdding(!adding)}><Plus size={14} /> Add vendors</button>
        </div>
      </div>

      {adding && (
        <div className="lu-add">
          <label className="sys-field sys-grow crm-search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search approved applications" /></label>
          <ul className="sys-list lu-cands">
            {candidates.slice(0, 30).map((a) => (
              <li key={a.id}><span><b>{a.business_name}</b> · {a.full_name} <small className="sys-muted">{(a.categories || []).join(', ')} · {a.status}</small></span>
                <button className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => invite(a)}><Plus size={13} /> Invite</button></li>
            ))}
            {!candidates.length && <li className="sys-muted">No applications to add. Approve some under Market → Vendor applications.</li>}
          </ul>
        </div>
      )}

      <ul className="sys-list lu-list">
        {rows.map((r) => (
          <li key={r.id} className={`lu-row lu-row--${r.status}`}>
            <input className="lu-booth" value={r.booth || ''} placeholder="Booth" aria-label="Booth" onChange={(e) => setRows((list) => list.map((x) => (x.id === r.id ? { ...x, booth: e.target.value } : x)))} onBlur={(e) => patch(r, { booth: e.target.value || null })} />
            <div className="lu-who"><strong>{r.business_name}</strong><small>{[r.contact_name, r.email, (r.categories || []).join(', ')].filter(Boolean).join(' · ')}</small></div>
            <select value={r.status} onChange={(e) => patch(r, { status: e.target.value, ...(e.target.value === 'checked_in' ? { checked_in_at: new Date().toISOString() } : {}) })} aria-label="Status">
              {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {r.status !== 'checked_in' && ['confirmed', 'paid'].includes(r.status) && <button className="sys-btn sys-btn--gold sys-btn--sm" onClick={() => patch(r, { status: 'checked_in', checked_in_at: new Date().toISOString() })}><UserCheck size={14} /> Check in</button>}
            {r.status === 'checked_in' && <span className="sys-ok"><Check size={14} /> In</span>}
            <button className={`sys-chip ${r.is_public ? 'is-on' : ''}`} onClick={() => patch(r, { is_public: !r.is_public })} title="Show on the public lineup">{r.is_public ? <Eye size={12} /> : <EyeOff size={12} />}</button>
            <button className="sys-icon-btn" onClick={() => remove(r)} aria-label="Remove from lineup"><X size={14} /></button>
          </li>
        ))}
        {!rows.length && <li className="sys-muted">No vendors in this lineup yet.</li>}
      </ul>
    </div>
  );
};

export default EventLineup;
