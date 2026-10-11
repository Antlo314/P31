import React, { useState } from 'react';
import { ArrowRight, ArrowDown } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { EMAIL } from '../../lib/team';
import { submitForm, readSent, markSent, clearSent } from '../../lib/forms';
import { FEEDBACK_INTRO, SALES_OPTIONS, AGAIN_OPTIONS } from './formText';
import { Chips, Scale, MarketPicker, Done, HelpLine, Trap } from './FormBits';

const SENT_KEY = 'p31_feedback_sent';
const BLANK = { business_name: '', email: '', sales: '', again: '', enjoyed: '', improve: '', comments: '', trap: '' };
const NO_RATING = { overall: 0, venue: 0, dj: 0, organization: 0 };
const NO_MARKET = { eventId: null, label: '', other: false };

const FeedbackForm = () => {
  const [sent] = useState(() => readSent(SENT_KEY));
  const [f, setF] = useState(BLANK);
  const [r, setR] = useState(NO_RATING);
  const [market, setMarket] = useState(NO_MARKET);
  const [state, setState] = useState(sent ? 'done' : 'idle');
  const [error, setError] = useState('');
  const [justSent, setJustSent] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const rate = (k) => (n) => setR((x) => ({ ...x, [k]: n }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!market.eventId && market.label.trim().length < 3) return setError('Which market did you attend? Please add the month and year.');
    if (!r.overall) return setError('Please rate your overall experience (1 to 5).');
    if (!r.venue) return setError('Please rate the venue and atmosphere (1 to 5).');
    if (!r.organization) return setError('Please rate the organization of the event (1 to 5).');
    if (!f.sales) return setError('Please tell us how your sales were.');
    if (!f.again) return setError('Please tell us whether you would vend with P31 again.');
    setState('sending');
    try {
      await submitForm('feedback', {
        event_id: market.eventId, market_label: market.label, business_name: f.business_name, email: f.email,
        overall: r.overall, venue: r.venue, dj: r.dj || null, organization: r.organization, sales: f.sales, again: f.again,
        enjoyed: f.enjoyed, improve: f.improve, comments: f.comments, source: 'feedback page', trap: f.trap,
      });
    } catch (err) { setError(err.message); setState('idle'); return; }
    markSent(SENT_KEY, { business: f.business_name, label: market.label, again: f.again });
    setJustSent(true);
    setState('done');
  };
  const startOver = () => { clearSent(SENT_KEY); setF(BLANK); setR(NO_RATING); setMarket(NO_MARKET); setState('idle'); };

  if (state === 'done') {
    const d = justSent ? { business: f.business_name, label: market.label, again: f.again } : sent;
    return (
      <Done title="Thank you for your honest feedback" focus={justSent} again="Feedback on another market? Send another survey" onAgain={startOver}>
        <p>We read every survey and use it to shape the next market. {d.again === 'in' ? 'You said you’re in for the next one, so the team will reach out as the date is set.' : d.again === 'waitlist' ? 'We’ll keep you on the waitlist for future events.' : ''}</p>
        <p className="k-fine">Anything else to add? <a href={`mailto:${EMAIL.vendors}`}>{EMAIL.vendors}</a>.</p>
      </Done>
    );
  }

  return (
    <form className="k-form jn-form" onSubmit={submit}>
      <MarketPicker label="Which market did you attend? (Month/Year)" which="recent" value={market} onChange={setMarket} />
      <label className="k-field"><span>Business Name *</span><input required autoComplete="organization" value={f.business_name} onChange={set('business_name')} /></label>

      <Scale label="How would you rate your overall experience at the Proverbs 31 Marketplace?" required value={r.overall} onChange={rate('overall')} />
      <Scale label="Rate the venue and atmosphere?" required value={r.venue} onChange={rate('venue')} />
      <Scale label="How would you rate the DJ and sounds?" value={r.dj} onChange={rate('dj')} />
      <Scale label="How would you rate the organization of the event, including the Host and team" required value={r.organization} onChange={rate('organization')} />

      <Chips label="How would you describe your sales based on the customer traffic at the event?" required options={SALES_OPTIONS} value={f.sales} onChange={(v) => setF((x) => ({ ...x, sales: v }))} />
      <Chips label="Are you interested in vending with P31 again?" required options={AGAIN_OPTIONS} value={f.again} onChange={(v) => setF((x) => ({ ...x, again: v }))} />

      <label className="k-field"><span>What did you enjoy most about this event?</span><textarea rows={3} value={f.enjoyed} onChange={set('enjoyed')} /></label>
      <label className="k-field"><span>What could we improve for the future of our monthly markets?</span><textarea rows={3} value={f.improve} onChange={set('improve')} /></label>
      <label className="k-field"><span>Any additional comments or suggestions?</span><textarea rows={3} value={f.comments} onChange={set('comments')} /></label>
      <label className="k-field"><span>Email (optional, if you’d like a reply)</span><input type="email" inputMode="email" autoComplete="email" value={f.email} onChange={set('email')} /></label>

      <Trap f={f} set={set} />
      {error && <p className="k-error" role="alert">{error}</p>}
      <button className="k-btn k-btn--gold k-btn--lg k-btn--block" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : <>Submit Feedback <ArrowRight size={18} /></>}
      </button>
      <HelpLine />
    </form>
  );
};

// /vendors/feedback — the Proverbs 31 Marketplace Vendor Feedback Survey.
const VendorFeedback = () => (
  <div className="k-page">
    <PageHeader
      eyebrow="Vendor community"
      title="Vendor Feedback"
      accent="Survey"
      lead={FEEDBACK_INTRO}
      actions={<a href="#survey" className="k-btn k-btn--gold">Start the survey <ArrowDown size={18} /></a>}
    />
    <section className="k-section k-section--mist" id="survey">
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Proverbs 31 Marketplace Vendor Feedback Survey</p>
        <h2 className="k-h2" data-split>How was the <em>market?</em></h2>
        <p className="k-lede" data-reveal>Ten quick questions. Your answers go straight to the market team.</p>
      </div>
      <div className="jn-card" data-reveal><FeedbackForm /></div>
    </section>
  </div>
);

export default VendorFeedback;
