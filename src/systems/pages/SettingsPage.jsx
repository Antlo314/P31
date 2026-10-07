import React, { useEffect, useState } from 'react';
import { KeyRound, Users, PlugZap, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const MIN_PASSWORD = 8;

const PasswordForm = ({ onSubmit, submitLabel }) => {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < MIN_PASSWORD) return setMsg({ err: true, text: `Use at least ${MIN_PASSWORD} characters.` });
    if (pw !== confirm) return setMsg({ err: true, text: 'The two passwords don’t match.' });
    setBusy(true);
    const error = await onSubmit(pw);
    setBusy(false);
    if (error) return setMsg({ err: true, text: error });
    setPw(''); setConfirm('');
    setMsg({ err: false, text: 'Password updated.' });
  };

  return (
    <form className="sys-form" onSubmit={submit}>
      <label className="sys-field">
        <span>New password</span>
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
      </label>
      <label className="sys-field">
        <span>Confirm new password</span>
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </label>
      {msg && <p className={msg.err ? 'sys-error' : 'sys-ok'}>{!msg.err && <Check size={16} />} {msg.text}</p>}
      <button className="sys-btn sys-btn--gold" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
    </form>
  );
};

const SettingsPage = ({ operator }) => {
  const isOwner = operator.role === 'owner';
  const [team, setTeam] = useState([]);
  const [target, setTarget] = useState('');
  const [services, setServices] = useState(null);

  useEffect(() => {
    supabase.from('system_operators').select('user_id, username, display_name, role').order('created_at')
      .then(({ data }) => setTeam(data || []));
    supabase.functions.invoke('social-search', { body: { action: 'status' } })
      .then(({ data, error }) => setServices(error ? { reachable: false } : { reachable: true, ...data }));
  }, []);

  const changeOwn = async (pw) => {
    const { error } = await supabase.auth.updateUser({ password: pw });
    return error?.message;
  };

  const resetTeammate = async (pw) => {
    if (!target) return 'Choose a teammate first.';
    const { data, error } = await supabase.functions.invoke('systems-admin', {
      body: { action: 'reset-password', userId: target, password: pw },
    });
    if (error) return 'The reset service isn’t reachable yet — deploy the systems-admin function.';
    return data?.error;
  };

  const others = team.filter((t) => t.user_id !== operator.user_id);

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Settings</p>
        <h1>Account &amp; team</h1>
      </header>

      <section className="sys-card">
        <h2><KeyRound size={18} /> Your password</h2>
        <p className="sys-muted">Signed in as <strong>{operator.username}</strong>.</p>
        <PasswordForm onSubmit={changeOwn} submitLabel="Change my password" />
      </section>

      <section className="sys-card">
        <h2><Users size={18} /> Team</h2>
        <ul className="sys-list">
          {team.map((t) => (
            <li key={t.user_id}>
              <strong>{t.display_name || t.username}</strong>
              <span className="sys-pill">{t.role === 'owner' ? 'Owner' : 'Team'}</span>
            </li>
          ))}
        </ul>

        {isOwner && others.length > 0 && (
          <>
            <h3 className="sys-subhead">Reset a teammate’s password</h3>
            <label className="sys-field">
              <span>Teammate</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Choose…</option>
                {others.map((t) => <option key={t.user_id} value={t.user_id}>{t.display_name || t.username}</option>)}
              </select>
            </label>
            <PasswordForm onSubmit={resetTeammate} submitLabel="Set their password" />
          </>
        )}
      </section>

      <section className="sys-card">
        <h2><PlugZap size={18} /> Connected services</h2>
        <ul className="sys-list">
          <li>
            <span>Apify (social search &amp; comments)</span>
            <span className={`sys-pill ${services?.apify ? 'sys-pill--ok' : ''}`}>
              {services === null ? 'Checking…' : !services.reachable ? 'Function not deployed' : services.apify ? 'Connected' : 'Add APIFY_TOKEN'}
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
};

export default SettingsPage;
