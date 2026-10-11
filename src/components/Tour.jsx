import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HelpCircle, X, ArrowRight, ArrowLeft, Check, Pause, Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { TOUR_EVENT as START, startTour } from './tourEvents';
import './tour.css';

const seenKey = (id, userId) => `p31_tour_${id}_${userId || 'anon'}`;
const readSeen = (id, user) => {
  if (user?.user_metadata?.tours?.[id]) return true;
  try { return localStorage.getItem(seenKey(id, user?.id)) === '1'; } catch { return false; }
};
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The "?" button that replays a walkthrough. */
export const TourButton = ({ id, className = 'ds-icon-btn' }) => (
  <button type="button" className={className} onClick={() => startTour(id)} aria-label="Walkthrough" title="Walkthrough">
    <HelpCircle size={17} />
  </button>
);

// The first selector that matches something visible on screen.
const findTarget = (targets = []) => {
  for (const sel of targets) {
    let els = [];
    try { els = document.querySelectorAll(sel); } catch { continue; }
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && r.bottom > 0 && r.top < window.innerHeight) return el;
    }
  }
  return null;
};

const AUTOPLAY_MS = 7000;

/**
 * A guided, animated walkthrough. It opens by itself the first time someone arrives (once per
 * account, remembered on their profile and on this device) and can be replayed with
 * <TourButton>, startTour(id) or a ?tour=<id> link (add &auto=1 to let it play by itself).
 * A pointer glides to each step's target and "taps" it; in autoplay the steps advance on
 * their own with a progress bar (hover the card to pause).
 *   steps: [{ title, body, to?, targets?: [css selectors], list?: [strings], act?: 'click' }]
 */
