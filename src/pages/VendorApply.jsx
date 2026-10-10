import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Mail, CalendarDays, MapPin, Store, HeartHandshake, Sparkles } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { supabase } from '../lib/supabase';
import { EMAIL } from '../lib/team';
import { fetchUpcomingEvents, formatEventDate, showDate } from '../lib/events';
import '../academy/mentorship.css';
import '../academy/join.css';

// Word for word from the Proverbs 31 Market vendor interest form (Google Form kept as a backup).
export const VENDOR_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSd01zHJUEqZV59puRf5YRrBsg05bT__mAsefYuy6bhQ5ef-oA/viewform';
const CATEGORIES = [
  'Natural body care products', 'Apparel, Accessories, Jewelry (no on-site piercing)',
  'Wellness goods, Tea blends, Herbs (pre-packaged only)', 'Art, Painting, Photography',
  'Professional Services (Home, Health Care, Legal, Financial, Travel, Educational)', 'Baked goods, Wrapped candies & treats',
  'Candles & Home fragrance', 'Handmade crafts, baskets & gifts', 'Pet products (no pets allowed; indoor event)',
  'Coaching, Books, Journals, Devotionals (Self-written)', 'Crafts, Home décor (non-electrical)',
  'Plants (non-toxic, potted only)', 'Make-up Artist',
];
const TERMS = [
  'You identify as a woman-led business or brand',
  'You are interested in participating as a vendor in future Proverbs 31 Market events',
  'You are able to attend in-person events',
  'You give consent to be contacted by P31 Marketplace organization.',
];
const BLANK = {
  serious: '', full_name: '', business_name: '', email: '', phone: '', website_social: '', referred_by: '',
  categories: [], other_on: false, category_other: '', notes: '', agreed: false, trap: '',
};

