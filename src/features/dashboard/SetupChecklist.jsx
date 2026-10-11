import React from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, PlayCircle, Sparkles } from 'lucide-react';
import { startCuratorTour } from './studioTour';

/**
 * "Set up your shop": what is done, what is next, a button for each step and the walkthrough.
 * Reads the same data the tabs edit, so it ticks itself as the vendor works.
 */
const SetupChecklist = ({ curator, editData, products = [], onGo }) => {
  const paid = !!(curator?.stripe_charges_enabled || editData.stripeLink || editData.cashappTag || editData.venmoHandle || editData.otherPaymentLink);
  const steps = [
    { id: 'identity', tab: 'identity', label: 'Name, story and shop link', done: !!(editData.businessName && editData.slug && editData.bio), hint: 'Identity' },
    { id: 'agreement', href: '/vendors/agreement', label: 'Sign the Storefront Agreement', done: !!curator?.agreement_signed_at, hint: 'Benefits, fees and your responsibilities' },
    { id: 'look', tab: 'storefront', label: 'Banner and logo', done: !!(editData.bannerUrl && editData.logoUrl), hint: 'Storefront' },
    { id: 'pay', tab: 'storefront', label: 'How you get paid', done: paid, hint: 'Storefront · payments' },
    { id: 'product', tab: 'storefront', label: products.length ? `${products.length} product${products.length === 1 ? '' : 's'} listed` : 'Your first product', done: products.length > 0, hint: 'Storefront · Add Artifact' },
    { id: 'design', tab: 'design', label: 'Pick your look', done: !!curator?.store_design?.template, hint: 'Store Design' },
    { id: 'market', tab: 'marketing', label: 'Share a product link or promo image', done: false, hint: 'Marketing', optional: true },
  ];
  const required = steps.filter((s) => !s.optional);
  const done = required.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  const complete = done === required.length;

  return (
    <section className="dashboard-card glass-card sc" data-tour="checklist">
      <div className="sc__head">
        <h3 className="card-title text-gold"><Sparkles size={18} /> Set up your shop</h3>
        <span className="sc__count">{done} of {required.length}</span>
      </div>
      <div className="sc__bar" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={required.length}><i style={{ width: `${(done / required.length) * 100}%` }} /></div>
      <p className="sc__lead">{complete ? 'Everything is in place. Share your shop link and keep the Marketing tab busy.' : `Next: ${next.label.toLowerCase()}.`}</p>
      <ol className="sc__list">
        {steps.map((s) => (
          <li key={s.id} className={s.done ? 'is-done' : s === next ? 'is-next' : ''}>
            <span className="sc__tick" aria-hidden="true">{s.done ? <Check size={13} /> : null}</span>
            <div><strong>{s.label}</strong><small>{s.hint}</small></div>
            {!s.done && (s.href
              ? <Link to={s.href} className="sc__go">{s === next ? 'Do this' : 'Open'} <ArrowRight size={13} /></Link>
              : <button type="button" className="sc__go" onClick={() => onGo(s.tab)}>{s === next ? 'Do this' : 'Open'} <ArrowRight size={13} /></button>)}
          </li>
        ))}
      </ol>
      <button type="button" className="sc__tour" onClick={startCuratorTour}><PlayCircle size={16} /> Start the walkthrough</button>
    </section>
  );
};

export default SetupChecklist;
