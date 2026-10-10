import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Mail, Sparkles, CalendarHeart, BadgePercent, Mic, Store, HeartHandshake, Users, Star } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { supabase } from '../lib/supabase';
import { JOIN_FORM_URL } from '../lib/academy';
import { EMAIL } from '../lib/team';
import mark from '../assets/academy/collective-mark.png';
import './mentorship.css';
import './join.css';

// Word for word from the P31 Collective membership form.
const HEARD = ['P31 Vendor', 'P31 Panelist', 'P31 Collective Member', 'Social Media'];
const GROWTH = ['Business Development', 'Marketing', 'Networking', 'Leadership', 'Accountability', 'Faith/Obedience',
  'Personal Growth/Purpose', 'Healthy Lifestyle', 'Public Speaking'];
const INTERESTS = ['Private Faith-Based Mentorship', 'Healthy Lifestyle Coaching', 'Marketing Strategy Coaching',
  'P31 Marketplace virtual storefront', 'Not right now'];
const BENEFITS = [
  [CalendarHeart, 'Monthly in-person social meetups'],
  [BadgePercent, 'Vendor discounts for Proverbs 31 Marketplace events'],
  [Mic, 'Priority consideration for future panel speaking opportunities'],
  [Star, 'Member rate on Private Faith-Based Mentorship'],
  [Star, 'Member rate on Marketing Strategy Coaching'],
  [Star, 'Member rate on Healthy Lifestyle Coaching'],
  [Sparkles, 'Pop-up business informational calls'],
  [HeartHandshake, 'Monthly Community prayer and fasting'],
  [Sparkles, 'Quarterly Business Spotlight opportunities'],
  [Store, 'P31 Marketplace virtual business storefront'],
  [Users, 'Supportive community of Kingdom women in business'],
];
const TERMS = [
  'I am a female between the ages of 18 and 35 at the time of submission.',
  'I will maintain open and respectful communication with the P31 Team and within my sisterhood.',
  'I am expected to actively participate and engage within the P31 Collective community.',
  'My monthly membership contribution is my responsibility and is expected to be paid on time.',
  'Mentorship, Coaching services and P31 virtual storefront are completely optional and are not required for active membership.',
  'I do not have to remain a vendor to continue my membership with the Proverbs 31 Collective.',
];

const BLANK = {
  full_name: '', business_name: '', email: '', phone: '', city_state: '', birthday: '', socials: '',
  heard: '', heard_other: '', business_description: '', inspiration: '', growth_areas: [], interests: [], agreed: false, trap: '',
};

