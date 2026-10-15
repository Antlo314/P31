import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Lock, ShieldCheck, FileSignature, HeartPulse, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SignatureField from '../../components/SignatureField';
import { todayLong } from '../../lib/forms';
import { CONTACT_EMAIL } from '../../lib/academy';
import { FORMS, ORDER, PACKAGES, GOOGLE_FORMS, COACHING_TERMS_VERSION, packagePrice } from '../../../supabase/functions/_shared/coaching-text.js';
import mark from '../../assets/academy/collective-mark.webp';
import './coaching.css';

const STEP = {
  coaching: { Icon: FileSignature, short: 'Coaching Agreement' },
  confidentiality: { Icon: Lock, short: 'Confidentiality' },
  safety: { Icon: HeartPulse, short: 'Safety & Emergency' },
};
const FRIENDLY = /^(Please|This link|Clients must|Unknown)/;

/** One agreement, section by section, word for word. */
const AgreementText = ({ doc, prices }) => (
  <div className="cf-terms">
    {doc.tagline && <p className="cf-tagline">{doc.tagline}</p>}
    {doc.intro.map((p) => <p key={p}>{p}</p>)}
    {doc.sections.map((s) => (
      <section key={s.title}>
        <h3>{s.title}</h3>
        {(s.paras || []).map((p) => <p key={p}>{p}</p>)}
        {s.items && <ul>{s.items.map((i) => <li key={i}>{i}</li>)}</ul>}
        {(s.paras2 || []).map((p) => <p key={p}>{p}</p>)}
        {s.items2 && <ul>{s.items2.map((i) => <li key={i}>{i}</li>)}</ul>}
        {s.packages && (
          <div className="cf-packages">
            {PACKAGES.map((p) => (
              <div key={p.key} className="cf-package">
                <small>{p.key}</small>
                <strong>{p.name}</strong>
                <b>{packagePrice(p.key, prices)}</b>
                <span>{p.cadence}</span>
                <p>{p.detail}</p>
              </div>
            ))}
          </div>
        )}
        {(s.after || []).map((p) => <p key={p}>{p}</p>)}
      </section>
    ))}
    {doc.coachNote && <p className="cf-coachnote">{doc.coachNote}</p>}
    {doc.coach && <p className="cf-coach">{doc.coach.map((l, i) => <React.Fragment key={l}>{i > 0 && <br />}{i === 0 ? <b>{l}</b> : l}</React.Fragment>)}</p>}
  </div>
);

/**
 * /coaching/forms/:token — a new private-coaching client's three forms, signed in order on one
 * private page: the Business Coaching Agreement, the Confidentiality Agreement, then the Client
 * Safety & Emergency Contact form. The link comes from a mentor; each signed form is emailed to
 * the team with a PDF copy to the client.
 */
