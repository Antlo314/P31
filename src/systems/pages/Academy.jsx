import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, Users, Clapperboard, PhoneCall, Trash2, Plus, Check, ExternalLink, DollarSign, UserPlus, BookOpen, CalendarDays } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { money, BILLING, fmtDate } from '../../lib/academy';
import { installCallTracking } from '../../academy/app/live';
import { AcademyContext } from '../../academy/app/data';
import { MentorCurriculum, MentorSessions } from '../../academy/app/mentor';
import '../../academy/app/classroom.css';

const ORDER = ['month', 'week', 'six_months', 'one_time'];
const TABS = [
  { v: 'plans', l: 'Plans & prices', Icon: DollarSign }, { v: 'curriculum', l: 'Curriculum & videos', Icon: BookOpen }, { v: 'sessions', l: 'Sessions & recordings', Icon: CalendarDays },
  { v: 'mentors', l: 'Mentors', Icon: GraduationCap }, { v: 'members', l: 'Members', Icon: Users },
  { v: 'studio', l: 'Studio seats', Icon: Clapperboard }, { v: 'calls', l: 'Intro calls', Icon: PhoneCall },
];

// Systems → Mentorship: prices (private), each program's curriculum, videos and sessions,
// mentors, Content Studio seats, members and every intro-call request.
const Academy = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'plans');
  const [programs, setPrograms] = useState([]);
  const [plans, setPlans] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [seats, setSeats] = useState([]);
  const [rosters, setRosters] = useState({});
  const [calls, setCalls] = useState([]);
  const [progId, setProgId] = useState('');
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
    setProgId((id) => id || p.data?.[0]?.id || '');
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
      // A plan with a Stripe Payment Link takes its price from Stripe (v55); only availability changes here.
      // Days of access are edited here only for pay-as-you-go; other plans keep theirs (6-month plans keep a 183-day fallback).
      ...(plan.stripe_payment_link ? {} : { price_cents: cents }), is_active: form.active, access_days: plan.billing === 'one_time' ? Number(form.days) || 30 : plan.access_days ?? null, updated_at: new Date().toISOString(),
    }).eq('id', plan.id);
    if (err) fail(err); else done(`${plan.label} saved.`);
  };

  // v62: copy one plan's price and billing from its Stripe Payment Link now (admin-only action of academy-checkout).
  const syncPlanNow = async (plan) => {
    setMsg(''); setError('');
    const { data, error: err } = await supabase.functions.invoke('academy-checkout', { body: { action: 'syncPlan', planId: plan.id } });
    let m = data?.error;
    if (err) { try { m = (await err.context?.json?.())?.error || err.message; } catch { m = err.message; } }
    if (data?.ok) {
      done(`${plan.label}: ${money(data.price_cents)} ${BILLING[data.billing]?.label?.toLowerCase() || data.billing}, copied from Stripe${data.changed ? ' (the price changed)' : ''}.`);
      return true;
    }
    fail(m || 'The Stripe sync did not answer. Try again in a minute.'); load();
    return false;
  };

  const planUse = async (plan) => {
    const count = async (table) => {
      const { count: n, error: err } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq('plan_id', plan.id);
      return err ? 0 : n || 0;
    };
    const [enrollments, invites, intakes] = await Promise.all([count('academy_enrollments'), count('academy_invites'), count('coaching_intakes')]);
    return { enrollments, invites, intakes, total: enrollments + invites + intakes };
  };

  const deletePlan = async (plan) => {
    const use = await planUse(plan);
    if (use.total > 0) {
      const used = `${plan.label} is used by ${use.enrollments} enrollment(s), ${use.invites} invite(s) and ${use.intakes} coaching intake(s), so it can’t be deleted.`;
      if (!plan.is_active) return fail(`${used} It is already unavailable.`);
      if (!window.confirm(`${used}\n\nMark it unavailable instead? Mentors stop seeing it; existing members keep their access.`)) return;
      const { error: err } = await supabase.from('academy_plans').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', plan.id);
      return err ? fail(err) : done(`${plan.label} is now unavailable.`);
    }
    if (!window.confirm(`Delete ${plan.label}? It has never been used. This can’t be undone.`)) return;
    const { data, error: err } = await supabase.from('academy_plans').delete().eq('id', plan.id).select('id');
    if (err) return fail(err);
    if (!data?.length) return fail('Nothing was deleted. Run storefront_v62_plans_admin.sql in Supabase so admins can delete plans.');
    done(`${plan.label} deleted.`);
  };

  const editPlan = async (plan, f) => {
    const invalid = planProblem(f, plans, plan.id);
    if (invalid) { fail(invalid); return false; }
    const link = cleanLink(f.link);
    const linkChanged = link !== (plan.stripe_payment_link || '');
    const { error: err } = await supabase.from('academy_plans').update({
      label: f.label.trim(), package: f.package.trim() || null, billing: f.billing, stripe_payment_link: link || null,
      access_days: f.days === '' ? null : Number(f.days), is_active: f.active, updated_at: new Date().toISOString(),
      ...(linkChanged ? { stripe_price_id: null, price_synced_at: null } : {}),
    }).eq('id', plan.id);
    if (err) { fail(err.code === '23505' ? 'That package key is already used by another plan.' : err); return false; }
    if (linkChanged && link) await syncPlanNow({ ...plan, label: f.label.trim() });
    else done(`${f.label.trim()} saved.`);
    return true;
  };

  const addPlan = async (f) => {
    const invalid = planProblem(f, plans, null, true);
    if (invalid) { fail(invalid); return false; }
    if (!f.program) { fail('Choose a program.'); return false; }
    const link = cleanLink(f.link);
    const { data, error: err } = await supabase.from('academy_plans').insert({
      program_id: f.program, label: f.label.trim(), package: f.package.trim(), billing: f.billing, price_cents: null,
      access_days: f.days === '' ? null : Number(f.days), is_active: f.active, stripe_payment_link: link || null,
    }).select('*').single();
    if (err) {
      fail(/row-level security/i.test(err.message) ? 'Run storefront_v62_plans_admin.sql in Supabase so admins can add plans.'
        : err.code === '23505' ? 'A plan with that package key (or the same program, billing and package) already exists.' : err);
      return false;
    }
    if (link) await syncPlanNow(data);
    else done(`${data.label} added. It has no price yet: set one in its row (or paste a Payment Link) before mentors can offer it.`);
    return true;
  };

  const addProgram = async (f) => {
    const slug = f.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) { fail('The slug may use only lowercase letters, numbers and hyphens (e.g. marriage-mentorship).'); return false; }
    if (!f.title.trim()) { fail('Give the program a title.'); return false; }
    const { error: err } = await supabase.from('academy_programs').insert({ slug, title: f.title.trim(), sort_order: Number(f.sort) || 0, is_active: false });
    if (err) { fail(err.code === '23505' ? `A program with the slug “${slug}” already exists.` : err); return false; }
    done(`${f.title.trim()} added (hidden). Write its public page text, then Show it.`);
    return true;
  };

  const saveProgram = async (p, patch, text) => {
    const { error: err } = await supabase.from('academy_programs').update(patch).eq('id', p.id);
    if (err) fail(err); else done(text);
  };

  const progName = (id) => programs.find((p) => p.id === id)?.title || 'Not sure yet';
  const prog = programs.find((p) => p.id === progId) || null;
  const editing = tab === 'curriculum' || tab === 'sessions';

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Collective</p>
        <h1>Mentorship</h1>
        <p className="sys-muted">Prices stay private: they’re shown only on the personal enrollment link a mentor sends after an intro call. Curriculum, lesson videos and sessions are edited here or from each mentor console.</p>
      </header>
      <section className="sys-card" style={{ marginBottom: 14 }}>
        <h2>Live classes</h2>
        <p className="sys-muted">Mentors start live calls from their console (“Go live now”). Turn on call tracking once so every call’s joins, minutes and recordings are saved.</p>
        <button className="sys-btn sys-btn--gold sys-btn--sm" onClick={async () => { const r = await installCallTracking(); if (r?.error) setError(r.error); else { setMsg('Call tracking is on — every live class is now saved.'); setError(''); } }}>Turn on call tracking</button>
      </section>
      {msg && <p className="sys-ok"><Check size={16} /> {msg}</p>}
      {error && <p className="sys-error">{error}</p>}

      <div className="sys-chips" role="tablist" style={{ marginBottom: 16 }} data-tour="academy-tabs">
        {TABS.map((t) => (
          <button key={t.v} role="tab" aria-selected={tab === t.v} className={`sys-chip ${tab === t.v ? 'is-on' : ''}`} onClick={() => setTab(t.v)} data-tour={`tab-${t.v}`}><t.Icon size={14} /> {t.l}</button>
        ))}
      </div>

      {tab === 'plans' && (
        <>
          <ProgramsCard programs={programs} onAdd={addProgram} onSave={saveProgram} />
          <AddPlan programs={programs} onAdd={addPlan} />
        </>
      )}
      {tab === 'plans' && programs.map((p) => (
        <section key={p.id} className="sys-card sys-form" style={{ marginBottom: 14 }}>
          <h2>{p.title}{p.is_active === false && <span className="sys-muted"> · hidden</span>}</h2>
          {plans.filter((pl) => pl.program_id === p.id).sort((a, b) => ORDER.indexOf(a.billing) - ORDER.indexOf(b.billing) || (a.price_cents ?? 0) - (b.price_cents ?? 0)).map((pl) => (
            <PlanRow key={`${pl.id}-${pl.updated_at}`} plan={pl} onSave={savePlan} onEdit={editPlan} onDelete={deletePlan} onSync={syncPlanNow} />
          ))}
          {!plans.some((pl) => pl.program_id === p.id) && <p className="sys-muted">No plans yet. Use “Add a plan” above.</p>}
          <p className="sys-muted">A plan with no price is hidden from mentors’ invite options.</p>
        </section>
      ))}

      {editing && (
        <>
          <div className="sys-chips" role="tablist" aria-label="Program" data-tour="academy-program">
            {programs.map((p) => <button key={p.id} role="tab" aria-selected={progId === p.id} className={`sys-chip ${progId === p.id ? 'is-on' : ''}`} onClick={() => setProgId(p.id)}>{p.title}</button>)}
          </div>
          {prog ? (
            <AcademyContext.Provider value={{ program: prog, isMentor: true, isAdmin: true, preview: false, viewAs: false, user }}>
              <div className="ds sys-embed" data-tour="academy-editor">
                {tab === 'curriculum' ? <MentorCurriculum key={prog.id} /> : <MentorSessions key={prog.id} />}
              </div>
            </AcademyContext.Provider>
          ) : <p className="sys-muted">No programs yet.</p>}
          <p className="sys-muted" style={{ marginTop: 10 }}>Students see published modules and lessons in their classroom at once. Mentors can edit the same curriculum from their console.</p>
        </>
      )}

      {tab === 'mentors' && (
        <>
          <AddByEmail label="Add a mentor" programs={programs} withProgram withTitle onAdd={({ email, program, title }) => rpc('add_academy_mentor', { p_email: email, p_program: program, p_title: title || null })} />
          <p className="sys-muted" style={{ marginTop: 10 }}>A team member with the Classroom dashboard (Systems → Team & dashboards) is a mentor of every program without being listed here.</p>
          {programs.map((p) => (
            <section key={p.id} className="sys-card" style={{ marginTop: 14 }}>
              <h2>{p.title}</h2>
              <ul className="sys-list">
                {mentors.filter((m) => m.program_id === p.id).map((m) => (
                  <li key={m.user_id} className="sys-result">
                    <div className="sys-result__main"><h3>{m.display_name}</h3><div className="sys-result__meta"><span>{m.title || 'Mentor'}</span><span>since {fmtDate(m.created_at)}</span></div></div>
                    <button className="sys-icon-btn" onClick={() => window.confirm('Remove this mentor?') && rpc('remove_academy_mentor', { p_user: m.user_id, p_program: p.slug })} aria-label="Remove mentor"><Trash2 size={16} /></button>
                  </li>
                ))}
                {!mentors.some((m) => m.program_id === p.id) && <li className="sys-muted">No mentors yet.</li>}
              </ul>
              <Link to={`/academy/${p.slug}/teach`} className="sys-linkbtn">Open the mentor console <ExternalLink size={13} /></Link>
            </section>
          ))}
        </>
      )}

      {tab === 'members' && (
        <>
          <ManualEnroll programs={programs} onEnroll={(f) => rpc('academy_enroll_manual', { p_email: f.email, p_program: f.program, p_days: f.days ? Number(f.days) : null, p_source: f.source })} />
          {programs.map((p) => (
            <section key={p.id} className="sys-card" style={{ marginTop: 14 }}>
              <h2>{p.title} <span className="sys-muted">· {(rosters[p.id] || []).filter((r) => r.status === 'active').length} active</span></h2>
              <ul className="sys-list">
                {(rosters[p.id] || []).map((r) => (
                  <li key={r.user_id} className="sys-result">
                    <div className="sys-result__main">
                      <h3>{r.full_name}</h3>
                      <div className="sys-result__meta"><span>{r.email}</span><span>{r.plan_label || r.source}</span><span>{r.status}</span><span>{r.access_until ? `to ${fmtDate(r.access_until)}` : 'open-ended'}</span></div>
                    </div>
                    {r.status !== 'expired' && <EndButton userId={r.user_id} programId={p.id} onDone={done} onFail={fail} />}
                  </li>
                ))}
                {!(rosters[p.id] || []).length && <li className="sys-muted">No members yet.</li>}
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
              {!seats.length && <li className="sys-muted">No seats given yet. Studio members sign in at /portal. The Content creator dashboard (Team & dashboards) opens the Studio too.</li>}
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

// v62: plans and programs are managed here without SQL. A Payment Link must be one of Melanie's
// Stripe links (https://buy.stripe.com/...); its price and billing are copied by the academy-checkout sync.
const LINK_RE = /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+$/;
const cleanLink = (s) => String(s || '').trim().replace(/[?#].*$/, '').replace(/\/+$/, '');
function planProblem(f, plans, selfId, isNew = false) {
  if (!f.label.trim()) return 'Give the plan a label (what members and mentors see).';
  const pkg = f.package.trim();
  if (isNew && !pkg) return 'Give the plan a package key (e.g. Option 5 or Faith 5 6M). The coaching forms look plans up by it.';
  if (pkg.length > 20) return 'The package key can be at most 20 characters.';
  if (pkg && plans.some((p) => p.id !== selfId && (p.package || '').toLowerCase() === pkg.toLowerCase())) return `The package key “${pkg}” is already used by another plan.`;
  if (!BILLING[f.billing]) return 'Choose how the plan is billed.';
  if (f.days !== '' && !(Number.isInteger(Number(f.days)) && Number(f.days) > 0)) return 'Days of access must be a whole number above 0, or blank.';
  if (f.billing === 'one_time' && f.days === '') return 'A pay-as-you-go plan needs days of access.';
  const link = cleanLink(f.link);
  if (link && !LINK_RE.test(link)) return 'The Payment Link must look like https://buy.stripe.com/… (copy it from Stripe → Payment Links).';
  return '';
}
const planForm = (plan) => ({
  label: plan?.label || '', package: plan?.package || '', billing: plan?.billing || 'month', link: plan?.stripe_payment_link || '',
  days: plan?.access_days != null ? String(plan.access_days) : '', active: plan ? plan.is_active : true,
});

const PlanFields = ({ f, setF }) => (
  <div className="sys-row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
    <label className="sys-field" style={{ flex: '2 1 260px' }}><span>Label</span><input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder="Coaching Option 5: …" /></label>
    <label className="sys-field" style={{ width: 170 }}><span>Package key ({f.package.trim().length}/20)</span><input value={f.package} maxLength={20} onChange={(e) => setF({ ...f, package: e.target.value })} placeholder="Option 5" /></label>
    <label className="sys-field" style={{ width: 170 }}><span>Billing</span>
      <select value={f.billing} onChange={(e) => setF({ ...f, billing: e.target.value, days: e.target.value === 'one_time' && f.days === '' ? '30' : f.days })}>
        {ORDER.map((b) => <option key={b} value={b}>{BILLING[b].label}</option>)}
      </select>
    </label>
    <label className="sys-field" style={{ width: 140 }}><span>Days of access{f.billing === 'one_time' ? '' : ' (optional)'}</span><input type="number" min="1" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} placeholder={f.billing === 'six_months' ? '183' : ''} /></label>
    <label className="sys-field" style={{ flex: '2 1 300px' }}><span>Stripe Payment Link</span><input type="url" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://buy.stripe.com/…" /></label>
    <label className="sys-chip" style={{ cursor: 'pointer' }}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Available</label>
  </div>
);

const AddPlan = ({ programs, onAdd }) => {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ ...planForm(null), program: '' });
  const program = f.program || programs[0]?.id || '';
  if (!open) return <button className="sys-btn sys-btn--gold sys-btn--sm" style={{ marginBottom: 14 }} onClick={() => setOpen(true)}><Plus size={14} /> Add a plan</button>;
  return (
    <form className="sys-card sys-form" style={{ marginBottom: 14 }} onSubmit={async (e) => { e.preventDefault(); if (await onAdd({ ...f, program })) { setF({ ...planForm(null), program }); setOpen(false); } }}>
      <h2><Plus size={18} /> Add a plan</h2>
      <p className="sys-muted">Paste the plan’s Stripe Payment Link and its price and billing are copied from Stripe as soon as you add it (and again every day). Without a link, set a price in the plan’s row afterwards.</p>
      <label className="sys-field" style={{ maxWidth: 320 }}><span>Program</span>
        <select required value={program} onChange={(e) => setF({ ...f, program: e.target.value })}>
          {programs.map((p) => <option key={p.id} value={p.id}>{p.title}{p.is_active === false ? ' (hidden)' : ''}</option>)}
        </select>
      </label>
      <PlanFields f={f} setF={setF} />
      <p className="sys-muted" style={{ fontSize: '0.8rem' }}>Package keys: at most 20 characters, different from every other plan in every program.</p>
      <div className="sys-row" style={{ gap: 10 }}>
        <button className="sys-btn sys-btn--gold sys-btn--sm"><Plus size={14} /> Add plan</button>
        <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
};

const ProgramsCard = ({ programs, onAdd, onSave }) => {
  const [f, setF] = useState({ slug: '', title: '', sort: '' });
  const [edit, setEdit] = useState(null);
  const nextSort = Math.max(0, ...programs.map((p) => p.sort_order || 0)) + 1;
  return (
    <section className="sys-card sys-form" style={{ marginBottom: 14 }}>
      <h2><GraduationCap size={18} /> Programs</h2>
      <ul className="sys-list">
        {programs.map((p) => (
          <li key={p.id} className="sys-result">
            {edit?.id === p.id ? (
              <form className="sys-row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', flex: 1 }} onSubmit={(e) => { e.preventDefault(); if (!edit.title.trim()) return; onSave(p, { title: edit.title.trim(), sort_order: Number(edit.sort) || 0 }, `${edit.title.trim()} saved.`); setEdit(null); }}>
                <label className="sys-field" style={{ flex: '1 1 240px' }}><span>Title</span><input required value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
                <label className="sys-field" style={{ width: 110 }}><span>Sort order</span><input type="number" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: e.target.value })} /></label>
                <button className="sys-btn sys-btn--gold sys-btn--sm">Save</button>
                <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => setEdit(null)}>Cancel</button>
              </form>
            ) : (
              <>
                <div className="sys-result__main"><h3>{p.title}</h3><div className="sys-result__meta"><span>/{p.slug}</span><span>order {p.sort_order}</span><span>{p.is_active === false ? 'hidden' : 'shown'}</span></div></div>
                <button className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => setEdit({ id: p.id, title: p.title, sort: String(p.sort_order ?? 0) })}>Rename</button>
                <button className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => onSave(p, { is_active: p.is_active === false }, p.is_active === false ? `${p.title} is shown.` : `${p.title} is hidden.`)}>{p.is_active === false ? 'Show' : 'Hide'}</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={async (e) => { e.preventDefault(); if (await onAdd({ ...f, sort: f.sort === '' ? String(nextSort) : f.sort })) setF({ slug: '', title: '', sort: '' }); }}>
        <div className="sys-row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <label className="sys-field" style={{ width: 200 }}><span>Slug (a-z, 0-9, -)</span><input required pattern="[a-z0-9-]+" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} placeholder="marriage" /></label>
          <label className="sys-field" style={{ flex: '1 1 240px' }}><span>Title</span><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Marriage Mentorship" /></label>
          <label className="sys-field" style={{ width: 110 }}><span>Sort order</span><input type="number" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} placeholder={String(nextSort)} /></label>
          <button className="sys-btn sys-btn--gold sys-btn--sm"><Plus size={14} /> Add program</button>
        </div>
      </form>
      <p className="sys-muted">A new program starts hidden. Before you Show it, its public page text (tagline, description and the mentorship page copy) needs writing; ask the developer, since that text lives in the site. Hiding a program removes it from public lists; members keep their access.</p>
    </section>
  );
};

const PlanRow = ({ plan, onSave, onEdit, onDelete, onSync }) => {
  const [form, setForm] = useState({ price: plan.price_cents ? (plan.price_cents / 100).toString() : '', active: plan.is_active, days: plan.access_days || 30 });
  const [editing, setEditing] = useState(false);
  const [ef, setEf] = useState(() => planForm(plan));
  const [busy, setBusy] = useState(false);
  const run = async (fn) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  if (editing) {
    return (
      <form className="sys-card" style={{ margin: '6px 0' }} onSubmit={(e) => { e.preventDefault(); run(async () => { if (await onEdit(plan, ef)) setEditing(false); }); }}>
        <PlanFields f={ef} setF={setEf} />
        <p className="sys-muted" style={{ fontSize: '0.8rem' }}>A new Payment Link is synced from Stripe when you save. When Stripe bills weekly, monthly or every 6 months, the sync sets Billing to match.</p>
        <div className="sys-row" style={{ gap: 10 }}>
          <button className="sys-btn sys-btn--gold sys-btn--sm" disabled={busy}>Save plan</button>
          <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => { setEditing(false); setEf(planForm(plan)); }}>Cancel</button>
        </div>
      </form>
    );
  }
  return (
    <div className="sys-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
      <label className="sys-field" style={{ minWidth: 150 }}><span>{plan.label}{BILLING[plan.billing]?.per ? ` (per ${BILLING[plan.billing].per})` : ''}</span>
        <input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d.]/g, '') })} placeholder="Not offered" disabled={!!plan.stripe_payment_link} />
      </label>
      {plan.stripe_payment_link && <span className="sys-muted" style={{ fontSize: '0.8rem' }}>Price set in Stripe{plan.price_synced_at ? `, copied ${new Date(plan.price_synced_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''} · <a href={plan.stripe_payment_link} target="_blank" rel="noreferrer">her payment link</a></span>}
      {plan.billing === 'one_time' && (
        <label className="sys-field" style={{ width: 130 }}><span>Days of access</span><input type="number" min="1" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></label>
      )}
      <label className="sys-chip" style={{ cursor: 'pointer' }}><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Available</label>
      <span className="sys-muted">Now: {plan.price_cents ? money(plan.price_cents) : 'not priced'}{plan.package ? ` · ${plan.package}` : ''}</span>
      <button className="sys-btn sys-btn--gold sys-btn--sm" onClick={() => onSave(plan, form)}>Save</button>
      <button className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => setEditing(true)}>Edit</button>
      {plan.stripe_payment_link && <button className="sys-btn sys-btn--ghost sys-btn--sm" disabled={busy} onClick={() => run(() => onSync(plan))}>{busy ? 'Syncing…' : 'Sync price from Stripe now'}</button>}
      <button className="sys-icon-btn" disabled={busy} onClick={() => run(() => onDelete(plan))} aria-label={`Delete ${plan.label}`} title="Delete (only a plan never used)"><Trash2 size={16} /></button>
    </div>
  );
};

// The Program menu: every program in the database (academy_programs), so a new one appears without a code change.
const ProgramSelect = ({ programs, value, onChange }) => (
  <label className="sys-field"><span>Program</span>
    <select required value={value} onChange={(e) => onChange(e.target.value)}>
      {programs.map((p) => <option key={p.id} value={p.slug}>{p.title}{p.is_active === false ? ' (hidden)' : ''}</option>)}
    </select>
  </label>
);

const AddByEmail = ({ label, programs = [], withProgram, withTitle, withName, disabled, onAdd }) => {
  const [f, setF] = useState({ email: '', program: '', title: '', name: '' });
  const program = f.program || programs[0]?.slug || '';
  return (
    <form className="sys-card sys-form" onSubmit={(e) => { e.preventDefault(); onAdd({ ...f, program }); setF({ ...f, email: '', title: '', name: '' }); }}>
      <h2><UserPlus size={18} /> {label}</h2>
      <p className="sys-muted">They need an account first — mentors and Studio members create one at thep31collective.org/portal, and students from their enrollment link.</p>
      <div className="sys-row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <label className="sys-field" style={{ flex: '1 1 220px' }}><span>Their account email</span><input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        {withProgram && <ProgramSelect programs={programs} value={program} onChange={(v) => setF({ ...f, program: v })} />}
        {withTitle && <label className="sys-field"><span>Title (optional)</span><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Lead mentor" /></label>}
        {withName && <label className="sys-field"><span>Display name (optional)</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>}
        <button className="sys-btn sys-btn--gold" disabled={disabled}><Plus size={16} /> Add</button>
      </div>
    </form>
  );
};

const ManualEnroll = ({ programs = [], onEnroll }) => {
  const [f, setF] = useState({ email: '', program: '', days: '30', source: 'manual' });
  const program = f.program || programs[0]?.slug || '';
  return (
    <form className="sys-card sys-form" onSubmit={(e) => { e.preventDefault(); onEnroll({ ...f, program }); setF({ ...f, email: '' }); }}>
      <h2><UserPlus size={18} /> Enroll someone manually</h2>
      <p className="sys-muted">For someone who paid another way, or a complimentary seat. Card payments enroll the person who paid automatically; a couples client’s partner is added here as Complimentary, with their own account email.</p>
      <div className="sys-row" style={{ flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <label className="sys-field" style={{ flex: '1 1 220px' }}><span>Their account email</span><input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <ProgramSelect programs={programs} value={program} onChange={(v) => setF({ ...f, program: v })} />
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
