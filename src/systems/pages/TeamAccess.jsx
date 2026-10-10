import React, { useEffect, useState } from 'react';
import { KeyRound, Clapperboard, Film, Trash2, UserPlus, Copy, Check, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TEAM } from '../../lib/team';
import { COLLECTIVE_URL } from '../../lib/seo';

const TOOLS = [
  { id: 'studio', label: 'Content Studio', Icon: Clapperboard, note: 'Posts, calendar, messages, comments and clip editing' },
  { id: 'davinci', label: 'DaVinci', Icon: Film, note: 'Clip finder and the DaVinci edit queue' },
];
const EMPTY = { full_name: '', email: '', tools: [] };

const inviteText = (row) => {
  const tools = TOOLS.filter((t) => row.tools.includes(t.id)).map((t) => t.label).join(' and ');
  return `Hi ${(row.full_name || '').split(' ')[0] || 'there'}, your P31 ${tools || 'team'} access is ready.\n\n`
    + `1. Go to ${COLLECTIVE_URL}/portal\n`
    + `2. Tap "Mentor or Studio team? Create an account" and use ${row.email} (or sign in if you already have an account with it)\n`
    + '3. Confirm your email from the message we send you, then sign in.\n\n'
    + 'You\'ll land right in your dashboard.';
};

// Systems → Team access: who can open Content Studio and DaVinci (admins always can).
const TeamAccess = () => {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState({});
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => Promise.all([
    supabase.from('team_access').select('*').order('created_at'),
    supabase.rpc('team_access_status'),
    supabase.from('system_operators').select('username, display_name, role').order('created_at'),
  ]).then(([a, s, o]) => {
    if (a.error) setError(/relation|does not exist/i.test(a.error.message) ? 'Run storefront_v29_team_access.sql in Supabase first.' : a.error.message);
    setRows(a.data || []);
    setStatus(Object.fromEntries((s.data || []).map((r) => [r.email, r])));
    setAdmins(o.data || []);
  });
  useEffect(() => { load(); }, []);

  const save = async (row) => {
    setError('');
    const { error: err } = await supabase.from('team_access').upsert({ email: row.email, full_name: row.full_name || null, tools: row.tools, note: row.note || null });
    if (err) setError(err.message);
    load();
  };
  const toggle = (row, tool) => save({ ...row, tools: row.tools.includes(tool) ? row.tools.filter((t) => t !== tool) : [...row.tools, tool] });
  const remove = async (row) => {
    if (!window.confirm(`Remove ${row.full_name || row.email}'s access? They keep their account, just not these tools.`)) return;
    await supabase.from('team_access').delete().eq('email', row.email);
    load();
  };

  const add = async (e) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError('Enter their full email address.');
    if (!form.tools.length) return setError('Pick at least one tool.');
    setSaving(true);
    await save({ ...form, email });
    setSaving(false);
    setForm(EMPTY);
  };

  const copy = async (row) => {
    try { await navigator.clipboard.writeText(inviteText(row)); setCopied(row.email); setTimeout(() => setCopied(''), 2500); } catch { setError('Couldn’t copy. Select the text manually.'); }
  };

  const listed = new Set(rows.map((r) => r.email));
  const suggestions = TEAM.flatMap((p) => p.emails.slice(0, 1).map((email) => ({ name: p.name, role: p.role, email }))).filter((p) => !listed.has(p.email));

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Settings &amp; Health</p>
        <h1>Team access</h1>
        <p className="sys-muted">Admins can open everything. Everyone else gets only the tools you switch on here, tied to the email they sign in with. Access starts once they’ve confirmed that email.</p>
      </header>

      {error && <p className="sys-alert" role="alert">{error}</p>}

      <section className="sys-card">
        <h2><KeyRound size={18} /> People and their tools</h2>
        {rows.length === 0 && <p className="sys-muted">No one yet. Add someone below.</p>}
        <ul className="sys-list ta-list">
          {rows.map((r) => {
            const st = status[r.email];
            return (
              <li key={r.email} className="ta-row">
                <div className="ta-who">
                  <strong>{r.full_name || r.email}</strong>
                  <span>{r.email}{r.note ? ` · ${r.note}` : ''}</span>
                  <span className={`ta-state ${st?.confirmed ? 'is-on' : ''}`}>
                    {!st ? '…' : st.confirmed ? `Active${st.last_sign_in ? ` · last signed in ${new Date(st.last_sign_in).toLocaleDateString()}` : ''}` : st.has_account ? 'Account made · email not confirmed yet' : 'Hasn’t made an account yet'}
                  </span>
                </div>
                <div className="sys-chips" role="group" aria-label={`Tools for ${r.full_name || r.email}`}>
                  {TOOLS.map((t) => (
                    <button key={t.id} type="button" className={`sys-chip ${r.tools.includes(t.id) ? 'is-on' : ''}`} aria-pressed={r.tools.includes(t.id)} onClick={() => toggle(r, t.id)} title={t.note}>
                      <t.Icon size={13} /> {t.label}
                    </button>
                  ))}
                </div>
                <div className="ta-actions">
                  <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => copy(r)}>{copied === r.email ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy sign-up steps</>}</button>
                  <button type="button" className="sys-icon-btn" onClick={() => remove(r)} aria-label={`Remove ${r.full_name || r.email}`}><Trash2 size={16} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="sys-card">
        <h2><UserPlus size={18} /> Give someone access</h2>
        {suggestions.length > 0 && (
          <div className="sys-chips" aria-label="From the team directory">
            {suggestions.map((p) => (
              <button key={p.email} type="button" className="sys-chip" onClick={() => setForm({ ...form, full_name: p.name, email: p.email })}>{p.name}</button>
            ))}
          </div>
        )}
        <form className="sys-form" onSubmit={add}>
          <div className="sys-row">
            <label className="sys-field sys-grow"><span>Name</span><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
            <label className="sys-field sys-grow"><span>Email they sign in with</span><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          </div>
          <div className="sys-chips" role="group" aria-label="Tools">
            {TOOLS.map((t) => (
              <button key={t.id} type="button" className={`sys-chip ${form.tools.includes(t.id) ? 'is-on' : ''}`} aria-pressed={form.tools.includes(t.id)}
                onClick={() => setForm({ ...form, tools: form.tools.includes(t.id) ? form.tools.filter((x) => x !== t.id) : [...form.tools, t.id] })}>
                <t.Icon size={13} /> {t.label}
              </button>
            ))}
          </div>
          <button className="sys-btn sys-btn--gold" disabled={saving}>{saving ? 'Saving…' : 'Give access'}</button>
        </form>
      </section>

      <section className="sys-card">
        <h2><ShieldCheck size={18} /> Admins (full control)</h2>
        <p className="sys-muted">Systems sign-ins can open every dashboard and tool, and manage this page.</p>
        <ul className="sys-list">
          {admins.map((a) => <li key={a.username}><span>{a.display_name || a.username}</span><span className="sys-muted">{a.role === 'owner' ? 'Owner' : 'Admin'}</span></li>)}
        </ul>
        <p className="sys-muted">Content Studio is also open to the Studio seats in Systems → Academy.</p>
      </section>
    </div>
  );
};

export default TeamAccess;
