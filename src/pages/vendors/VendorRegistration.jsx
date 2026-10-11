import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowDown, ImagePlus, Clock, Table2, Phone, Ban } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import SignatureField from '../../components/SignatureField';
import { EMAIL } from '../../lib/team';
import { submitForm, uploadLogo, readSent, markSent, clearSent, todayLong, todayISO, signedInContact } from '../../lib/forms';
import { RULES, RULES_INTRO, RULES_SIGN } from './formText';
import { NameRow, ContactRow, MarketPicker, Prefilled, Done, HelpLine, Trap } from './FormBits';

const SENT_KEY = 'p31_registration_sent';
const BLANK = { business_name: '', first_name: '', last_name: '', email: '', phone: '', website: '', social: '', products: '', signed_name: '', trap: '' };
const NO_MARKET = { eventId: null, label: '', other: false };

/** The Vendor Rules & Regulations, word for word. */
export const RulesText = ({ compact = false }) => (
  <div className={`vf-terms ${compact ? 'vf-terms--in' : ''}`}>
    <p className="vf-lead" style={{ textAlign: compact ? 'left' : 'center', margin: compact ? '0 0 4px' : undefined }}>{RULES_INTRO}</p>
    {RULES.map((s) => (
      <section key={s.title}>
        <h3>{s.title}</h3>
        {s.lead && <p>{s.lead}</p>}
        {s.items && <ul>{s.items.map((i) => <li key={i}>{i}</li>)}</ul>}
        {s.after && <p>{s.after}</p>}
      </section>
    ))}
  </div>
);

const RegistrationForm = () => {
  const [sent] = useState(() => readSent(SENT_KEY));
  const [f, setF] = useState(BLANK);
  const [market, setMarket] = useState(NO_MARKET);
  const [sig, setSig] = useState(null);
  const [logo, setLogo] = useState(null);
  const [preview, setPreview] = useState('');
  const [who, setWho] = useState(null);
  const [state, setState] = useState(sent ? 'done' : 'idle'); // idle | uploading | sending | done
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
  // The preview URL is made when the file is picked and released when it changes or the form unmounts.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pickLogo = (e) => {
    const file = e.target.files?.[0] || null;
    setLogo(file);
    setPreview(file ? URL.createObjectURL(file) : '');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!market.eventId && market.label.trim().length < 3) return setError('Please tell us the month and year of the event you’re registering for.');
    if (!sig && !f.signed_name.trim()) return setError('Please sign below to agree to the Vendor Rules & Regulations.');
    if (!logo) return setError('Please upload your business logo (PNG, JPG or WebP, up to 5 MB).');
    let logoUrl = null;
    try {
      setState('uploading');
      logoUrl = await uploadLogo(logo);
      setState('sending');
      await submitForm('registration', {
        event_id: market.eventId, event_label: market.label, business_name: f.business_name, first_name: f.first_name, last_name: f.last_name,
        email: f.email, phone: f.phone, website: f.website, social: f.social, products: f.products, logo_url: logoUrl,
        agreed: true, signature: sig, signed_name: f.signed_name.trim() || fullName, signed_on: todayISO(), source: 'register page', trap: f.trap,
      });
    } catch (err) { setError(err.message); setState('idle'); return; }
    markSent(SENT_KEY, { name: f.first_name, business: f.business_name, email: f.email, label: market.label });
    setJustSent(true);
    setState('done');
  };
  const startOver = () => { clearSent(SENT_KEY); setF(BLANK); setMarket(NO_MARKET); setSig(null); setLogo(null); setPreview(''); setState('idle'); };

  if (state === 'done') {
    const d = justSent ? { name: f.first_name, business: f.business_name, email: f.email, label: market.label } : sent;
    return (
      <Done title="You’re registered" focus={justSent} again="Registering another business or another market? Start a new registration" onAgain={startOver}>
        <p>Thank you, {d.name || 'friend'}. {d.business || 'Your business'} is registered for <b>{d.label || 'the market'}</b>. The market team will confirm your space and email booth placement, load-in time and payment details.</p>
        <p className="k-fine">A copy of the rules you signed is on its way to {d.email || 'your email'}. On market day, check in no later than 3:15 PM. Questions? <a href={`mailto:${EMAIL.vendors}`}>{EMAIL.vendors}</a>.</p>
        <Link to="/vendors/agreement" className="k-btn k-btn--plum k-btn--sm">No storefront yet? Sign the Storefront Agreement <ArrowRight size={16} /></Link>
      </Done>
    );
  }

  const busy = state === 'uploading' || state === 'sending';
  return (
    <form className="k-form jn-form" onSubmit={submit}>
      <Prefilled who={who} />
      <MarketPicker label="Please specify the month/year of the event you’re registering for:" which="upcoming" value={market} onChange={setMarket} />
      <label className="k-field"><span>Business Name *</span><input required autoComplete="organization" value={f.business_name} onChange={set('business_name')} /></label>
      <NameRow f={f} set={set} label="Contact Person’s Full Name" />
      <ContactRow f={f} set={set} phoneLabel="Contact Phone Number" />
      <div className="k-row">
        <label className="k-field"><span>Business Website (if any)</span><input type="url" inputMode="url" autoComplete="url" placeholder="https://" value={f.website} onChange={set('website')} /></label>
        <label className="k-field"><span>Social Media</span><input value={f.social} onChange={set('social')} placeholder="@yourbrand" /></label>
      </div>
      <label className="k-field"><span>Brief description of Products or Services you will be offering on event day *</span>
        <textarea required rows={3} value={f.products} onChange={set('products')} />
      </label>

      <h3 className="vf-h">Vendor Rules &amp; Regulations <small>Read them, then sign below.</small></h3>
      <RulesText compact />

      <p className="vf-note">{RULES_SIGN}</p>
      <SignatureField onChange={setSig} />
      <label className="k-field"><span>Your name, as signed</span>
        <input value={f.signed_name} onChange={set('signed_name')} placeholder={fullName || 'First and last name'} autoComplete="name" />
      </label>
      <p className="k-fine vf-date">Date: <b>{todayLong()}</b></p>

      <label className={`vf-upload ${logo ? 'has-file' : ''}`}>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} />
        {preview ? <img src={preview} alt="Your business logo" /> : <span className="k-icon"><ImagePlus size={22} /></span>}
        <strong>{logo ? logo.name : 'Upload your Business logo *'}</strong>
        <small>{logo ? 'Tap to choose a different file' : 'PNG, JPG or WebP, up to 5 MB. It appears next to your name on the market lineup.'}</small>
      </label>

      <Trap f={f} set={set} />
      {error && <p className="k-error" role="alert">{error}</p>}
      <button className="k-btn k-btn--gold k-btn--lg k-btn--block" disabled={busy}>
        {state === 'uploading' ? 'Uploading your logo…' : state === 'sending' ? 'Sending…' : <>Register <ArrowRight size={18} /></>}
      </button>
      <HelpLine />
    </form>
  );
};

