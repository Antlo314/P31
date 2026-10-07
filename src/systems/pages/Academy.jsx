import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Users, Clapperboard, PhoneCall, Trash2, Plus, Check, ExternalLink, DollarSign, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { money, BILLING, fmtDate } from '../../lib/academy';

const PROGRAMS = [['business', 'Business Mentorship'], ['faith', 'Faith-Based Mentorship']];
const ORDER = ['month', 'week', 'six_months', 'one_time'];

// Systems → Academy: prices (private), mentors, Content Studio seats,
// members and every intro-call request.
const Academy = () => {
  const [tab, setTab] = useState('plans');
  const [programs, setPrograms] = useState([]);
  const [plans, setPlans] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [seats, setSeats] = useState([]);
  const [rosters, setRosters] = useState({});
  const [calls, setCalls] = useState([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [p, pl, m, s, c] = await Promise.all([
      supabase.from('academy_programs').select('*').order('sort_order'),
      supabase.from('academy_plans').select('*'),
      supabase.from('academy_mentors').select('*'),
      supabase.from('studio_members').select('*').order('created_at'),
      supabase.from('academy_inquiries').select('*').order('created_at', { ascending: false }).limit(300),
    ]);
    if (p.error) { setError(p.error.message.includes('does not exist') ? 'Run storefront_v20_academy_and_studio.sql in Supabase to turn on the Academy.' : p.error.message); return; }
    setPrograms(p.data || []); setPlans(pl.data || []); setMentors(m.data || []); setSeats(s.data || []); setCalls(c.data || []);
    const entries = await Promise.all((p.data || []).map(async (prog) => [prog.id, (await supabase.rpc('academy_roster', { p_program: prog.id })).data || []]));
    setRosters(Object.fromEntries(entries));
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const done = (text) => { setMsg(text); setError(''); load(); };
  const fail = (e) => setError(e?.message || String(e));
  const rpc = async (fn, args) => {
    const { data, error: err } = await supabase.rpc(fn, args);
    if (err) return fail(err);
    done(typeof data === 'string' ? data : 'Saved.');
  };

  const savePlan = async (plan, form) => {
    const cents = form.price === '' ? null : Math.round(Number(form.price) * 100);
    if (cents !== null && (Number.isNaN(cents) || cents < 50)) return fail('Enter a price of at least $0.50, or leave it blank to hide the plan.');
    const { error: err } = await supabase.from('academy_plans').update({
      price_cents: cents, is_active: form.active, access_days: plan.billing === 'one_time' ? Number(form.days) || 30 : null, updated_at: new Date().toISOString(),
    }).eq('id', plan.id);
    if (err) fail(err); else done(`${plan.label} saved.`);
  };

  const progName = (id) => programs.find((p) => p.id === id)?.title || 'Not sure yet';

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Academy</p>
        <h1>Mentorships & Studio</h1>
        <p className="sys-muted">Prices stay private: they’re shown only on the personal enrollment link a mentor sends after an intro call.</p>
      </header>
      {msg && <p className="sys-ok"><Check size={16} /> {msg}</p>}
      {error && <p className="sys-error">{error}</p>}

      <div className="sys-chips" role="tablist" style={{ marginBottom: 16 }}>
        {[{ v: 'plans', l: 'Plans & prices', Icon: DollarSign }, { v: 'mentors', l: 'Mentors', Icon: GraduationCap }, { v: 'members', l: 'Members', Icon: Users },
          { v: 'studio', l: 'Studio seats', Icon: Clapperboard }, { v: 'calls', l: 'Intro calls', Icon: PhoneCall }].map((t) => (
          <button key={t.v} role="tab" aria-selected={tab === t.v} className={`sys-chip ${tab === t.v ? 'is-on' : ''}`} onClick={() => setTab(t.v)}><t.Icon size={14} /> {t.l}</button>
        ))}
      </div>

      {tab === 'plans' && programs.map((prog) => (
        <section key={prog.id} className="sys-card sys-form" style={{ marginBottom: 14 }}>
          <h2>{prog.title}</h2>
          {plans.filter((pl) => pl.program_id === prog.id).sort((a, b) => ORDER.indexOf(a.billing) - ORDER.indexOf(b.billing)).map((pl) => <PlanRow key={pl.id} plan={pl} onSave={savePlan} />)}
          <p className="sys-muted">A plan with no price is hidden from mentors’ invite options.</p>
        </section>
      ))}

      {tab === 'mentors' && (
        <>
          <AddByEmail label="Add a mentor" withProgram withTitle onAdd={({ email, program, title }) => rpc('add_academy_mentor', { p_email: email, p_program: program, p_title: title || null })} />
          {programs.map((prog) => (
            <section key={prog.id} className="sys-card" style={{ marginTop: 14 }}>
              <h2>{prog.title}</h2>
              <ul className="sys-list">
                {mentors.filter((m) => m.program_id === prog.id).map((m) => (
                  <li key={m.user_id} className="sys-result">
                    <div className="sys-result__main"><h3>{m.display_name}</h3><div className="sys-result__meta"><span>{m.title || 'Mentor'}</span><span>since {fmtDate(m.created_at)}</span></div></div>
                    <button className="sys-icon-btn" onClick={() => window.confirm('Remove this mentor?') && rpc('remove_academy_mentor', { p_user: m.user_id, p_program: prog.slug })} aria-label="Remove mentor"><Trash2 size={16} /></button>
                  </li>
                ))}
                {!mentors.some((m) => m.program_id === prog.id) && <li className="sys-muted">No mentors yet.</li>}
              </ul>
              <Link to={`/academy/${prog.slug}/teach`} className="sys-linkbtn">Open the mentor console <ExternalLink size={13} /></Link>
            </section>
          ))}
        </>
      )}

      {tab === 'members' && (
        <>
          <ManualEnroll onEnroll={(f) => rpc('academy_enroll_manual', { p_email: f.email, p_program: f.program, p_days: f.days ? Number(f.days) : null, p_source: f.source })} />
          {programs.map((prog) => (
            <section key={prog.id} className="sys-card" style={{ marginTop: 14 }}>
              <h2>{prog.title} <span className="sys-muted">· {(rosters[prog.id] || []).filter((r) => r.status === 'active').length} active</span></h2>
              <ul className="sys-list">
                {(rosters[prog.id] || []).map((r) => (
                  <li key={r.user_id} className="sys-result">
                    <div className="sys-result__main">
                      <h3>{r.full_name}</h3>
                      <div className="sys-result__meta"><span>{r.email}</span><span>{r.plan_label || r.source}</span><span>{r.status}</span><span>{r.access_until ? `to ${fmtDate(r.access_until)}` : 'open-ended'}</span></div>
                    </div>
                    {r.status !== 'expired' && <EndButton userId={r.user_id} programId={prog.id} onDone={done} onFail={fail} />}
                  </li>
                ))}
                {!(rosters[prog.id] || []).length && <li className="sys-muted">No members yet.</li>}
              </ul>
            </section>
          ))}
        </>
      )}

      {tab === 'studio' && (
        <>
          <AddByEmail label={`Give a Content Studio seat (${seats.length}/3 used)`} withName disabled={seats.length >= 3} onAdd={({ email, name }) => rpc('add_studio_member', { p_email: email, p_display_name: name || null })} />
          <section className="sys-card" style={{ marginTop: 14 }}>
            <ul className="sys-list">
              {seats.map((s) => (
                <li key={s.user_id} className="sys-result">
                  <div className="sys-result__main"><h3>{s.display_name}</h3><div className="sys-result__meta"><span>since {fmtDate(s.created_at)}</span></div></div>
                  <button className="sys-icon-btn" onClick={() => window.confirm('Remove this Studio seat?') && rpc('remove_studio_member', { p_user: s.user_id })} aria-label="Remove seat"><Trash2 size={16} /></button>
                </li>
              ))}
              {!seats.length && <li className="sys-muted">No seats given yet. Studio members sign in at /portal.</li>}
            </ul>
          </section>
        </>
      )}

      {tab === 'calls' && (
        <section className="sys-results">
          {calls.map((c) => (
            <article key={c.id} className="sys-result">
              <div className="sys-result__main">
                <span className="sys-pill">{c.status.replace('_', ' ')}</span>
                <h3>{c.full_name} · {progName(c.program_id)}</h3>
                <div className="sys-result__meta"><a href={`mailto:${c.email}`}>{c.email}</a>{c.phone && <span>{c.phone}</span>}<span>{fmtDate(c.created_at)}</span>{c.preferred_times && <span>{c.preferred_times}</span>}</div>
                {c.message && <p className="sys-muted" style={{ whiteSpace: 'pre-wrap' }}>{c.message}</p>}
              </div>
              {c.program_id && <Link className="sys-linkbtn" to={`/academy/${programs.find((p) => p.id === c.program_id)?.slug}/teach/calls`}>Open <ExternalLink size={13} /></Link>}
            </article>
          ))}
          {!calls.length && <p className="sys-muted">No intro-call requests yet. They come from /mentorship.</p>}
        </section>
      )}
    </div>
  );
};

const PlanRow = ({ plan, onSave }) => {
  const [form, setForm] = useState({ price: plan.price_cents ? (plan.price_cents / 100).toString() : '', active: plan.is_active, days: plan.access_days || 30 });
  return (
    <div className="sys-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
      <label className="sys-field" style={{ minWidth: 150 }}><span>{plan.label}{BILLING[plan.billing]?.per ? ` (per ${BILLING[plan.billing].per})` : ''}</span>
        <input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d.]/g, '') })} placeholder="Not offered" />
      </label>
      {plan.billing === 'one_time' && (
        <label className="sys-field" style={{ width: 130 }}><span>Days of access</span><input type="number" min="1" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></label>
      )}
      <label className="sys-chip" style={{ cursor: 'pointer' }}><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Available</label>
      <span className="sys-muted">Now: {plan.price_cents ? money(plan.price_cents) : 'not priced'}</span>
      <button className="sys-btn sys-btn--gold sys-btn--sm" onClick={() => onSave(plan, form)}>Save</button>
    </div>
  );
};

