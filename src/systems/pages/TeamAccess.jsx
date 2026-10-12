import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Trash2, UserPlus, Copy, Check, ShieldCheck, User, Plus, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TEAM, memberByEmail } from '../../lib/team';
import { DASHBOARDS, DASH, siteOfEmail, suggestDashboards } from '../../lib/dashboards';
import { HEADSHOTS, PHOTO_BY_NAME } from '../../lib/teamPhotos';
import { COLLECTIVE_URL } from '../../lib/seo';
import { SITES } from '../nav';

const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EMPTY = { full_name: '', email: '', role_title: '', tools: [] };

const inviteText = (row) => {
  const names = (row.tools || []).map((t) => DASH[t]?.label).filter(Boolean);
  return `Hi ${(row.full_name || '').split(' ')[0] || 'there'}, your P31 login is ready.\n\n`
    + `1. Go to ${COLLECTIVE_URL}/portal\n`
    + `2. Tap "On the P31 team? Create an account" and use ${row.email} (or sign in if you already have an account with it)\n`
    + '3. Confirm the email we send you, then sign in.\n\n'
    + (names.length ? `Your dashboards: ${names.join(', ')}. You land on Today, which gathers them, and every dashboard has a walkthrough.` : 'An admin will switch your dashboards on.');
};

