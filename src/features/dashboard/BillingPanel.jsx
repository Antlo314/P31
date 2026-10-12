import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CreditCard, CalendarClock, CheckCircle2, AlertTriangle, Gift, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { billingState, fmt, daysLeft, dollars } from './billingState';
import './BillingPanel.css';

/** A short note at the top of the studio when the plan needs her attention. */
export const BillingBanner = ({ curator }) => {
  const s = billingState(curator);
  if (!s || !['warn', 'alert'].includes(s.tone)) return null;
  return (
    <Link to="/dashboard/billing" className={`bl-banner bl-banner--${s.tone}`} role="status">
      <AlertTriangle size={18} /> <span><strong>{s.title}.</strong> {s.text}</span> <ArrowRight size={16} />
    </Link>
  );
};

/** /dashboard/billing — the vendor's storefront plan: free period, subscribe, manage. */
const BillingPanel = ({ curator }) => {
  const [params] = useSearchParams();
  const [terms, setTerms] = useState({ price_cents: 1499, free_months: 3 });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'billing').maybeSingle().then(({ data }) => { if (data?.value) setTerms((t) => ({ ...t, ...data.value })); });
  }, []);

  const go = async (action) => {
    setBusy(action); setError('');
    const { data, error: err } = await supabase.functions.invoke('vendor-billing', { body: { action } });
    let msg = err?.message;
    if (err) { try { msg = (await err.context?.json())?.error || msg; } catch { /* keep message */ } }
    if (data?.url) { window.location.href = data.url; return; }
    setBusy('');
    if (data?.already) return setError('Your subscription is already active. It can take a minute to show here.');
    setError(msg || data?.error || 'Something went wrong. Write to vendor@p31market.com and we will help.');
  };

  const state = billingState(curator);
  const Icon = !state ? CreditCard : state.tone === 'ok' ? (curator.subscription_status === 'comp' ? Gift : CheckCircle2) : state.tone === 'calm' ? CalendarClock : AlertTriangle;
  const status = params.get('status');
  return (
    <div className="dashboard-view bl">
      <header className="dashboard-header">
        <h1 className="font-headline text-primary">Plan &amp; <span className="text-gold">billing</span></h1>
        <p>Your storefront plan, from the Storefront Agreement you signed.</p>
      </header>

      {status === 'success' && <p className="bl-note bl-note--ok" role="status"><CheckCircle2 size={18} /> Thank you. Your subscription is set up; it can take a minute to show here.</p>}
      {status === 'cancelled' && <p className="bl-note" role="status">No changes were made.</p>}

      <section className={`bl-card bl-card--${state?.tone || 'calm'}`} data-tour="billing-status">
        <span className="bl-card__icon"><Icon size={24} /></span>
        <div>
          <h2>{state ? state.title : 'Your storefront plan'}</h2>
          <p>{state ? state.text : 'Your plan details will show here.'}</p>
          {state?.act === 'subscribe' && (
            <>
              <button type="button" className="btn-solid-gold mt-4" disabled={!!busy} onClick={() => go('checkout')}>
                {busy === 'checkout' ? <><Loader2 size={16} className="spin" /> Opening Stripe…</> : <>Set up my subscription · {dollars(terms.price_cents || 1499)}/month</>}
              </button>
              {curator.subscription_status === 'trial' && daysLeft(curator.trial_ends_at) > 2 && <p className="bl-fine">Your card is saved today; the first charge waits until your free period ends on {fmt(curator.trial_ends_at)}.</p>}
            </>
          )}
          {state?.act === 'manage' && (
            <button type="button" className="btn-outline-primary mt-4" disabled={!!busy} onClick={() => go('portal')}>
              {busy === 'portal' ? <><Loader2 size={16} className="spin" /> Opening…</> : 'Change card or cancel'}
            </button>
          )}
          {error && <p className="bl-error" role="alert">{error}</p>}
        </div>
      </section>

      <section className="bl-terms">
        <h3>Your terms</h3>
        <ul>
          <li>Your storefront is complimentary for {terms.free_months || 3} months from activation{curator?.activated_at ? ` (activated ${fmt(curator.activated_at)})` : ''}.</li>
          <li>After that it continues for {dollars(terms.price_cents || 1499)} a month, if you choose to keep it.</li>
          <li>Proverbs 31 Marketplace keeps a 5% fee on each sale, before and after the free period.</li>
          <li>You may cancel your storefront subscription at any time with a minimum of two weeks’ notice.</li>
        </ul>
        <p className="bl-fine">The full agreement is at <a href="/vendors/agreement">p31market.com/vendors/agreement</a>. Questions? <a href="mailto:vendor@p31market.com">vendor@p31market.com</a></p>
      </section>
    </div>
  );
};

export default BillingPanel;
