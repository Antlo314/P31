import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowDown, Link2, Store, Megaphone, MessagesSquare, LifeBuoy, LayoutTemplate } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import SignatureField from '../../components/SignatureField';
import { EMAIL } from '../../lib/team';
import { submitForm, readSent, markSent, clearSent, todayLong, todayISO, signedInContact } from '../../lib/forms';
import { AGREEMENT, AGREEMENT_CONFIRM, AGREEMENT_VERSION } from './formText';
import { Chips, NameRow, ContactRow, Prefilled, Done, HelpLine, Trap } from './FormBits';

const SENT_KEY = 'p31_agreement_sent';
const BLANK = {
  business_name: '', first_name: '', last_name: '', email: '', phone: '',
  street: '', line2: '', city: '', state: '', zip: '', country: 'United States',
  agree: '', signed_name: '', trap: '',
};

/** The agreement, section by section, word for word. */
export const AgreementText = ({ compact = false }) => (
  <div className={`vf-terms ${compact ? 'vf-terms--in' : ''}`}>
    {AGREEMENT.map((s) => (
      <section key={s.title}>
        <h3>{s.title}</h3>
        {s.lead && <p>{s.lead}</p>}
        {s.items && <ul>{s.items.map((i) => <li key={i}>{i}</li>)}</ul>}
        {s.after && <p style={{ marginTop: s.items ? 10 : 0 }}>{s.after}</p>}
      </section>
    ))}
  </div>
);