// After applying, this device shows the confirmation (not a blank form) for 30 days.
const SENT_KEY = 'p31_vendor_sent';
const readSent = () => {
  try {
    const v = JSON.parse(localStorage.getItem(SENT_KEY) || 'null');
    return v && Date.now() - v.at < 30 * 864e5 ? v : null;
  } catch { return null; }
};
const today = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const VendorForm = () => {
  const [sent] = useState(readSent);
  const [f, setF] = useState(() => (sent ? { ...BLANK, full_name: sent.name || '' } : BLANK));
  const [state, setState] = useState(sent ? 'done' : 'idle'); // idle | sending | done
  const [error, setError] = useState('');
  const doneRef = useRef(null);
  const justSent = useRef(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const picked = f.categories.length + (f.other_on ? 1 : 0);

  // Bring the confirmation into view (the form above it is long) and give it focus.
  useEffect(() => {
    if (state !== 'done' || !justSent.current || !doneRef.current) return;
    const el = doneRef.current;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'start', behavior: 'instant' });
      el.focus({ preventScroll: true });
    }));
  }, [state]);

  const toggleCategory = (c) => setF((x) => (x.categories.includes(c)
    ? { ...x, categories: x.categories.filter((v) => v !== c) }
    : x.categories.length + (x.other_on ? 1 : 0) >= 2 ? x : { ...x, categories: [...x.categories, c] }));
  const toggleOther = () => setF((x) => (x.other_on ? { ...x, other_on: false, category_other: '' }
    : x.categories.length >= 2 ? x : { ...x, other_on: true }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.serious) return setError('Please answer whether you are serious about joining and participating in this community.');
    if (!picked) return setError('Choose up to 2 categories that describe what you sell or offer.');
    if (f.other_on && !f.category_other.trim()) return setError('Tell us your other category, or unselect “Other”.');
    if (!f.agreed) return setError('Please agree to the vendor terms to apply.');
    setState('sending');
    const { other_on: otherOn, category_other: other, ...rest } = f;
    const { error: err } = await supabase.rpc('submit_vendor_application', {
      p: { ...rest, category_other: otherOn ? other.trim() : '', source: 'apply page' },
    });
    if (err) {
      const friendly = /Please|Choose|getting a lot/.test(err.message);
      setError(friendly ? err.message : 'We couldn’t send your application just now. Please try again, or use the Google Form link below.');
      setState('idle');
      return;
    }
    // Hand it to the team: an email and a row in P31's Google Sheet (each sent once).
    supabase.functions.invoke('join-notify', { body: {} }).catch(() => {});
    try { localStorage.setItem(SENT_KEY, JSON.stringify({ name: f.full_name.split(' ')[0], at: Date.now() })); } catch { /* private mode */ }
    justSent.current = true;
    setState('done');
  };

  const startOver = () => {
    try { localStorage.removeItem(SENT_KEY); } catch { /* private mode */ }
    setF(BLANK);
    setState('idle');
  };

  if (state === 'done') {
    return (
      <div className="k-success jn-done" ref={doneRef} tabIndex={-1} role="status" aria-live="polite">
        <span className="k-icon"><CheckCircle2 size={28} /></span>
        <h3>Your vendor application is in</h3>
        <p>Thank you, {f.full_name.split(' ')[0] || 'friend'}. Official acceptance and event details will be emailed to you.</p>
        <p className="k-fine">Questions in the meantime? Email <a href={`mailto:${EMAIL.vendors}`}>{EMAIL.vendors}</a>.</p>
        <button type="button" className="jn-again" onClick={startOver}>Applying for another brand? Start a new application</button>
      </div>
    );
  }

  return (
    <form className="k-form jn-form" onSubmit={submit}>
      <fieldset className="k-field jn-group">
        <legend className="vp-verse">
          <em>“Give her of the fruit of her hands; And let her own works praise her in the gates.”</em> <small>Proverbs 31:31 KJV</small>
          <span>Are you a woman who is serious about joining and participating in this community? *</span>
        </legend>
        <div className="jn-chips">
          {['Yes', 'No'].map((v) => <button type="button" key={v} className="jn-chip" aria-pressed={f.serious === v} onClick={() => setF({ ...f, serious: v })}>{v}</button>)}
        </div>
      </fieldset>

      <div className="k-row">
        <label className="k-field"><span>Full Name *</span>
          <input required autoComplete="name" value={f.full_name} onChange={set('full_name')} />
        </label>
        <label className="k-field"><span>Business / Brand Name *</span>
          <input required autoComplete="organization" value={f.business_name} onChange={set('business_name')} />
        </label>
      </div>
      <div className="k-row">
        <label className="k-field"><span>Email Address *</span>
          <input required type="email" inputMode="email" autoComplete="email" value={f.email} onChange={set('email')} />
        </label>
        <label className="k-field"><span>Phone Number *</span>
          <input required type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} />
        </label>
      </div>
      <label className="k-field"><span>Website/Social Media Handle *</span>
        <textarea required rows={2} value={f.website_social} onChange={set('website_social')} placeholder="yourbrand.com · @yourbrand" />
      </label>
      <label className="k-field"><span>If you were referred by another Vendor, please enter their first and last name here. (Optional)</span>
        <input value={f.referred_by} onChange={set('referred_by')} />
      </label>

      <fieldset className="k-field jn-group">
        <legend>What best describes what you sell or offer? (Choose up to 2 categories) * <small>{picked}/2</small></legend>
        <div className="jn-chips">
          {CATEGORIES.map((c) => {
            const on = f.categories.includes(c);
            return <button type="button" key={c} className="jn-chip" aria-pressed={on} disabled={!on && picked >= 2} onClick={() => toggleCategory(c)}>{c}</button>;
          })}
          <button type="button" className="jn-chip" aria-pressed={f.other_on} disabled={!f.other_on && picked >= 2} onClick={toggleOther}>Other</button>
        </div>
        {f.other_on && <input className="jn-other" value={f.category_other} onChange={set('category_other')} placeholder="What do you sell or offer?" aria-label="Other category" maxLength={120} />}
      </fieldset>

      <label className="k-field"><span>Anything you’d like us to know? (Optional)</span>
        <textarea rows={3} value={f.notes} onChange={set('notes')} />
      </label>

      <div className="jn-terms">
        <p><b>By submitting this form, you agree that:</b></p>
        <ul>{TERMS.map((t) => <li key={t}>{t}</li>)}</ul>
        <label className="jn-agree">
          <input type="checkbox" checked={f.agreed} onChange={(e) => setF({ ...f, agreed: e.target.checked })} />
          <span>I Agree *</span>
        </label>
      </div>
      <p className="k-fine vp-date">Today’s Date: <b>{today()}</b></p>

      <input className="k-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.trap} onChange={set('trap')} />
      {error && <p className="k-error" role="alert">{error}</p>}
      <button className="k-btn k-btn--gold k-btn--lg k-btn--block" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : <>Submit my vendor application <ArrowRight size={18} /></>}
      </button>
      <p className="k-fine jn-alt">
        <Mail size={13} /> Questions? <a href={`mailto:${EMAIL.vendors}`}>{EMAIL.vendors}</a>
        {' · '}Having trouble? <a href={VENDOR_FORM_URL} target="_blank" rel="noopener noreferrer">Use the Google Form instead</a>
      </p>
    </form>
  );
};

