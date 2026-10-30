import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, PlayCircle, Sparkles, Clock, ExternalLink, AlertTriangle } from 'lucide-react';
import { startCuratorTour } from './studioTour';
import { EMAIL } from '../../lib/team';

/**
 * "Set up your shop": each step, done or not, from what is saved (not what is half-typed), with a
 * button to the right place, then where the shop stands: live, waiting for P31, or needs changes.
 * onGo(tab, target) opens a studio tab and scrolls to the part named by target.
 */
const SetupChecklist = ({ curator, products = [], onGo, onSubmit }) => {
  const c = curator || {};
  const listed = products.filter((p) => p.is_active !== false).length;
  const stripeStarted = !!c.stripe_account_id;
  const steps = [
    { id: 'name', tab: 'identity', target: 'shop-name', label: 'Shop name and shop link', done: !!(c.business_name && c.slug),
      hint: c.slug ? `p31market.com/${c.slug}` : 'Your shop details, below' },
    { id: 'look', tab: 'storefront', target: 'shop-photos', label: 'Logo and banner photo', done: !!(c.logo_url && c.banner_url),
      hint: c.logo_url && !c.banner_url ? 'Logo is in; add a wide banner photo' : !c.logo_url && c.banner_url ? 'Banner is in; add your logo' : 'Storefront tab, at the top' },
    { id: 'about', tab: 'identity', target: 'shop-about', label: 'About your shop', done: !!(c.bio && c.bio.trim().length >= 20),
      hint: 'A few lines about you and what you make' },
    { id: 'product', tab: 'storefront', target: 'add-product', label: listed ? `${listed} product${listed === 1 ? '' : 's'} listed` : 'Add your first product', done: listed > 0,
      hint: 'A photo, a name and a price' },
    { id: 'pay', tab: 'storefront', target: 'stripe-connect-section', label: 'Get paid: connect Stripe', done: !!c.stripe_charges_enabled,
      hint: stripeStarted ? 'Started. Finish the Stripe steps so shoppers can pay you' : 'Card payments go straight to your bank' },
    { id: 'terms', href: '/vendors/agreement', label: 'Read and sign the Storefront Agreement', done: !!c.agreement_signed_at,
      hint: 'Fees, benefits and your part, in plain words' },
  ];
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  const complete = !next;

  const status = c.status || 'draft';
  let outcome;
  if (!curator) {
    outcome = { tone: 'wait', Icon: Clock, title: 'Start with your shop name', text: 'Fill in your shop details below and press Save shop details. That creates your shop.' };
  } else if (status === 'approved') {
    outcome = complete
      ? { tone: 'live', Icon: Check, title: 'Your shop is live', text: 'Shoppers can find it and buy. Share your link everywhere.' }
      : { tone: 'live', Icon: Check, title: 'Your shop is live', text: c.stripe_charges_enabled ? 'Finish the steps above so it looks its best.' : 'Shoppers can see it, but they cannot pay until Stripe is connected.' };
  } else if (status === 'pending') {
    outcome = { tone: 'wait', Icon: Clock, title: 'Waiting for P31 to approve', text: 'Keep setting up while you wait. Only you can see your shop until it is approved; you will get an email when it is live.' };
  } else if (status === 'rejected') {
    outcome = { tone: 'warn', Icon: AlertTriangle, title: 'P31 asked for a few changes', text: c.admin_feedback ? `Their note: "${c.admin_feedback}". Make the changes, then send it back.` : 'Make the changes, then send it back for review.', submit: 'Send my shop for review again' };
  } else if (status === 'paused') {
    outcome = { tone: 'warn', Icon: AlertTriangle, title: 'Your shop is paused', text: `It is hidden from shoppers for now; your products and settings are kept. Questions: ${EMAIL.vendors}.` };
  } else {
    outcome = { tone: 'wait', Icon: Clock, title: 'Not sent for review yet', text: 'When the steps are done, send your shop to the P31 team. You will get an email when it is live.', submit: 'Send my shop for review' };
  }

  return (
    <section className="dashboard-card glass-card sc" data-tour="checklist" aria-labelledby="sc-title">
      <div className="sc__head">
        <h3 className="card-title text-gold" id="sc-title"><Sparkles size={18} /> Set up your shop</h3>
        <span className="sc__count">{done} of {steps.length} done</span>
      </div>
      <div className="sc__bar" role="progressbar" aria-label="Setup progress" aria-valuenow={done} aria-valuemin={0} aria-valuemax={steps.length}><i style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      {next && <p className="sc__lead">Next: {next.label.charAt(0).toLowerCase() + next.label.slice(1)}.</p>}
      <ol className="sc__list">
        {steps.map((s) => (
          <li key={s.id} className={s.done ? 'is-done' : s === next ? 'is-next' : ''}>
            <span className="sc__tick" aria-hidden="true">{s.done ? <Check size={13} /> : null}</span>
            <div><strong>{s.label}</strong><small>{s.done ? 'Done' : s.hint}</small></div>
            {s.href
              ? <Link to={s.href} className="sc__go">{s.done ? 'View' : s === next ? 'Do this' : 'Open'} <ArrowRight size={13} /></Link>
              : <button type="button" className="sc__go" onClick={() => onGo(s.tab, s.target)}>{s.done ? 'Edit' : s === next ? 'Do this' : 'Open'} <ArrowRight size={13} /></button>}
          </li>
        ))}
      </ol>
      <div className={`sc__outcome sc__outcome--${outcome.tone}`} role="status">
        <outcome.Icon size={18} aria-hidden="true" />
        <div>
          <strong>{outcome.title}</strong>
          <p>{outcome.text}</p>
          {status === 'approved' && c.slug && (
            <a className="sc__link" href={`/${c.slug}`} target="_blank" rel="noreferrer">p31market.com/{c.slug} <ExternalLink size={13} /></a>
          )}
          {outcome.submit && onSubmit && (
            <button type="button" className="btn-solid-gold btn-sm sc__submit" onClick={onSubmit} disabled={!c.business_name || listed < 1}>
              {outcome.submit}
            </button>
          )}
          {outcome.submit && (!c.business_name || listed < 1) && <small className="sc__need">Add your shop name and at least one product first.</small>}
        </div>
      </div>
      <button type="button" className="sc__tour" onClick={startCuratorTour}><PlayCircle size={16} /> Show me around (2-minute walkthrough)</button>
    </section>
  );
};

export default SetupChecklist;