const AgreementForm = () => {
  const [sent] = useState(() => readSent(SENT_KEY));
  const [f, setF] = useState(BLANK);
  const [sig, setSig] = useState(null);
  const [who, setWho] = useState(null);
  const [state, setState] = useState(sent ? 'done' : 'idle'); // idle | sending | done
  const [error, setError] = useState('');
  const [justSent, setJustSent] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const fullName = `${f.first_name} ${f.last_name}`.trim();

  useEffect(() => {
    signedInContact().then((w) => {
      if (!w) return;
      setWho(w);
      setF((x) => ({ ...x, email: x.email || w.email, first_name: x.first_name || w.first_name, last_name: x.last_name || w.last_name, business_name: x.business_name || w.business_name }));
    });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (f.agree !== 'I agree') return setError('Please confirm you have read and agree to the Proverbs 31 Virtual Marketplace Agreement terms.');
    if (!sig && !f.signed_name.trim()) return setError('Please sign the agreement in the signature box.');
    setState('sending');
    try {
      await submitForm('agreement', {
        business_name: f.business_name, first_name: f.first_name, last_name: f.last_name, email: f.email, phone: f.phone,
        address: { street: f.street, line2: f.line2, city: f.city, state: f.state, zip: f.zip, country: f.country },
        agreed: true, signature: sig, signed_name: f.signed_name.trim() || fullName, signed_on: todayISO(),
        terms_version: AGREEMENT_VERSION, source: 'agreement page', trap: f.trap,
      });
    } catch (err) { setError(err.message); setState('idle'); return; }
    markSent(SENT_KEY, { name: f.first_name, business: f.business_name, email: f.email, hasAccount: !!who?.curator });
    setJustSent(true);
    setState('done');
  };
  const startOver = () => { clearSent(SENT_KEY); setF(BLANK); setSig(null); setState('idle'); };

  if (state === 'done') {
    const d = justSent ? { name: f.first_name, business: f.business_name, email: f.email, hasAccount: !!who?.curator } : sent;
    return (
      <Done title="Your agreement is in" focus={justSent} again="Signing for another business? Start a new agreement" onAgain={startOver}>
        <p>Thank you, {d.name || 'friend'}. {d.hasAccount
          ? `The Storefront Agreement for ${d.business || 'your business'} is now on file with your curator account.`
          : 'Within 7–10 days you will receive a link to create your account and set up your storefront.'}</p>
        <p className="k-fine">A copy of what you agreed to is on its way to {d.email || 'your email'}. Questions? <a href={`mailto:${EMAIL.vendors}`}>{EMAIL.vendors}</a>.</p>
        {d.hasAccount && <Link to="/dashboard" className="k-btn k-btn--plum k-btn--sm">Open your studio <ArrowRight size={16} /></Link>}
      </Done>
    );
  }

  return (
    <form className="k-form jn-form" onSubmit={submit}>
      <Prefilled who={who} />
      <label className="k-field"><span>Business Name *</span><input required autoComplete="organization" value={f.business_name} onChange={set('business_name')} /></label>
      <NameRow f={f} set={set} />
      <ContactRow f={f} set={set} />

      <fieldset className="k-field jn-group">
        <legend>Business Address *</legend>
        <div className="k-form" style={{ gap: 10 }}>
          <label className="k-field"><span>Street Address</span><input required autoComplete="address-line1" value={f.street} onChange={set('street')} /></label>
          <label className="k-field"><span>Street Address Line 2</span><input autoComplete="address-line2" value={f.line2} onChange={set('line2')} /></label>
          <div className="k-row">
            <label className="k-field"><span>City</span><input required autoComplete="address-level2" value={f.city} onChange={set('city')} /></label>
            <label className="k-field"><span>State / Province</span><input required autoComplete="address-level1" value={f.state} onChange={set('state')} /></label>
          </div>
          <div className="k-row">
            <label className="k-field"><span>Postal / Zip Code</span><input required inputMode="numeric" autoComplete="postal-code" value={f.zip} onChange={set('zip')} /></label>
            <label className="k-field"><span>Country</span><input required autoComplete="country-name" value={f.country} onChange={set('country')} /></label>
          </div>
        </div>
      </fieldset>

      <h3 className="vf-h">The agreement <small>Read it below, then confirm and sign.</small></h3>
      <AgreementText compact />

      <Chips label={AGREEMENT_CONFIRM} required options={['I agree', 'I do not agree']} value={f.agree} onChange={(v) => setF((x) => ({ ...x, agree: v }))}>
        {f.agree === 'I do not agree' && (
          <p className="vf-note vf-note--warn" style={{ marginTop: 10 }}>
            A storefront can only be activated once the agreement is accepted. If something in it concerns you, write to <a href={`mailto:${EMAIL.vendors}`}>{EMAIL.vendors}</a> before signing.
          </p>
        )}
      </Chips>

      <SignatureField onChange={setSig} hint="Sign with your finger on a phone, or your mouse or trackpad on a computer. Your name below is kept with the signature." />
      <label className="k-field"><span>Your name, as signed</span>
        <input value={f.signed_name} onChange={set('signed_name')} placeholder={fullName || 'First and last name'} autoComplete="name" />
      </label>
      <p className="k-fine vf-date">Date Signed: <b>{todayLong()}</b> · Agreement version {AGREEMENT_VERSION}</p>

      <Trap f={f} set={set} />
      {error && <p className="k-error" role="alert">{error}</p>}
      <button className="k-btn k-btn--gold k-btn--lg k-btn--block" disabled={state === 'sending' || f.agree === 'I do not agree'}>
        {state === 'sending' ? 'Sending…' : <>Submit Agreement <ArrowRight size={18} /></>}
      </button>
      <HelpLine />
    </form>
  );
};

const BENEFITS = [
  [Link2, 'A direct storefront link to share'],
  [Store, 'Up to 10 products and/or services'],
  [Megaphone, 'P31 marketing: SEO, Google, Meta and social'],
  [MessagesSquare, 'A community chat with P31 women creatives'],
  [LifeBuoy, 'Web technical support for your storefront'],
  [LayoutTemplate, 'A professional storefront layout, your listings'],
];

// /vendors/agreement — the Proverbs 31 Marketplace Storefront Agreement Form.
const StorefrontAgreement = () => (
  <div className="k-page">
    <PageHeader
      eyebrow="P31 Virtual Marketplace"
      title="Storefront"
      accent="Agreement"
      lead="Complete this form to finalize your business storefront on P31 Virtual Marketplace."
      actions={<>
        <a href="#sign" className="k-btn k-btn--gold">Sign the agreement <ArrowDown size={18} /></a>
        <a href="#terms" className="k-btn k-btn--light">Read the terms</a>
      </>}
    />

    <section className="k-section" id="terms">
      <div className="k-split jn-split" style={{ alignItems: 'start' }}>
        <div className="k-head jn-about" style={{ marginBottom: 0 }}>
          <p className="k-eyebrow" data-reveal="fade">Proverbs 31 Marketplace Storefront Agreement Form</p>
          <h2 className="k-h2" data-split>What you <em>agree to</em></h2>
          <p className="k-body" data-reveal>
            Your storefront is complimentary for 3 months from activation, with a 5% transaction fee per sale. After that you can keep it for
            $14.99 a month, or cancel with two weeks’ notice. Everything else is spelled out below, word for word.
          </p>
          <p className="jn-elig" data-reveal>Within 7–10 days of submitting this form, you will receive a link to create your account and set up your storefront.</p>
        </div>
        <div className="vf-side">
          <div className="jn-benefits" data-reveal>
            <p className="k-eyebrow">P31 Storefront Benefits</p>
            <ul>{BENEFITS.map((b) => { const Icon = b[0]; return <li key={b[1]}><span className="k-icon"><Icon size={16} /></span>{b[1]}</li>; })}</ul>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 'clamp(22px, 3vw, 36px)' }} data-reveal><AgreementText /></div>
    </section>

    <section className="k-section k-section--mist" id="sign">
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Sign</p>
        <h2 className="k-h2" data-split>Storefront <em>agreement</em></h2>
        <p className="k-lede" data-reveal>Your details, the agreement, your signature. You will get a signed copy by email.</p>
      </div>
      <div className="jn-card" data-reveal><AgreementForm /></div>
    </section>
  </div>
);

export default StorefrontAgreement;