const AddByEmail = ({ label, withProgram, withTitle, withName, disabled, onAdd }) => {
  const [f, setF] = useState({ email: '', program: 'business', title: '', name: '' });
  return (
    <form className="sys-card sys-form" onSubmit={(e) => { e.preventDefault(); onAdd(f); setF({ ...f, email: '', title: '', name: '' }); }}>
      <h2><UserPlus size={18} /> {label}</h2>
      <p className="sys-muted">They need an account first — they can create one at /portal or from an enrollment link.</p>
      <div className="sys-row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <label className="sys-field" style={{ flex: '1 1 220px' }}><span>Their account email</span><input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        {withProgram && <label className="sys-field"><span>Program</span><select value={f.program} onChange={(e) => setF({ ...f, program: e.target.value })}>{PROGRAMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
        {withTitle && <label className="sys-field"><span>Title (optional)</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Lead mentor" /></label>}
        {withName && <label className="sys-field"><span>Display name (optional)</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>}
        <button className="sys-btn sys-btn--gold" disabled={disabled}><Plus size={16} /> Add</button>
      </div>
    </form>
  );
};

const ManualEnroll = ({ onEnroll }) => {
  const [f, setF] = useState({ email: '', program: 'business', days: '30', source: 'manual' });
  return (
    <form className="sys-card sys-form" onSubmit={(e) => { e.preventDefault(); onEnroll(f); setF({ ...f, email: '' }); }}>
      <h2><UserPlus size={18} /> Enroll someone manually</h2>
      <p className="sys-muted">For someone who paid another way, or a complimentary seat. Card payments enroll people automatically.</p>
      <div className="sys-row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <label className="sys-field" style={{ flex: '1 1 220px' }}><span>Their account email</span><input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="sys-field"><span>Program</span><select value={f.program} onChange={(e) => setF({ ...f, program: e.target.value })}>{PROGRAMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="sys-field" style={{ width: 130 }}><span>Days (blank = open)</span><input type="number" min="1" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></label>
        <label className="sys-field"><span>Type</span><select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}><option value="manual">Paid another way</option><option value="comp">Complimentary</option></select></label>
        <button className="sys-btn sys-btn--gold"><Plus size={16} /> Enroll</button>
      </div>
    </form>
  );
};

const EndButton = ({ userId, programId, onDone, onFail }) => {
  const end = async () => {
    if (!window.confirm('End this member’s access now?')) return;
    const { data: row } = await supabase.from('academy_enrollments').select('id').eq('user_id', userId).eq('program_id', programId).maybeSingle();
    if (!row) return onFail('Enrollment not found.');
    const { error } = await supabase.rpc('academy_end_enrollment', { p_enrollment: row.id });
    if (error) onFail(error); else onDone('Access ended.');
  };
  return <button className="sys-btn sys-btn--ghost sys-btn--sm" onClick={end}>End access</button>;
};

export default Academy;
