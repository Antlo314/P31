import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X, ArrowRight, CalendarHeart, Gem, Mail, Check, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { gsap, reducedMotion } from '../lib/motion';
import './LeadPopup.css';

import gatherImg from '../assets/web/p31_community_impact_editorial_1776544076592.webp';

const QUIET = ['/login', '/register', '/dashboard', '/systems', '/onboarding-exclusive', '/unsubscribe', '/portal', '/enroll', '/academy', '/studio'];
const PERKS = [
  { Icon: CalendarHeart, text: 'First word on every market date' },
  { Icon: Gem, text: 'Private previews & curator drops' },
  { Icon: Mail, text: 'Stories from the collective — never spam' },
];

const LeadPopup = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', trap: '' });
  const [withPhone, setWithPhone] = useState(false);
  const [state, setState] = useState('idle'); // idle | sending | done
  const [error, setError] = useState('');
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const closing = useRef(null); // the running close animation, if any

  const show = useCallback(() => {
    // Reopened while it was still animating closed: cancel the close.
    if (closing.current) {
      closing.current.kill();
      closing.current = null;
      gsap.set([rootRef.current, panelRef.current], { clearProps: 'opacity,transform' });
    }
    setOpen(true);
    try { sessionStorage.setItem('p31_lead_popup_seen', '1'); } catch { /* storage blocked */ }
  }, []);

  // Wait for real interest — half the page, 30 seconds, or (on desktop) the
  // cursor heading for the tab bar — and never interrupt people who signed up,
  // are signed in, or are working.
  useEffect(() => {
    if (user || QUIET.some((r) => pathname.startsWith(r))) return undefined;
    let seen = false;
    try { seen = sessionStorage.getItem('p31_lead_popup_seen') || localStorage.getItem('p31_subscribed'); } catch { /* ignore */ }
    if (seen) return undefined;

    const started = Date.now();
    const onScroll = () => {
      const depth = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (depth > 0.5) done();
    };
    const onLeave = (e) => { if (e.clientY <= 0 && Date.now() - started > 8000) done(); };
    const timer = setTimeout(() => done(), 30000);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mouseout', onLeave);
    function done() { cleanup(); show(); }
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseout', onLeave);
    }
    return cleanup;
  }, [pathname, user, show]);

  // Anything on the site can open it (hero buttons, footer…).
  useEffect(() => {
    const onJoin = () => {
      let subscribed = false;
      try { subscribed = !!localStorage.getItem('p31_subscribed'); } catch { /* ignore */ }
      setState(subscribed ? 'done' : 'idle');
      show();
    };
    window.addEventListener('p31:join', onJoin);
    return () => window.removeEventListener('p31:join', onJoin);
  }, [show]);

  const close = useCallback(() => {
    if (closing.current) return;
    const finish = () => { closing.current = null; setOpen(false); };
    if (reducedMotion() || !rootRef.current) return finish();
    const tl = gsap.timeline({ onComplete: finish });
    closing.current = tl;
    tl.to(panelRef.current, { y: window.innerWidth < 760 ? '100%' : 24, opacity: window.innerWidth < 760 ? 1 : 0, duration: 0.4, ease: 'power3.in' })
      .to(rootRef.current, { opacity: 0, duration: 0.25, ease: 'power1.out' }, '-=0.15');
  }, []);

  // Entrance, focus, Escape, and page lock.
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    const firstInput = panelRef.current?.querySelector('input:not([tabindex="-1"])');
    setTimeout(() => firstInput?.focus({ preventScroll: true }), 450);

    let ctx;
    if (!reducedMotion()) {
      ctx = gsap.context(() => {
        const phone = window.innerWidth < 760;
        gsap.timeline({ defaults: { ease: 'expo.out' } })
          .fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power1.out' })
          .fromTo(panelRef.current, phone ? { y: '100%' } : { y: 40, scale: 0.96, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.9 }, 0.05)
          .fromTo('.lp2__media', { clipPath: 'inset(100% 0% 0% 0% round 999px 999px 24px 24px)' }, { clipPath: 'inset(0% 0% 0% 0% round 999px 999px 24px 24px)', duration: 1.3 }, 0.2)
          .fromTo('.lp2__media img', { scale: 1.25 }, { scale: 1, duration: 1.6 }, 0.2)
          .fromTo('.lp2__in', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.06 }, 0.3);
      }, rootRef);
    }
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      ctx?.revert();
    };
  }, [open, close]);

  // A little burst of gold when someone joins.
  useEffect(() => {
    if (state !== 'done' || !open || reducedMotion()) return undefined;
    const ctx = gsap.context(() => {
      gsap.timeline()
        .fromTo('.lp2__seal', { scale: 0.4, opacity: 0, rotate: -40 }, { scale: 1, opacity: 1, rotate: 0, duration: 1, ease: 'back.out(2)' })
        .fromTo('.lp2__seal path', { strokeDashoffset: 40 }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.out' }, 0.35)
        .fromTo('.lp2__spark', { x: 0, y: 0, scale: 0, opacity: 1 }, {
          x: (i) => Math.cos((i / 12) * Math.PI * 2) * gsap.utils.random(60, 110),
          y: (i) => Math.sin((i / 12) * Math.PI * 2) * gsap.utils.random(60, 110),
          scale: () => gsap.utils.random(0.6, 1.3), opacity: 0, duration: 1.2, ease: 'power3.out',
        }, 0.2)
        .fromTo('.lp2__done-in', { y: 16, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.08, duration: 0.7, ease: 'expo.out' }, 0.4);
    }, rootRef);
    return () => ctx.revert();
  }, [state, open]);

  const submit = async (e) => {
    e.preventDefault();
    setState('sending');
    setError('');
    // Rate-limited, de-duplicated signup (v19) — the bot trap must stay empty.
    const { error: rpcError } = await supabase.rpc('subscribe_lead', {
      p_name: form.name.trim(), p_email: form.email.trim(), p_phone: form.phone.trim(),
      p_source: 'popup', p_trap: form.trap,
    });
    if (rpcError) {
      setError('We couldn’t add you just now — please try again in a moment.');
      setState('idle');
      return;
    }
    try { localStorage.setItem('p31_subscribed', '1'); } catch { /* ignore */ }
    setState('done');
  };

  if (!open) return null;
  const firstName = form.name.trim().split(/\s+/)[0];

  return (
    <div className="lp2" ref={rootRef} onClick={(e) => e.target === e.currentTarget && close()} role="dialog" aria-modal="true" aria-labelledby="lp2-title">
      <div className="lp2__panel" ref={panelRef}>
        <div className="lp2__grip" aria-hidden="true" />
        <button className="k-close lp2__close" onClick={close} aria-label="Close"><X size={18} /></button>

        <aside className="lp2__side k-dark">
          <div className="lp2__media"><img src={gatherImg} alt="" /></div>
          <figure className="lp2__verse lp2__in">
            <blockquote>“Give her of the fruit of her hands.”</blockquote>
            <figcaption>Proverbs 31:31</figcaption>
          </figure>
        </aside>

        <div className="lp2__main">
          {state === 'done' ? (
            <div className="lp2__done">
              <div className="lp2__burst" aria-hidden="true">
                {Array.from({ length: 12 }, (_, i) => <i key={i} className="lp2__spark" />)}
                <svg className="lp2__seal" viewBox="0 0 64 64" width="76" height="76">
                  <circle cx="32" cy="32" r="30" />
                  <path d="M20 33l8 8 16-17" pathLength="40" strokeDasharray="40" />
                </svg>
              </div>
              <p className="k-eyebrow k-eyebrow--center lp2__done-in">The Inner Circle</p>
              <h2 id="lp2-title" className="k-h2 lp2__done-in">Welcome{firstName ? `, ${firstName}` : ''}.</h2>
              <p className="k-body lp2__done-in">You’re in the collective. Market dates, invitations and curator stories will find their way to you.</p>
              <button className="k-btn k-btn--plum lp2__done-in" onClick={close}>Continue exploring <ArrowRight size={18} /></button>
            </div>
          ) : (
            <>
              <p className="k-eyebrow lp2__in">The Inner Circle</p>
              <h2 id="lp2-title" className="k-h2 lp2__title lp2__in">Join the <em>collective</em></h2>
              <p className="k-body lp2__in">Be first through the gates — early invitations, market dates and the best of Proverbs 31 Marketplace.</p>

              <ul className="lp2__perks lp2__in">
                {PERKS.map((p) => <li key={p.text}><span><p.Icon size={16} /></span>{p.text}</li>)}
              </ul>

              <form className="k-form lp2__form lp2__in" onSubmit={submit}>
                <div className="k-row">
                  <label className="k-field"><span>First name</span>
                    <input required autoComplete="given-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane" disabled={state === 'sending'} />
                  </label>
                  <label className="k-field"><span>Email</span>
                    <input required type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" disabled={state === 'sending'} />
                  </label>
                </div>
                {withPhone ? (
                  <label className="k-field"><span>Mobile (for text reminders)</span>
                    <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" disabled={state === 'sending'} />
                  </label>
                ) : (
                  <button type="button" className="lp2__more" onClick={() => setWithPhone(true)}><Phone size={14} /> Add a phone for text reminders</button>
                )}
                <input className="k-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.trap} onChange={(e) => setForm({ ...form, trap: e.target.value })} />
                {error && <p className="k-error" role="alert">{error}</p>}
                <button className="k-btn k-btn--gold k-btn--lg k-btn--block" disabled={state === 'sending'}>
                  {state === 'sending' ? 'Joining…' : <>Join the collective <ArrowRight size={18} /></>}
                </button>
                <p className="k-fine lp2__fine"><Check size={13} /> One click to unsubscribe. We never share your details.</p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadPopup;