// The next market, if one is scheduled (its date shows once the team announces it).
const NextMarket = () => {
  const [ev, setEv] = useState(undefined);
  useEffect(() => { fetchUpcomingEvents().then((list) => setEv(list[0] || null)); }, []);
  if (ev === undefined) return null;
  return (
    <div className="jn-benefits vp-next" data-reveal>
      <p className="k-eyebrow">Next market</p>
      {ev ? (
        <ul>
          <li><span className="k-icon"><Store size={16} /></span><b>{ev.title}</b></li>
          <li><span className="k-icon"><CalendarDays size={16} /></span>{showDate(ev) ? formatEventDate(ev.event_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Date coming soon'}</li>
          {ev.venue && <li><span className="k-icon"><MapPin size={16} /></span>{ev.venue}</li>}
        </ul>
      ) : <p className="k-body">New dates are announced on <Link to="/calendar">Market dates</Link>.</p>}
    </div>
  );
};

// /apply — vendor interest form for the Proverbs 31 Market.
const VendorApply = () => (
  <div className="k-page">
    <PageHeader
      eyebrow="Proverbs 31 Market"
      title="Become a"
      accent="vendor"
      lead="A faith-centered marketplace created to uplift, support, and showcase women-led brands and artisans."
      actions={<a href="#apply" className="k-btn k-btn--gold">Apply to vend <ArrowRight size={18} /></a>}
    />

    <section className="k-section">
      <div className="k-split jn-split" style={{ alignItems: 'start' }}>
        <div className="k-head jn-about" style={{ marginBottom: 0 }}>
          <p className="k-eyebrow" data-reveal="fade">Vendor interest</p>
          <h2 className="k-h2" data-split>Thank you for your <em>interest</em></h2>
          <p className="k-body" data-reveal>
            Thank you for your interest in participating in the Proverbs 31 Market — a faith-centered marketplace created to uplift,
            support, and showcase women-led brands and artisans.
          </p>
          <p className="jn-elig" data-reveal>This form is simply to gather information of interested individuals. Official acceptance and
            event details will be emailed to you.</p>
        </div>
        <div className="vp-side">
          <NextMarket />
          <div className="jn-benefits" data-reveal>
            <p className="k-eyebrow">Why vend with P31</p>
            <ul>
              <li><span className="k-icon"><HeartHandshake size={16} /></span>A community of Kingdom women in business</li>
              <li><span className="k-icon"><Sparkles size={16} /></span>Curated, faith-centered markets that honor your work</li>
              <li><span className="k-icon"><Store size={16} /></span>A path to your own P31 Marketplace storefront</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section className="k-section k-section--mist" id="apply">
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Apply</p>
        <h2 className="k-h2" data-split>Vendor <em>application</em></h2>
        <p className="k-lede" data-reveal>Complete the form below. Official acceptance and event details will be emailed to you.</p>
      </div>
      <div className="jn-card" data-reveal><VendorForm /></div>
    </section>
  </div>
);

export default VendorApply;