const CoachingForms = () => {
  const { token } = useParams();
  const [intake, setIntake] = useState(undefined); // undefined loading, null not found
  const [f, setF] = useState({ full_name: '', package: '', agreed: false, signed_name: '', emergency_contact: '', address: '', phone: '', date_of_birth: '', trap: '' });
  const [sig, setSig] = useState(null);
  const [sigKey, setSigKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const fetchIntake = () => supabase.rpc('coaching_intake_details', { p_token: token }).then(({ data }) => {
    setIntake(data || null);
    if (data?.full_name) setF((x) => ({ ...x, full_name: x.full_name || data.full_name }));
  });
  useEffect(() => {
    supabase.rpc('coaching_intake_details', { p_token: token }).then(({ data }) => {
      setIntake(data || null);
      if (data?.full_name) setF((x) => ({ ...x, full_name: x.full_name || data.full_name }));
    });
  }, [token]);

  const signed = useMemo(() => intake?.signed || {}, [intake]);
  const prices = useMemo(() => Object.fromEntries((intake?.packages || []).map((p) => [p.key, p.price_cents])), [intake]);
  const current = ORDER.find((k) => !signed[k]) || null;
  const doc = current ? FORMS[current] : null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.full_name.trim().includes(' ')) return setError('Please enter your full name (first and last).');
    if (current === 'coaching' && !f.package) return setError('Please select your business coaching package.');
    if (current !== 'safety' && !f.agreed) return setError(`Please confirm you have read and agree to the ${doc.title}.`);
    setBusy(true);
    const answers = {
      full_name: f.full_name, signed_name: f.signed_name || f.full_name, signature: sig, agreed: f.agreed, trap: f.trap,
      ...(current === 'coaching' ? { package: f.package } : {}),
      ...(current === 'safety' ? { emergency_contact: f.emergency_contact, address: f.address, phone: f.phone, date_of_birth: f.date_of_birth } : {}),
    };
    const { error: err } = await supabase.rpc('coaching_form_sign', { p_token: token, p_kind: current, p: answers });
    setBusy(false);
    if (err) return setError(FRIENDLY.test(err.message) ? err.message : 'We could not save your form just now. Please try again in a moment.');
    supabase.functions.invoke('join-notify', { body: {} }).catch(() => {});
    setF((x) => ({ ...x, agreed: false, signed_name: '' })); setSig(null); setSigKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await fetchIntake();
  };

  if (intake === undefined) return <div className="cf"><p className="cf-loading"><Loader2 size={18} className="cf-spin" /> Loading your forms…</p></div>;

  // No valid link: nothing private is shown.
  if (!intake || intake.expired) {
    return (
      <div className="cf">
        <div className="cf-card cf-card--center">
          <img src={mark} alt="" className="cf-mark" />
          <p className="k-eyebrow">Private coaching</p>
          <h1>{intake?.expired ? 'This link has expired' : 'These forms are by invitation'}</h1>
          <p>{intake?.expired ? 'Ask your mentor for a fresh link and you can pick up where you left off.' : 'Your mentor sends you a private link to these forms after your intro call.'}</p>
          <div className="k-actions" style={{ justifyContent: 'center' }}>
            <Link to="/mentorship" className="k-btn k-btn--gold">Book an intro call <ArrowRight size={16} /></Link>
            <a className="k-btn k-btn--ghost" href={`mailto:${CONTACT_EMAIL}`}>Email the team</a>
          </div>
        </div>
      </div>
    );
  }

  const first = (intake.full_name || f.full_name || '').split(' ')[0];
  const done = !current;
  return (
    <div className="cf">
      <header className="cf-head">
        <img src={mark} alt="" className="cf-mark" />
        <div>
          <p className="k-eyebrow">The Proverbs 31 Collective by NEBA · Private coaching</p>
          <h1>{done ? `All signed, ${first || 'friend'}.` : `Welcome, ${first || 'friend'}.`}</h1>
          <p className="cf-lead">{done
            ? 'Your three forms are on file. A copy of each is on its way to your email as a PDF.'
            : 'Three forms, signed in order. Each one is emailed to you as a PDF once you sign it, and you can come back to this link to finish later.'}</p>
        </div>
      </header>

      <ol className="cf-steps" aria-label="Your forms">
        {ORDER.map((k, i) => {
          const { Icon, short } = STEP[k];
          const state = signed[k] ? 'done' : k === current ? 'now' : 'next';
          return (
            <li key={k} className={`cf-step is-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
              <span className="cf-step__n">{signed[k] ? <Check size={16} /> : i + 1}</span>
              <span><Icon size={14} /> {short}</span>
              {signed[k] && <small>Signed {new Date(`${signed[k].signed_on}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</small>}
            </li>
          );
        })}
      </ol>

      {done ? (
        <div className="cf-card cf-card--center">
          <span className="k-icon" style={{ margin: '0 auto' }}><CheckCircle2 size={26} /></span>
          <h2>What happens next</h2>
          <p>Your mentor will send your Payment Authorization details and your first session date. Your package: <b>{signed.coaching?.package || 'on file'}</b>.</p>
          <p className="k-fine">Questions? Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </div>
      ) : (
        <form className="cf-card" onSubmit={submit}>
          <p className="cf-stepline">Form {ORDER.indexOf(current) + 1} of 3</p>
          <h2>{doc.title}</h2>
          <p className="cf-sub">{doc.subtitle}</p>
          <AgreementText doc={doc} prices={prices} />

          {current === 'coaching' && (
            <fieldset className="cf-field">
              <legend>Select your business coaching package *</legend>
              <div className="cf-options">
                {PACKAGES.map((p) => (
                  <label key={p.key} className={`cf-option ${f.package === p.key ? 'is-on' : ''}`}>
                    <input type="radio" name="package" value={p.key} checked={f.package === p.key} onChange={set('package')} required />
                    <span><b>{p.key}</b> — {p.name}<small>{packagePrice(p.key, prices)} · {p.cadence}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {current === 'safety' && (
            <div className="cf-grid">
              <label className="k-field cf-wide"><span>Emergency contact (name, relationship, phone) *</span><textarea required rows={2} value={f.emergency_contact} onChange={set('emergency_contact')} placeholder="e.g. Angela Smith, sister, (404) 555-0100" /></label>
              <label className="k-field cf-wide"><span>Please provide your residential address *</span><input required autoComplete="street-address" value={f.address} onChange={set('address')} /></label>
              <label className="k-field"><span>Please provide your best contact number *</span><input required type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} /></label>
              <label className="k-field"><span>Please enter your date of birth *</span><input required type="date" value={f.date_of_birth} onChange={set('date_of_birth')} max={new Date().toISOString().slice(0, 10)} /></label>
            </div>
          )}

          <div className="cf-sign">
            <label className="k-field"><span>Your full name *</span><input required autoComplete="name" value={f.full_name} onChange={set('full_name')} placeholder="First and last name" /></label>
            {current !== 'safety' && (
              <label className="cf-agree"><input type="checkbox" checked={f.agreed} onChange={set('agreed')} required /> <span>I have read and agree to the {doc.title}.</span></label>
            )}
            <p className="cf-ack">{doc.ack}</p>
            <SignatureField key={sigKey} onChange={setSig} label="Your signature (optional, but welcome)" hint="Sign with your finger on a phone, or your mouse or trackpad on a computer. Your typed name above is your signature either way." />
            <p className="k-fine">Date signed: <b>{todayLong()}</b> · Terms version {COACHING_TERMS_VERSION} · Signing as <b>{intake.email}</b></p>
            <input className="k-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.trap} onChange={set('trap')} />
            {error && <p className="k-error" role="alert">{error}</p>}
            <button className="k-btn k-btn--gold k-btn--lg k-btn--block" disabled={busy}>
              {busy ? <><Loader2 size={18} className="cf-spin" /> Saving…</> : <><ShieldCheck size={18} /> {ORDER.indexOf(current) < 2 ? `Sign and continue to form ${ORDER.indexOf(current) + 2}` : 'Sign and finish'}</>}
            </button>
            <p className="k-fine cf-fallback">Trouble with this page? The same form is also on Google: <a href={GOOGLE_FORMS[current]} target="_blank" rel="noreferrer">open it there <ExternalLink size={12} /></a>, then let your mentor know.</p>
          </div>
        </form>
      )}
    </div>
  );
};

export default CoachingForms;
