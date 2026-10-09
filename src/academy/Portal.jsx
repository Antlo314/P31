import React, { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Eye, EyeOff, LayoutGrid, LogOut, GraduationCap, Clapperboard, Store, ShieldCheck, Presentation } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useRoles, dashboardsFor } from '../lib/roles';
import { CONTACT_EMAIL } from '../lib/academy';
import { hrefFor, isCollective } from '../lib/site';
import { usernameToEmail } from '../systems/useOperator';
import mark from '../assets/academy/collective-mark.png';
import '../pages/Login.css';
import './mentorship.css';

const KIND_ICON = { student: GraduationCap, mentor: Presentation, studio: Clapperboard, systems: ShieldCheck, curator: Store };

// /portal — one sign-in for every member dashboard.
const Portal = () => {
  const { signOut } = useAuth();
  const { status, roles } = useRoles();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [creating, setCreating] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Arriving from a "reset password" email lands here signed in for recovery.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') setRecovery(true); });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setNote('');
    if (creating) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) { setBusy(false); return setError('Enter your full email address, like name@example.com.'); }
      if (form.password.length < 8) { setBusy(false); return setError('Use a password with at least 8 characters.'); }
      // A plain account — dashboards open once an admin or an enrollment link grants access.
      const { data, error: err } = await supabase.auth.signUp({
        email: form.email.trim(), password: form.password,
        options: { data: { full_name: form.name.trim() }, emailRedirectTo: `${window.location.origin}/portal` },
      });
      setBusy(false);
      if (err) return setError(err.message);
      if (!data.session) setNote('Check your email to confirm your account, then sign in here.');
      return;
    }
    // Email, or a Systems username (e.g. Antlo314) like the Systems sign-in accepts.
    const email = form.email.trim() ? usernameToEmail(form.email) : '';
    if (!email || !form.password) { setBusy(false); return setError('Enter your email (or Systems username) and your password.'); }
    const timeout = new Promise((resolve) => setTimeout(() => resolve({ error: { message: 'timeout' } }), 20000));
    const { error: err } = await Promise.race([supabase.auth.signInWithPassword({ email, password: form.password }), timeout]);
    setBusy(false);
    if (!err) return;
    if (err.message === 'Invalid login credentials') setError(`That email and password don’t match${form.email.includes('@') ? '' : ` (we tried ${email})`}. Check them, or tap “Forgot password”.`);
    else if (err.message === 'timeout') setError('Signing in is taking too long — check your connection and try again.');
    else if (/confirm/i.test(err.message)) setError('This account’s email hasn’t been confirmed yet. Check your inbox for the confirmation link.');
    else setError(err.message);
  };

  const forgot = async () => {
    setError(''); setNote('');
    if (!form.email.trim()) return setError('Enter your email first, then tap “Forgot password”.');
    const { error: err } = await supabase.auth.resetPasswordForEmail(usernameToEmail(form.email), { redirectTo: `${window.location.origin}/portal` });
    if (err) setError(err.message); else setNote('Check your inbox for a link to set a new password.');
  };

  const saveNewPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) return setError('Use at least 8 characters.');
    setBusy(true); setError('');
    const { error: err } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (err) setError(err.message); else { setRecovery(false); setNote('Password updated — you’re signed in.'); }
  };

  const dashboards = status === 'ready' ? dashboardsFor(roles) : [];
  const next = params.get('next');
  if (status === 'ready' && !recovery && next && /^\/(academy|studio|systems|dashboard)(\/|$)/.test(next)) {
    return <Navigate to={next} replace />;
  }
  // One dashboard on this domain: go straight there. (A dashboard on the other
  // domain is listed instead — signing in there is a separate step.)
  if (status === 'ready' && !recovery && dashboards.length === 1 && !params.has('choose') && !dashboards[0].locked && hrefFor(dashboards[0].to) === dashboards[0].to) {
    return <Navigate to={dashboards[0].to} replace />;
  }

  return (
    <div className="lg k-dark">
      <span className="k-hero__arch" aria-hidden="true" />
      <div className="lg__inner">
        <section className="lg__story">
          <img src={mark} alt="" className="mt-mark" data-intro="0" />
          <p className="k-eyebrow" data-intro="0.05">Member portal</p>
          <h1 className="k-h1" data-split="intro">Welcome <em>home.</em></h1>
          <p className="k-lede" data-intro="0.25">One sign-in for your mentorship classroom, the Content Studio and Systems.</p>
        </section>

        <div className="lg__card" data-intro="0.15">
          {status === 'loading' && <p className="lg__sub">One moment…</p>}

          {recovery && (
            <form className="lg__form" onSubmit={saveNewPassword}>
              <h2 className="k-h2 lg__title">Set a new <em>password</em></h2>
              <label className="lg__field"><span>New password</span>
                <div className="lg__input"><Lock size={18} />
                  <input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
              </label>
              {error && <p className="k-error" role="alert">{error}</p>}
              <button className="k-btn k-btn--plum k-btn--lg k-btn--block" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
            </form>
          )}

          {!recovery && status === 'signed-out' && (
            <form className="lg__form" onSubmit={signIn}>
              <h2 className="k-h2 lg__title">{creating ? <>Create an <em>account</em></> : <>Sign <em>in</em></>}</h2>
              <p className="lg__sub">{creating ? 'For mentors and Content Studio team members — an admin connects your dashboard.' : 'Use the email you enrolled or were invited with.'}</p>
              {creating && (
                <label className="lg__field"><span>Full name</span>
                  <div className="lg__input"><input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                </label>
              )}
              <label className="lg__field"><span>{creating ? 'Email' : 'Email or Systems username'}</span>
                <div className="lg__input"><Mail size={18} />
                  <input type="text" autoComplete="username" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
                </div>
              </label>
              <label className="lg__field"><span>Password</span>
                <div className="lg__input"><Lock size={18} />
                  <input type={show ? 'text' : 'password'} minLength={creating ? 8 : undefined} autoComplete={creating ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <button type="button" className="lg__eye" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </label>
              {error && <p className="k-error" role="alert">{error}</p>}
              {note && <p className="k-fine" role="status">{note}</p>}
              <button className="k-btn k-btn--plum k-btn--lg k-btn--block" disabled={busy}>{busy ? 'One moment…' : creating ? 'Create account' : <>Sign in <ArrowRight size={18} /></>}</button>
              {!creating && <button type="button" className="lg__forgot" onClick={forgot}>Forgot password?</button>}
              <button type="button" className="lg__forgot" onClick={() => { setCreating(!creating); setError(''); setNote(''); }}>{creating ? 'I already have an account' : 'Mentor or Studio team? Create an account'}</button>
              <p className="lg__foot">New to the mentorships? <a href={hrefFor('/mentorship')}>Book an intro call</a></p>
            </form>
          )}

          {!recovery && status === 'ready' && (
            <>
              <h2 className="k-h2 lg__title">{dashboards.length > 1 ? <>Where to <em>today?</em></> : <>Your <em>dashboard</em></>}</h2>
              {note && <p className="k-fine" role="status">{note}</p>}
              {dashboards.length ? (
                <nav className="pt-list">
                  {dashboards.map((d) => {
                    const Icon = KIND_ICON[d.kind] || LayoutGrid;
                    const href = hrefFor(d.to);
                    const body = <>
                      <span className="pt-item__icon"><Icon size={20} /></span>
                      <span><strong>{d.title}</strong><small>{href === d.to ? d.note : `${d.note} · opens ${isCollective ? 'p31market.com' : 'thep31collective.org'}`}</small></span>
                      <ArrowRight size={18} />
                    </>;
                    return href === d.to
                      ? <Link key={d.to} to={d.to} className={`pt-item ${d.locked ? 'is-locked' : ''}`} data-program={d.program || d.kind}>{body}</Link>
                      : <a key={d.to} href={href} className={`pt-item ${d.locked ? 'is-locked' : ''}`} data-program={d.program || d.kind}>{body}</a>;
                  })}
                </nav>
              ) : (
                <div className="pt-empty">
                  <p>This account isn’t connected to a dashboard yet.</p>
                  <p>Enrolling in a mentorship? You’ll get access after your enrollment link is completed. Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
                  <a href={hrefFor('/mentorship')} className="k-btn k-btn--gold k-btn--block">Explore the mentorships</a>
                </div>
              )}
              <button type="button" className="lg__forgot" onClick={signOut}><LogOut size={14} /> Sign out</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Portal;
