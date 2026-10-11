import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowDown, CheckCircle2, HandHeart, Users, Camera, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import SignatureField from '../../components/SignatureField';
import { EMAIL, OFFICE } from '../../lib/team';
import { submitForm, readSent, markSent, clearSent, todayLong, todayISO, signedInContact } from '../../lib/forms';
import { VOLUNTEER_INTRO, VOLUNTEER_ACK } from './formText';
import { NameRow, ContactRow, MarketPicker, Prefilled, Done, HelpLine, Trap } from './FormBits';

const SENT_KEY = 'p31_volunteer_sent';
const BLANK = { first_name: '', last_name: '', email: '', phone: '', emergency_contact: '', acknowledged: false, signed_name: '', trap: '' };
const NO_MARKET = { eventId: null, label: '', other: false };

const VolunteerForm = () => {
  const [sent] = useState(() => readSent(SENT_KEY));
  const [f, setF] = useState(BLANK);
  const [market, setMarket] = useState(NO_MARKET);
  const [sig, setSig] = useState(null);
  const [who, setWho] = useState(null);
  const [state, setState] = useState(sent ? 'done' : 'idle');
  const [error, setError] = useState('');
  const [justSent, setJustSent] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const fullName = `${f.first_name} ${f.last_name}`.trim();

  useEffect(() => {
    signedInContact().then((w) => {
      if (!w) return;
      setWho(w);
      setF((x) => ({ ...x, email: x.email || w.email, first_name: x.first_name || w.first_name, last_name: x.last_name || w.last_name }));
    });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.acknowledged) return setError('Please acknowledge the statements above to continue.');
    if (!sig && !f.signed_name.trim()) return setError('Please sign in the signature box.');
    setState('sending');
    try {
      await submitForm('volunteer', {
        event_id: market.eventId, first_name: f.first_name, last_name: f.last_name, email: f.email, phone: f.phone, emergency_contact: f.emergency_contact,
        acknowledged: true, signature: sig, signed_name: f.signed_name.trim() || fullName, signed_on: todayISO(), source: 'volunteer page', trap: f.trap,
      });
    } catch (err) { setError(err.message); setState('idle'); return; }
    markSent(SENT_KEY, { name: f.first_name, email: f.email });
    setJustSent(true);
    setState('done');
  };
  const startOver = () => { clearSent(SENT_KEY); setF(BLANK); setMarket(NO_MARKET); setSig(null); setState('idle'); };

  if (state === 'done') {
    const d = justSent ? { name: f.first_name, email: f.email } : sent;
    return (
      <Done title="Thank you for serving with us" focus={justSent} again="Signing for someone else? Start a new acknowledgment" onAgain={startOver}>
        <p>Thank you, {d.name || 'friend'}. Your acknowledgment is in. The market team will reach out with your assignment and arrival time.</p>
        <p className="k-fine">A copy is on its way to {d.email || 'your email'}. Questions? <a href={`mailto:${EMAIL.community}`}>{EMAIL.community}</a> · {OFFICE.phone}</p>
      </Done>
    );
  }

  return (
    <form className="k-form jn-form" onSubmit={submit}>
      <Prefilled who={who} />
      <NameRow f={f} set={set} label="Name" />
      <ContactRow f={f} set={set} emailLabel="Email" />
      <label className="k-field"><span>In the case of an emergency, who should we contact for you? (Name &amp; Phone number) *</span>
        <input required value={f.emergency_contact} onChange={set('emergency_contact')} placeholder="Name · (000) 000-0000" />
      </label>
      <MarketPicker label="Which market will you serve at?" which="upcoming" value={market} onChange={setMarket} required={false} hint="Optional. Leave it blank if you are not sure yet." />

      <div className="jn-terms">
        <p><b>{VOLUNTEER_INTRO}</b></p>
        <ul className="vf-ack">{VOLUNTEER_ACK.map((t) => <li key={t}><CheckCircle2 size={16} /> <span>{t}</span></li>)}</ul>
        <label className="jn-agree">
          <input type="checkbox" checked={f.acknowledged} onChange={(e) => setF((x) => ({ ...x, acknowledged: e.target.checked }))} />
          <span>I acknowledge and agree to the five statements above *</span>
        </label>
      </div>

      <SignatureField onChange={setSig} />
      <label className="k-field"><span>Your name, as signed</span>
        <input value={f.signed_name} onChange={set('signed_name')} placeholder={fullName || 'First and last name'} autoComplete="name" />
      </label>
      <p className="k-fine vf-date">Today’s Date: <b>{todayLong()}</b></p>

      <Trap f={f} set={set} />
      {error && <p className="k-error" role="alert">{error}</p>}
      <button className="k-btn k-btn--gold k-btn--lg k-btn--block" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : <>Submit acknowledgment <ArrowRight size={18} /></>}
      </button>
      <HelpLine email={EMAIL.community} />
    </form>
  );
};

const WHAT = [
  [Users, 'Welcome guests and point them to the vendors'],
  [HandHeart, 'Support curators with setup, breakdown and the small things'],
  [Camera, 'Help the day run beautifully; you may appear in event photos'],
  [ShieldCheck, 'Follow the safety guidelines and the organizer’s lead'],
];

// /volunteer — Proverbs 31 Marketplace Volunteer: Day-of-Event Acknowledgment.
const Volunteer = () => (
  <div className="k-page">
    <PageHeader
      eyebrow="Proverbs 31 Marketplace Volunteer"
      title="Day-of-Event"
      accent="Acknowledgment"
      lead="Serve at a market: welcome guests, support curators, help the day run beautifully."
      actions={<a href="#volunteer" className="k-btn k-btn--gold">Sign up to volunteer <ArrowDown size={18} /></a>}
    />
    <section className="k-section">
      <div className="k-split jn-split" style={{ alignItems: 'start' }}>
        <div className="k-head jn-about" style={{ marginBottom: 0 }}>
          <p className="k-eyebrow" data-reveal="fade">Volunteer</p>
          <h2 className="k-h2" data-split>Thank you for <em>serving</em></h2>
          <p className="k-body" data-reveal>Our markets run on women who show up for each other. Fill in your details, read the five acknowledgments, and sign. The market team will reach out with your assignment and arrival time.</p>
        </div>
        <div className="vf-side">
          <div className="jn-benefits" data-reveal>
            <p className="k-eyebrow">On market day</p>
            <ul>{WHAT.map((b) => { const Icon = b[0]; return <li key={b[1]}><span className="k-icon"><Icon size={16} /></span>{b[1]}</li>; })}</ul>
          </div>
        </div>
      </div>
    </section>
    <section className="k-section k-section--mist" id="volunteer">
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Day-of-Event Acknowledgment</p>
        <h2 className="k-h2" data-split>Count me <em>in</em></h2>
      </div>
      <div className="jn-card" data-reveal><VolunteerForm /></div>
    </section>
  </div>
);

export default Volunteer;