const Tour = ({ id, steps, user, autoStart = true, onEnd }) => {
  const [step, setStep] = useState(-1);
  const [box, setBox] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [tapping, setTapping] = useState(false);
  const [auto, setAuto] = useState(false);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);
  const acted = useRef(-1);
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const current = step >= 0 ? steps[step] : null;

  // Move to a step, opening its page.
  const go = useCallback((i, opts) => {
    if (opts && 'autoplay' in opts) setAuto(!!opts.autoplay);
    setPaused(false);
    setStep(i);
    setTick((t) => t + 1);
    const to = steps[i]?.to;
    if (to && to !== window.location.pathname) navigate(to);
  }, [steps, navigate]);

  // First visit: open on its own (after the page has settled).
  useEffect(() => {
    if (!autoStart || !user || readSeen(id, user)) return undefined;
    const t = setTimeout(() => setStep(0), 900);
    return () => clearTimeout(t);
  }, [id, user, autoStart]);

  // Links like /studio?tour=studio&auto=1 start this walkthrough on arrival.
  useEffect(() => {
    const q = new URLSearchParams(search);
    if (q.get('tour') !== id) return undefined;
    const t = setTimeout(() => go(0, { autoplay: q.get('auto') === '1' }), 700);
    return () => clearTimeout(t);
  }, [id, search, go]);

  useEffect(() => {
    const onStart = (e) => {
      const d = e.detail;
      if (d === id) go(0);
      else if (d && d.id === id) go(d.step || 0, { autoplay: !!d.autoplay });
    };
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
    const t2 = setTimeout(measure, 900); // pages that load their content a moment later
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => { clearTimeout(t); clearTimeout(t2); cancelAnimationFrame(raf); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true); };
  }, [current, pathname, measure, tick]);

  // The pointer: glide to the target, tap it, and (when the step asks) click it for real.
  useEffect(() => {
    if (!current) { setCursor(null); return undefined; }
    if (!box) { setCursor((c) => (c ? { ...c, hidden: true } : c)); return undefined; }
    const x = Math.round(box.left + Math.min(box.width - 18, Math.max(18, box.width * 0.5)));
    const y = Math.round(box.top + Math.min(box.height - 14, Math.max(14, box.height * 0.55)));
    setCursor((c) => ({ x, y, hidden: false, from: c && !c.hidden ? null : 'edge' }));
    const wait = reducedMotion() ? 50 : 720;
    const t = setTimeout(() => {
      setTapping(true);
      if (current.act === 'click' && acted.current !== step) {
        acted.current = step;
        const el = findTarget(current.targets);
        el?.click?.();
      }
      setTimeout(() => setTapping(false), 500);
    }, wait);
    return () => clearTimeout(t);
    // Re-run only when the target box or step changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box?.left, box?.top, box?.width, box?.height, step, current]);

  const finish = useCallback(() => {
    setStep(-1);
    setBox(null);
    setCursor(null);
    setAuto(false);
    acted.current = -1;
    try { localStorage.setItem(seenKey(id, user?.id), '1'); } catch { /* private mode */ }
    if (user && !user.user_metadata?.tours?.[id]) {
      supabase.auth.updateUser({ data: { tours: { ...(user.user_metadata?.tours || {}), [id]: new Date().toISOString() } } }).catch(() => {});
    }
    onEnd?.();
  }, [id, user, onEnd]);

  // Autoplay: the next step after a while, unless the card is hovered or paused.
  useEffect(() => {
    if (!current || !auto || paused) return undefined;
    if (step >= steps.length - 1) return undefined;
    const t = setTimeout(() => go(step + 1), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [current, auto, paused, step, steps.length, go]);

  useEffect(() => {
    if (!current) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') finish();
      if (e.key === 'ArrowRight' && step < steps.length - 1) go(step + 1);
      if (e.key === 'ArrowLeft' && step > 0) go(step - 1);
      if (e.key === ' ' && auto) { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, step, steps.length, finish, go, auto]);

  if (!current) return null;
  const last = step === steps.length - 1;

  return (
    <div className={`tour ${auto ? 'is-auto' : ''}`} aria-live="polite">
      {box ? <div className="tour__spot" style={box} aria-hidden="true" /> : <div className="tour__dim" aria-hidden="true" />}
      {cursor && !cursor.hidden && (
        <div className={`tour__cursor ${tapping ? 'is-tap' : ''} ${cursor.from === 'edge' ? 'is-new' : ''}`} style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }} aria-hidden="true">
          <span className="tour__ring" /><span className="tour__dot" />
        </div>
      )}
      <section className={`tour__card ${box ? '' : 'is-center'}`} role="dialog" aria-labelledby="tour-title" aria-describedby="tour-body"
        onMouseEnter={() => auto && setPaused(true)} onMouseLeave={() => auto && setPaused(false)}>
        {auto && <div className="tour__progress" aria-hidden="true"><span key={`${step}-${tick}`} className={paused ? 'is-paused' : ''} style={{ animationDuration: `${AUTOPLAY_MS}ms` }} /></div>}
        <header className="tour__head">
          <span className="tour__count">{step + 1} of {steps.length}</span>
          <span className="tour__head-actions">
            {steps.length > 1 && (
              <button type="button" className="tour__x" onClick={() => { if (auto) setPaused((p) => !p); else setAuto(true); }} aria-label={auto && !paused ? 'Pause' : 'Play by itself'} title={auto && !paused ? 'Pause' : 'Play by itself'}>
                {auto && !paused ? <Pause size={15} /> : <Play size={15} />}
              </button>
            )}
            <button type="button" className="tour__x" onClick={finish} aria-label="Close the walkthrough"><X size={16} /></button>
          </span>
        </header>
        <h2 id="tour-title">{current.title}</h2>
        <div id="tour-body">
          {current.body && <p>{current.body}</p>}
          {current.list && <ol>{current.list.map((li) => <li key={li}>{li}</li>)}</ol>}
        </div>
        <div className="tour__dots" aria-hidden="true">{steps.map((s, i) => <span key={s.title} className={i === step ? 'is-on' : i < step ? 'is-done' : ''} />)}</div>
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