const JoinForm = () => {
  const [f, setF] = useState(BLANK);
  const [state, setState] = useState('idle'); // idle | sending | done
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const toggleGrowth = (g) => setF((x) => ({
    ...x,
    growth_areas: x.growth_areas.includes(g) ? x.growth_areas.filter((v) => v !== g) : x.growth_areas.length >= 4 ? x.growth_areas : [...x.growth_areas, g],
  }));
  // "Not right now" stands alone.
  const toggleInterest = (i) => setF((x) => {
    if (x.interests.includes(i)) return { ...x, interests: x.interests.filter((v) => v !== i) };
    if (i === 'Not right now') return { ...x, interests: [i] };
    return { ...x, interests: [...x.interests.filter((v) => v !== 'Not right now'), i] };
  });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.heard || (f.heard === 'Other' && !f.heard_other.trim())) return setError('Please tell us how you found our community.');
    if (!f.growth_areas.length) return setError('Choose up to 4 areas you hope to grow in.');
    if (!f.interests.length) return setError('Choose what you would be interested in (or “Not right now”).');
    if (!f.agreed) return setError('Please agree to the membership terms to apply.');
    setState('sending');
    const { heard, heard_other: other, ...rest } = f;
    const { error: err } = await supabase.rpc('submit_collective_application', {
      p: { ...rest, heard_from: heard === 'Other' ? `Other: ${other.trim()}` : heard, source: 'join page' },
    });
    if (err) {
      const friendly = /Please|Choose|getting a lot/.test(err.message);
      setError(friendly ? err.message : 'We couldn’t send your application just now. Please try again, or use the Google Form link below.');
      setState('idle');
      return;
    }
    setState('done');
  };

  if (state === 'done') {
    return (
      <div className="k-success jn-done">
        <span className="k-icon"><CheckCircle2 size={28} /></span>
        <h3>Your application is in</h3>
        <p>Thank you, {f.full_name.split(' ')[0] || 'sister'}. Once your application has been reviewed, you’ll receive the final step via email.</p>
        <p className="k-fine">Questions in the meantime? Email <a href={`mailto:${EMAIL.members}`}>{EMAIL.members}</a>.</p>
      </div>
    );
  }

  return (
    <form className="k-form jn-form" onSubmit={submit} noValidate={false}>
      <div className="k-row">
        <label className="k-field"><span>First and Last Name *</span>
          <input required autoComplete="name" value={f.full_name} onChange={set('full_name')} />
        </label>
        <label className="k-field"><span>Name of your Business or Ministry</span>
          <input autoComplete="organization" value={f.business_name} onChange={set('business_name')} />
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
      <div className="k-row">
        <label className="k-field"><span>City &amp; State *</span>
          <input required autoComplete="address-level2" value={f.city_state} onChange={set('city_state')} placeholder="e.g. Lawrenceville, GA" />
        </label>
        <label className="k-field"><span>Birthday (Month / Day) *</span>
          <input required value={f.birthday} onChange={set('birthday')} placeholder="e.g. March 14" maxLength={20} />
        </label>
      </div>
      <label className="k-field"><span>Social Media Handle(s)</span>
        <input value={f.socials} onChange={set('socials')} placeholder="@yourbusiness" />
      </label>

      <fieldset className="k-field jn-group">
        <legend>How did you find out about our community? *</legend>
        <div className="jn-chips">
          {[...HEARD, 'Other'].map((h) => (
            <button type="button" key={h} className="jn-chip" aria-pressed={f.heard === h} onClick={() => setF({ ...f, heard: h })}>{h}</button>
          ))}
        </div>
        {f.heard === 'Other' && <input className="jn-other" value={f.heard_other} onChange={set('heard_other')} placeholder="Tell us where" aria-label="Other: where you found us" />}
      </fieldset>

      <label className="k-field"><span>Briefly describe your business.</span>
        <textarea rows={3} value={f.business_description} onChange={set('business_description')} />
      </label>
      <label className="k-field"><span>What inspired you to join the P31 Collective?</span>
        <textarea rows={3} value={f.inspiration} onChange={set('inspiration')} />
      </label>

      <fieldset className="k-field jn-group">
        <legend>What area are you hoping to grow in most? (Select your top 4) * <small>{f.growth_areas.length}/4</small></legend>
        <div className="jn-chips">
          {GROWTH.map((g) => {
            const on = f.growth_areas.includes(g);
            return <button type="button" key={g} className="jn-chip" aria-pressed={on} disabled={!on && f.growth_areas.length >= 4} onClick={() => toggleGrowth(g)}>{g}</button>;
          })}
        </div>
      </fieldset>

      <fieldset className="k-field jn-group">
        <legend>Once you begin membership, which of the following would you be interested in: *</legend>
        <div className="jn-chips">
          {INTERESTS.map((i) => <button type="button" key={i} className="jn-chip" aria-pressed={f.interests.includes(i)} onClick={() => toggleInterest(i)}>{i}</button>)}
        </div>
      </fieldset>

      <div className="jn-terms">
        <p><b>By submitting this form, I understand and agree that:</b></p>
        <ul>{TERMS.map((t) => <li key={t}>{t}</li>)}</ul>
        <label className="jn-agree">
          <input type="checkbox" checked={f.agreed} onChange={(e) => setF({ ...f, agreed: e.target.checked })} />
          <span>Yes, I understand and agree. *</span>
        </label>
      </div>

      <input className="k-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.trap} onChange={set('trap')} />
      {error && <p className="k-error" role="alert">{error}</p>}
      <button className="k-btn k-btn--gold k-btn--lg k-btn--block" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : <>Submit my application <ArrowRight size={18} /></>}
      </button>
      <p className="k-fine jn-alt">
        <Mail size={13} /> Questions? <a href={`mailto:${EMAIL.members}`}>{EMAIL.members}</a>
        {' · '}Having trouble? <a href={JOIN_FORM_URL} target="_blank" rel="noopener noreferrer">Use the Google Form instead</a>
      </p>
    </form>
  );
};

// /join — the P31 Collective membership application.
const Join = () => (
  <div className="k-page">
    <PageHeader
      eyebrow="Proverbs 31 Collective by NEBA"
      title="Join the"
      accent="P31 Collective"
      lead="A faith-centered community for women entrepreneurs who desire to grow spiritually, purposefully, and professionally while building meaningful relationships with like-minded women."
      actions={<a href="#apply" className="k-btn k-btn--gold">Apply to join <ArrowRight size={18} /></a>}
    />

    <section className="k-section">
      <div className="k-split jn-split" style={{ alignItems: 'start' }}>
        <div className="k-head jn-about" style={{ marginBottom: 0 }}>
          <img src={mark} alt="" className="mt-mark" data-reveal="scale" />
          <p className="k-eyebrow" data-reveal="fade">Membership</p>
          <h2 className="k-h2" data-split>Created with <em>you</em> in mind</h2>
          <p className="k-body" data-reveal>
            Whether you’re launching a new business, growing an existing one, or looking for a supportive community that understands
            your journey, the P31 Collective was created with you in mind.
          </p>
          <div className="jn-price" data-reveal>
            <strong>$27<small>/month</small></strong>
            <span>No long-term commitment. You may cancel at any time with no cancellation fees. We simply ask for a minimum of 7 days’
              courtesy notice prior to your next billing date.</span>
          </div>
          <p className="jn-elig" data-reveal><b>Eligibility:</b> Applicants must be between the ages of 18 and 35 years old at the time this form
            is submitted. Unfortunately, individuals outside this age range are not eligible for membership with P31 Collective at this time.</p>
        </div>
        <div className="jn-benefits" data-reveal>
          <p className="k-eyebrow">Exclusive member benefits</p>
          <ul>
            {BENEFITS.map((b) => { const Icon = b[0]; return <li key={b[1]}><span className="k-icon"><Icon size={16} /></span>{b[1]}</li>; })}
          </ul>
        </div>
      </div>
    </section>

    <section className="k-section k-section--mist" id="apply">
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Apply</p>
        <h2 className="k-h2" data-split>Your <em>application</em></h2>
        <p className="k-lede" data-reveal>To join, complete the form below. Once your application has been reviewed, you’ll receive the final step via email.</p>
      </div>
      <div className="jn-card" data-reveal><JoinForm /></div>
    </section>
  </div>
);

export default Join;
