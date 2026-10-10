import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HelpCircle, X, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './tour.css';

const START = 'p31:tour';
const seenKey = (id, userId) => `p31_tour_${id}_${userId || 'anon'}`;
const readSeen = (id, user) => {
  if (user?.user_metadata?.tours?.[id]) return true;
  try { return localStorage.getItem(seenKey(id, user?.id)) === '1'; } catch { return false; }
};

/** The "?" button that replays a walkthrough. */
export const TourButton = ({ id, className = 'ds-icon-btn' }) => (
  <button type="button" className={className} onClick={() => window.dispatchEvent(new CustomEvent(START, { detail: id }))} aria-label="Walkthrough" title="Walkthrough">
    <HelpCircle size={17} />
  </button>
);

// The first selector that matches something visible on screen.
const findTarget = (targets = []) => {
  for (const sel of targets) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && r.bottom > 0 && r.top < window.innerHeight) return el;
    }
  }
  return null;
};

/**
 * A guided walkthrough that opens by itself the first time someone arrives (once per
 * account, remembered on their profile and on this device) and can be replayed with
 * <TourButton>. Each step can open a page (`to`) and point at something on it (`targets`).
 *   steps: [{ title, body, to?, targets?: [css selectors], list?: [strings] }]
 */
const Tour = ({ id, steps, user, autoStart = true }) => {
  const [step, setStep] = useState(-1);
  const [box, setBox] = useState(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = step >= 0 ? steps[step] : null;

  // Move to a step, opening its page.
  const go = useCallback((i) => {
    setStep(i);
    const to = steps[i]?.to;
    if (to && to !== window.location.pathname) navigate(to);
  }, [steps, navigate]);

  // First visit: open on its own (after the page has settled).
  useEffect(() => {
    if (!autoStart || !user || readSeen(id, user)) return undefined;
    const t = setTimeout(() => setStep(0), 900);
    return () => clearTimeout(t);
  }, [id, user, autoStart]);

  useEffect(() => {
    const onStart = (e) => { if (e.detail === id) go(0); };
    window.addEventListener(START, onStart);
    return () => window.removeEventListener(START, onStart);
  }, [id, go]);


  // Point at the step's target (and follow it while the page moves).
  const measure = useCallback(() => {
    const el = current && findTarget(current.targets);
    if (!el) { setBox((b) => (b ? null : b)); return; }
    const r = el.getBoundingClientRect();
    const next = { top: Math.round(r.top - 6), left: Math.round(r.left - 6), width: Math.round(r.width + 12), height: Math.round(r.height + 12) };
    setBox((b) => (b && b.top === next.top && b.left === next.left && b.width === next.width && b.height === next.height ? b : next));
  }, [current]);
  useLayoutEffect(() => {
    if (!current) return undefined;
    const el = findTarget(current.targets);
    el?.scrollIntoView?.({ block: 'nearest' });
    const t = setTimeout(measure, 350);
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [current, pathname, measure]);

  const finish = useCallback(() => {
    setStep(-1);
    setBox(null);
    try { localStorage.setItem(seenKey(id, user?.id), '1'); } catch { /* private mode */ }
    if (user && !user.user_metadata?.tours?.[id]) {
      supabase.auth.updateUser({ data: { tours: { ...(user.user_metadata?.tours || {}), [id]: new Date().toISOString() } } }).catch(() => {});
    }
  }, [id, user]);

  useEffect(() => {
    if (!current) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight' && step < steps.length - 1) go(step + 1);
      if (e.key === 'ArrowLeft' && step > 0) go(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, step, steps.length, finish, go]);

  if (!current) return null;
  const last = step === steps.length - 1;

  return (
    <div className="tour" aria-live="polite">
      {box ? <div className="tour__spot" style={box} aria-hidden="true" /> : <div className="tour__dim" aria-hidden="true" />}
      <section className={`tour__card ${box ? '' : 'is-center'}`} role="dialog" aria-labelledby="tour-title" aria-describedby="tour-body">
        <header className="tour__head">
          <span className="tour__count">{step + 1} of {steps.length}</span>
          <button type="button" className="tour__x" onClick={finish} aria-label="Close the walkthrough"><X size={16} /></button>
        </header>
        <h2 id="tour-title">{current.title}</h2>
        <div id="tour-body">
          {current.body && <p>{current.body}</p>}
          {current.list && <ol>{current.list.map((li) => <li key={li}>{li}</li>)}</ol>}
        </div>
        <div className="tour__dots" aria-hidden="true">{steps.map((s, i) => <span key={s.title} className={i === step ? 'is-on' : ''} />)}</div>
        <footer className="tour__foot">
          {step > 0 ? <button type="button" className="tour__btn tour__btn--ghost" onClick={() => go(step - 1)}><ArrowLeft size={15} /> Back</button>
            : <button type="button" className="tour__btn tour__btn--ghost" onClick={finish}>Skip</button>}
          {last ? <button type="button" className="tour__btn" onClick={finish}><Check size={15} /> Got it</button>
            : <button type="button" className="tour__btn" onClick={() => go(step + 1)}>Next <ArrowRight size={15} /></button>}
        </footer>
      </section>
    </div>
  );
};

export default Tour;