const QUICK = [
  [Clock, 'Check in no later than 3:15 PM; late arrivals cannot set up'],
  [Table2, 'Your own 6-foot table and floor-length covering; one table, two chairs, one assistant'],
  [Ban, 'Indoor event: no tents or canopies, no cooking, no open samples, no speakers'],
  [Phone, 'Emergency on the day: 470-562-2852'],
];

// /vendors/register — the P31 Marketplace Vendor Reservation (registration + rules + signature + logo).
const VendorRegistration = () => (
  <div className="k-page">
    <PageHeader
      eyebrow="Vendor Registration Form"
      title="P31 Marketplace Vendor"
      accent="Reservation"
      lead="Complete the registration and agreement below."
      actions={<>
        <a href="#register" className="k-btn k-btn--gold">Register <ArrowDown size={18} /></a>
        <a href="#rules" className="k-btn k-btn--light">Read the rules</a>
      </>}
    />

    <section className="k-section" id="rules">
      <div className="k-split jn-split" style={{ alignItems: 'start' }}>
        <div className="k-head jn-about" style={{ marginBottom: 0 }}>
          <p className="k-eyebrow" data-reveal="fade">Vendor Rules &amp; Regulations</p>
          <h2 className="k-h2" data-split>A professional, welcoming <em>market</em></h2>
          <p className="k-body" data-reveal>{RULES_INTRO}</p>
          <p className="jn-elig" data-reveal>Registration takes about five minutes: your details, the rules, your signature, and your logo for the lineup.</p>
        </div>
        <div className="vf-side">
          <div className="jn-benefits" data-reveal>
            <p className="k-eyebrow">Market day, in short</p>
            <ul>{QUICK.map((b) => { const Icon = b[0]; return <li key={b[1]}><span className="k-icon"><Icon size={16} /></span>{b[1]}</li>; })}</ul>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 'clamp(22px, 3vw, 36px)' }} data-reveal><RulesText /></div>
    </section>

    <section className="k-section k-section--mist" id="register">
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Register</p>
        <h2 className="k-h2" data-split>Reserve your <em>space</em></h2>
        <p className="k-lede" data-reveal>Your details, the rules, your signature, your logo. You will get a copy by email.</p>
      </div>
      <div className="jn-card" data-reveal><RegistrationForm /></div>
    </section>
  </div>
);

export default VendorRegistration;