// Systems → Team & dashboards: who is on the team, which dashboards each login opens, the site admins.
const TeamAccess = () => {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState({});
  const [operators, setOperators] = useState([]);
  const [siteAdmins, setSiteAdmins] = useState(null); // null until loaded; [] if v38 has not run
  const [form, setForm] = useState(EMPTY);
  const [newAdmin, setNewAdmin] = useState({ email: '', full_name: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState('');
  const [saving, setSaving] = useState(false);
  const [v41, setV41] = useState(true);

  const load = () => Promise.all([
    supabase.from('team_access').select('*').order('created_at'),
    supabase.rpc('team_access_status'),
    supabase.from('system_operators').select('username, display_name, role').order('created_at'),
    supabase.from('site_admins').select('email, full_name, added_by, created_at').order('created_at'),
  ]).then(([a, s, o, sa]) => {
    setSiteAdmins(sa.error ? [] : sa.data || []);
    if (a.error) setError(/relation|does not exist/i.test(a.error.message) ? 'Run storefront_v29_team_access.sql in Supabase first.' : a.error.message);
    const list = a.data || [];
    setRows(list);
    setV41(list.length === 0 || 'role_title' in list[0]);
    setStatus(Object.fromEntries((s.data || []).map((r) => [r.email, r])));
    setOperators(o.data || []);
  });
  useEffect(() => { load(); }, []);

  const save = async (row) => {
    setError(''); setMsg('');
    const base = { email: row.email, full_name: row.full_name || null, tools: row.tools || [], note: row.note || null };
    const full = v41 ? { ...base, role_title: row.role_title || null, photo_key: row.photo_key || memberByEmail(row.email)?.photo || null, site: row.site || siteOfEmail(row.email), sort_order: row.sort_order ?? 100 } : base;
    const { error: err } = await supabase.from('team_access').upsert(full);
    if (err) setError(/column .* does not exist|tools_check|check constraint/i.test(err.message) ? 'Run storefront_v41_team_dashboards.sql in Supabase to manage dashboards here (until then only Content Studio and DaVinci can be given).' : err.message);
    load();
  };
  const toggle = (row, id) => save({ ...row, tools: row.tools.includes(id) ? row.tools.filter((t) => t !== id) : [...row.tools, id] });
  const remove = async (row) => {
    if (!window.confirm(`Remove ${row.email}? She keeps her account, just not these dashboards.`)) return;
    await supabase.from('team_access').delete().eq('email', row.email);
    load();
  };
  const addLogin = async (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!EMAIL_OK.test(email)) return setError('Enter the full email address she will sign in with.');
    setSaving(true);
    const person = memberByEmail(email);
    await save({ ...form, email, full_name: form.full_name.trim() || person?.name || null, role_title: form.role_title.trim() || person?.role || null, photo_key: person?.photo || null, sort_order: person ? TEAM.indexOf(person) * 10 + 10 : 100 });
    setSaving(false);
    setForm(EMPTY);
    setMsg(`${email} added. Copy her sign-up steps from her card.`);
  };
  const quickAdd = (person, email) => save({ email, full_name: person.name, role_title: person.role, photo_key: person.photo, tools: suggestDashboards(person.role, email), sort_order: TEAM.indexOf(person) * 10 + 10, note: person.focus.join(', ') });

  // Site admins (v38): the curator studio and every admin-only screen read this list.
  const addAdmin = async (e) => {
    e.preventDefault();
    setError('');
    const email = newAdmin.email.trim().toLowerCase();
    if (!EMAIL_OK.test(email)) return setError('Enter the new admin’s full email address.');
    if (!window.confirm(`Make ${email} a site admin? Admins open every dashboard, approve vendors, manage every shop and change this page.`)) return;
    const { data: who } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('site_admins').insert({ email, full_name: newAdmin.full_name.trim() || null, added_by: who?.user?.id });
    if (err) setError(/duplicate|already/i.test(err.message) ? `${email} is already an admin.` : err.message);
    else setNewAdmin({ email: '', full_name: '' });
    load();
  };
  const removeAdmin = async (a) => {
    if (!window.confirm(`Remove ${a.full_name || a.email} as a site admin? She keeps her account and any dashboards above.`)) return;
    const { error: err } = await supabase.from('site_admins').delete().eq('email', a.email);
    if (err) setError(err.message);
    load();
  };
  const copy = async (row) => {
    try { await navigator.clipboard.writeText(inviteText(row)); setCopied(row.email); setTimeout(() => setCopied(''), 2500); } catch { setError('Couldn’t copy. Select the text manually.'); }
  };

  // People: every login grouped by name, in directory order, plus directory people who have no login yet.
  const people = useMemo(() => {
    const byName = new Map();
    const order = (r) => r.sort_order ?? (memberByEmail(r.email) ? TEAM.indexOf(memberByEmail(r.email)) * 10 + 10 : 500);
    [...rows].sort((a, b) => order(a) - order(b)).forEach((r) => {
      const person = memberByEmail(r.email);
      const key = person?.name || r.full_name || r.email;
      if (!byName.has(key)) byName.set(key, { name: key, person, role: r.role_title || person?.role || '', photo: r.photo_key || person?.photo, logins: [] });
      byName.get(key).logins.push(r);
    });
    TEAM.forEach((p) => { if (!byName.has(p.name)) byName.set(p.name, { name: p.name, person: p, role: p.role, photo: p.photo, logins: [] }); });
    return [...byName.values()].sort((a, b) => (a.person ? TEAM.indexOf(a.person) : 99) - (b.person ? TEAM.indexOf(b.person) : 99));
  }, [rows]);
  const adminEmails = new Set((siteAdmins || []).map((a) => a.email));
  const suggestedFor = (email, role) => (form.tools.length ? form.tools : suggestDashboards(role, email));

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Team</p>
        <h1>Team &amp; dashboards</h1>
        <p className="sys-muted">Each mailbox is its own login. Switch on the dashboards each login opens; access starts once that email is confirmed. Site admins (Melanie JC and whoever she adds) open everything.</p>
      </header>

      {error && <p className="sys-alert" role="alert">{error}</p>}
      {msg && <p className="sys-ok"><Check size={16} /> {msg}</p>}
      {!v41 && rows.length > 0 && <p className="sys-alert">Dashboards beyond Content Studio and DaVinci need storefront_v41_team_dashboards.sql. Run it in Supabase, then reload.</p>}

      <section className="sys-card" data-tour="team-people">
        <h2><KeyRound size={18} /> The team, login by login</h2>
        <div className="tm-people">
          {people.map((p) => {
            const photo = (p.photo && HEADSHOTS[p.photo]) || PHOTO_BY_NAME[p.name];
            const missing = (p.person?.emails || []).filter((e) => !p.logins.some((r) => r.email === e));
            return (
              <article key={p.name} className="tm-person">
                <span className="tm-person__photo">{photo ? <img src={photo} alt={p.name} /> : <User size={28} />}</span>
                <div>
                  <div className="tm-person__head"><h3>{p.name}</h3><span>{p.role}</span></div>
                  {p.person && <p className="tm-focus">{p.person.focus.join(' · ')}</p>}
                  <div className="tm-logins">
                    {p.logins.map((r) => {
                      const st = status[r.email];
                      const site = r.site || siteOfEmail(r.email);
                      const admin = adminEmails.has(r.email);
                      return (
                        <div key={r.email} className="tm-login">
                          <div className="tm-login__top">
                            <strong>{r.email}</strong>
                            <span className="tm-chip-site">{SITES[site]?.label || 'Both sites'}</span>
                            {admin && <span className="tm-admin">Site admin</span>}
                            <span className={`tm-login__state ${st?.confirmed ? 'is-on' : ''}`}>
                              {!st ? '' : st.confirmed ? `Active${st.last_sign_in ? ` · signed in ${new Date(st.last_sign_in).toLocaleDateString()}` : ''}` : st.has_account ? 'Account made · email not confirmed yet' : 'No account yet'}
                            </span>
                            <span className="tm-login__actions">
                              <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => copy(r)}>{copied === r.email ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Sign-up steps</>}</button>
                              <button type="button" className="sys-icon-btn" onClick={() => remove(r)} aria-label={`Remove ${r.email}`}><Trash2 size={15} /></button>
                            </span>
                          </div>
                          {admin ? <p className="sys-muted" style={{ margin: 0, fontSize: '0.82rem' }}>Every dashboard, as a site admin.</p> : (
                            <div className="sys-chips tm-chips" role="group" aria-label={`Dashboards for ${r.email}`} data-tour="team-dashboards">
                              {DASHBOARDS.map((d) => (
                                <button key={d.id} type="button" className={`sys-chip ${r.tools.includes(d.id) ? 'is-on' : ''}`} aria-pressed={r.tools.includes(d.id)} onClick={() => toggle(r, d.id)} title={d.blurb}>
                                  <d.Icon size={13} /> {d.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {missing.map((email) => (
                      <div key={email} className="tm-login tm-login--missing">
                        <div className="tm-login__top">
                          <strong>{email}</strong>
                          <span className="tm-chip-site">{SITES[siteOfEmail(email)]?.label}</span>
                          <span className="tm-login__state">Not set up as a login yet</span>
                          <span className="tm-login__actions">
                            <button type="button" className="sys-btn sys-btn--gold sys-btn--sm" onClick={() => quickAdd(p.person, email)}><Plus size={14} /> Add login{suggestDashboards(p.person.role, email).length ? ` (${suggestDashboards(p.person.role, email).map((t) => DASH[t].short).join(', ')})` : ''}</button>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="sys-card tm-add" data-tour="team-add">
        <h2><UserPlus size={18} /> Add a login</h2>
        <p className="sys-muted">For someone new, or a mailbox not on the directory. Pick a name to fill it in, then choose her dashboards.</p>
        <div className="sys-chips" aria-label="From the team directory">
          {TEAM.map((p) => <button key={p.name} type="button" className="sys-chip" onClick={() => setForm({ ...form, full_name: p.name, role_title: p.role, email: p.emails.find((e) => !rows.some((r) => r.email === e)) || p.emails[0] })}>{p.name}</button>)}
        </div>
        <form className="sys-form" onSubmit={addLogin}>
          <div className="sys-row">
            <label className="sys-field sys-grow"><span>Name</span><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
            <label className="sys-field sys-grow"><span>Email she signs in with</span><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@p31market.com" /></label>
            <label className="sys-field sys-grow"><span>Role (shows as her badge)</span><input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} placeholder="Executive Assistant" /></label>
          </div>
          <p className="sys-muted" style={{ margin: '6px 0' }}>{form.email ? `${SITES[siteOfEmail(form.email)]?.label || 'Both sites'} login` : 'The mailbox decides the site: @p31market.com is the Market, @thep31collective.org the Collective.'}{!form.tools.length && suggestDashboards(form.role_title, form.email).length ? ` · suggested: ${suggestDashboards(form.role_title, form.email).map((t) => DASH[t].short).join(', ')}` : ''}</p>
          <div className="sys-chips" role="group" aria-label="Dashboards">
            {DASHBOARDS.map((d) => {
              const on = suggestedFor(form.email, form.role_title).includes(d.id);
              return (
                <button key={d.id} type="button" className={`sys-chip ${on ? 'is-on' : ''}`} aria-pressed={on}
                  onClick={() => { const cur = suggestedFor(form.email, form.role_title); setForm({ ...form, tools: cur.includes(d.id) ? cur.filter((x) => x !== d.id) : [...cur, d.id] }); }} title={d.blurb}>
                  <d.Icon size={13} /> {d.label}
                </button>
              );
            })}
          </div>
          <button className="sys-btn sys-btn--gold" disabled={saving}>{saving ? 'Saving…' : 'Add the login'}</button>
        </form>
      </section>

      <section className="sys-card" data-tour="team-admins">
        <h2><ShieldCheck size={18} /> Site admins</h2>
        <p className="sys-muted">Open every dashboard, approve vendors, manage every shop, assign dashboards and change this list. The site always keeps at least one.</p>
        {siteAdmins === null ? <p className="sys-muted">Loading…</p> : siteAdmins.length === 0 ? (
          <p className="sys-muted">Run storefront_v38_automation.sql in Supabase to manage admins here.</p>
        ) : (
          <ul className="sys-list">
            {siteAdmins.map((a) => (
              <li key={a.email}>
                <span><strong>{a.full_name || a.email}</strong>{a.full_name && <span className="sys-muted"> · {a.email}</span>}</span>
                <span className="sys-row sys-row--center" style={{ gap: 8 }}>
                  <span className="sys-muted">{a.added_by ? `added ${new Date(a.created_at).toLocaleDateString()}` : 'original'}</span>
                  {siteAdmins.length > 1 && <button type="button" className="sys-icon-btn" onClick={() => removeAdmin(a)} aria-label={`Remove ${a.email} as admin`}><Trash2 size={15} /></button>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {siteAdmins?.length > 0 && (
          <form className="sys-row" onSubmit={addAdmin}>
            <label className="sys-field sys-grow"><span>Name</span><input value={newAdmin.full_name} onChange={(e) => setNewAdmin({ ...newAdmin, full_name: e.target.value })} /></label>
            <label className="sys-field sys-grow"><span>Email</span><input type="email" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} placeholder="name@example.com" /></label>
            <button className="sys-btn sys-btn--ghost" style={{ alignSelf: 'end' }}><UserPlus size={15} /> Add admin</button>
          </form>
        )}
      </section>

      <section className="sys-card">
        <h2><ShieldCheck size={18} /> Systems sign-ins (full control)</h2>
        <p className="sys-muted">Systems sign-ins open every dashboard and tool, and manage this page.</p>
        <ul className="sys-list">
          {operators.map((a) => <li key={a.username}><span>{a.display_name || a.username}</span><span className="sys-muted">{a.role === 'owner' ? 'Owner' : 'Admin'}</span></li>)}
        </ul>
        <p className="sys-muted"><Mail size={13} /> Content Studio is also open to the Studio seats in Systems → Mentorship.</p>
      </section>
    </div>
  );
};

export default TeamAccess;
