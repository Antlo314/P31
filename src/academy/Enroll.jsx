import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Mail, Lock, UserRound, ArrowRight, ShieldCheck, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { money, BILLING, CONTACT_EMAIL } from '../lib/academy';
import mark from '../assets/academy/collective-mark.png';
import '../pages/Login.css';
import './mentorship.css';

// /enroll/:token — the private link sent after an intro call. This is the only
// place a mentorship price is ever shown, and only to the person holding the link.
const Enroll = () => {
  const { token } = useParams();
  const [params] = useSearchParams();
  const { user, signOut } = useAuth();
  const [invite, setInvite] = useState(undefined); // undefined = loading, null = not found
  const [mode, setMode] = useState('create');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [ready, setReady] = useState(false);
  const returned = params.get('status');

  useEffect(() => {
    supabase.rpc('academy_invite_details', { p_token: token }).then(({ data }) => {
      setInvite(data || null);
      if (data?.full_name) setForm((f) => ({ ...f, name: f.name || data.full_name }));
    });
  }, [token]);

  // Back from Stripe: wait for the webhook to open the classroom.
  useEffect(() => {
    if (returned !== 'success' || !user || !invite) return undefined;
    let tries = 0;
    const timer = setInterval(async () => {
      tries += 1;
      const { data } = await supabase.rpc('my_roles');
      const ok = (data?.student || []).some((s) => s.program === invite.program && s.has_access);
      if (ok || tries > 20) { clearInterval(timer); setReady(ok); if (!ok) setNote('Your payment went through. It can take a minute for your classroom to open — refresh shortly, or sign in from the member portal.'); }
    }, 2000);
    return () => clearInterval(timer);
  }, [returned, user, invite]);

  const auth = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setNote('');
    if (mode === 'create') {
      const { data, error: err } = await supabase.auth.signUp({
        email: form.email.trim(), password: form.password,
        options: { data: { full_name: form.name.trim() }, emailRedirectTo: window.location.href.split('?')[0] },
      });
      setBusy(false);
      if (err) return setError(err.message);
      if (!data.session) setNote('Check your email to confirm your account, then come back to this link to finish enrolling.');
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
      setBusy(false);
      if (err) setError(err.message === 'Invalid login credentials' ? 'That email and password don’t match.' : err.message);
    }
  };

  const checkout = async () => {
    setBusy(true); setError('');
    const { data, error: err } = await supabase.functions.invoke('academy-checkout', { body: { token } });
    let msg = data?.error;
    if (err) { try { msg = (await err.context?.json?.())?.error; } catch { /* keep */ } }
    if (data?.url) { window.location.href = data.url; return; }
    if (data?.already) { setReady(true); setBusy(false); return; }
    setError(msg || `Checkout isn’t available right now. Please email ${CONTACT_EMAIL}.`);
    setBusy(false);
  };

  const per = invite ? BILLING[invite.billing]?.per : null;

  return (
    <div className="lg k-dark">
      <span className="k-hero__arch" aria-hidden="true" />
      <div className="lg__inner">
        <section className="lg__story">
          <img src={mark} alt="" className="mt-mark" data-intro="0" />
          <p className="k-eyebrow" data-intro="0.05">Your private invitation</p>
          <h1 className="k-h1" data-split="intro" key={invite?.program_title || "m"}>{invite?.program_title || 'Mentorship'} <em>awaits.</em></h1>
          <p className="k-lede" data-intro="0.25">This link was prepared just for you after your intro call. Complete your enrollment and your classroom opens right away.</p>
        </section>

        <div className="lg__card" data-intro="0.15">
          {invite === undefined && <p className="lg__sub"><Loader2 size={16} className="k-spin" /> Loading your invitation…</p>}

          {invite === null && (
            <div className="pt-empty">
              <AlertTriangle size={26} />
              <h2 className="k-h3">This link isn’t valid</h2>
              <p>Please check the link, or email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
            </div>
          )}

          {invite && (ready ? (
            <div className="k-success">
              <span className="k-icon"><CheckCircle2 size={28} /></span>
              <h3>Welcome to the Collective</h3>
              <p>Your {invite.program_title} classroom is open.</p>
              <Link to={`/academy/${invite.program}`} className="k-btn k-btn--gold k-btn--block">Enter your classroom <ArrowRight size={18} /></Link>
            </div>
          ) : (
            <>
              <div className="en-plan">
                <p className="k-eyebrow" style={{ margin: 0 }}>{invite.program_title}</p>
                <p className="en-plan__price">{money(invite.price_cents)}<small>{per ? ` / ${per}` : invite.access_days ? ` · ${invite.access_days} days of access` : ''}</small></p>
                <p className="en-plan__label">{invite.plan_label}{invite.full_name ? ` · prepared for ${invite.full_name}` : ''}</p>
              </div>

              {invite.used ? <p className="k-error">This invitation has already been used. Sign in from the <Link to="/portal">member portal</Link>.</p>
                : invite.expired ? <p className="k-error">This invitation has expired. Ask your mentor for a new link.</p>
                : !invite.available ? <p className="k-error">This plan isn’t ready yet — please contact your mentor.</p>
                : user ? (
                  <div className="lg__form">
                    {returned === 'cancelled' && <p className="k-fine">Checkout was cancelled — you can try again whenever you’re ready.</p>}
                    {returned === 'success' && <p className="k-fine"><Loader2 size={14} className="k-spin" /> Payment received — opening your classroom…</p>}
                    <p className="lg__sub" style={{ margin: 0 }}>Signed in as <strong>{user.email}</strong>. This invitation is for {invite.email_hint}.</p>
                    {error && <p className="k-error" role="alert">{error}</p>}
                    {note && <p className="k-fine">{note}</p>}
                    <button className="k-btn k-btn--gold k-btn--lg k-btn--block" onClick={checkout} disabled={busy || returned === 'success'}>
                      {busy ? 'Opening secure checkout…' : <><ShieldCheck size={18} /> Continue to secure checkout</>}
                    </button>
                    <button type="button" className="lg__forgot" onClick={signOut}>Not you? Sign out</button>
                  </div>
                ) : (
                  <form className="lg__form" onSubmit={auth}>
                    <div className="lg__switch" role="tablist">
                      <button type="button" role="tab" aria-selected={mode === 'create'} onClick={() => setMode('create')}>Create account</button>
                      <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => setMode('signin')}>I have an account</button>
                    </div>
                    {mode === 'create' && (
                      <label className="lg__field"><span>Full name</span>
                        <div className="lg__input"><UserRound size={18} /><input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                      </label>
                    )}
                    <label className="lg__field"><span>Email ({invite.email_hint})</span>
                      <div className="lg__input"><Mail size={18} /><input type="email" required autoComplete="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    </label>
                    <label className="lg__field"><span>Password</span>
                      <div className="lg__input"><Lock size={18} /><input type="password" required minLength={8} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
                    </label>
                    {error && <p className="k-error" role="alert">{error}</p>}
                    {note && <p className="k-fine" role="status">{note}</p>}
                    <button className="k-btn k-btn--plum k-btn--lg k-btn--block" disabled={busy}>{busy ? 'One moment…' : mode === 'create' ? 'Create my account' : 'Sign in'}</button>
                  </form>
                )}
              <p className="lg__foot">Questions? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
            </>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Enroll;
