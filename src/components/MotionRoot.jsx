import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { gsap, ScrollTrigger, SplitText, reducedMotion } from '../lib/motion';

/**
 * Site-wide motion, switched on per element with data attributes:
 *   data-intro="0.2"        fades up on page load (optional delay in seconds)
 *   data-split="intro"      headline rises in line by line (on load with "intro",
 *                           otherwise when scrolled into view)
 *   data-reveal="up"        animates in when scrolled into view
 *                           (up | fade | left | right | scale | clip)
 *   data-reveal-group       its children animate in one after another
 *   data-scrub              words light up as you scroll past
 *   data-parallax="8"       drifts ±8% while scrolling (put it on media)
 *   data-count              counts up to its number ("1K+", "100%" keep their symbols)
 * Content only starts hidden when motion is allowed and this is running
 * (the html.motion-ok class), so nothing can get stuck invisible.
 */
const FROM = {
  up: { y: 44, opacity: 0 },
  fade: { opacity: 0 },
  left: { x: -48, opacity: 0 },
  right: { x: 48, opacity: 0 },
  scale: { scale: 0.93, opacity: 0 },
  clip: { clipPath: 'inset(14% 10% 14% 10% round 28px)', scale: 1.06, opacity: 0.2 },
};
const toFor = (from) => Object.fromEntries(Object.keys(from).map((k) => [k, {
  y: 0, x: 0, scale: 1, opacity: 1, clipPath: 'inset(0% 0% 0% 0% round 0px)',
}[k]]));

const play = (targets, kind = 'up', extra = {}) => {
  const from = FROM[kind] || FROM.up;
  [targets].flat().forEach((el) => el.classList.add('is-in'));
  return gsap.fromTo(targets, from, {
    ...toFor(from), duration: kind === 'clip' ? 1.5 : 1.1, ease: 'expo.out',
    clearProps: 'transform,opacity,clipPath', ...extra,
  });
};

const countUp = (el) => {
  const text = el.textContent.trim();
  const m = /^(\D*)([\d.,]+)(.*)$/.exec(text);
  if (!m) return;
  const target = parseFloat(m[2].replace(/,/g, ''));
  const decimals = (m[2].split('.')[1] || '').length;
  const state = { v: 0 };
  el.textContent = `${m[1]}0${m[3]}`;
  gsap.to(state, {
    v: target, duration: 2, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 92%', once: true },
    onUpdate: () => { el.textContent = `${m[1]}${state.v.toFixed(decimals)}${m[3]}`; },
  });
};

const MotionRoot = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const html = document.documentElement;
    if (reducedMotion()) { html.classList.remove('motion-ok'); return undefined; }
    html.classList.add('motion-ok');

    const root = document.querySelector('.site-main') || document.body;
    const seen = new WeakSet();
    const groups = new Map(); // element → { entered }
    const ctx = gsap.context(() => {});

    // Gentle page entrance on every route change.
    gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out', clearProps: 'opacity' });

    const fresh = (sel) => [...root.querySelectorAll(sel)].filter((el) => !seen.has(el) && seen.add(el));

    const scan = () => ctx.add(() => {
      fresh('[data-intro]').forEach((el) => play(el, 'up', { delay: 0.15 + (parseFloat(el.dataset.intro) || 0), duration: 1.2 }));

      fresh('[data-split]').forEach((el) => {
        const intro = el.dataset.split === 'intro';
        SplitText.create(el, {
          type: 'lines', mask: 'lines', linesClass: 'k-line', autoSplit: true,
          onSplit(self) {
            el.classList.add('is-in');
            return gsap.from(self.lines, {
              yPercent: 108, duration: 1.25, stagger: 0.1, ease: 'expo.out',
              delay: intro ? 0.12 + (parseFloat(el.dataset.delay) || 0) : 0,
              scrollTrigger: intro ? undefined : { trigger: el, start: 'top 90%', once: true },
            });
          },
        });
      });

      const reveals = fresh('[data-reveal]');
      if (reveals.length) {
        ScrollTrigger.batch(reveals, {
          start: 'top 90%', once: true,
          onEnter: (batch) => batch.forEach((el, i) => play(el, el.dataset.reveal, { delay: i * 0.08 })),
        });
      }

      fresh('[data-reveal-group]').forEach((el) => {
        const state = { entered: false };
        groups.set(el, state);
        ScrollTrigger.create({
          trigger: el, start: 'top 88%', once: true,
          onEnter: () => {
            state.entered = true;
            const kids = [...el.children].filter((c) => !c.classList.contains('is-in'));
            if (kids.length) play(kids, el.dataset.revealGroup || 'up', { stagger: 0.08 });
          },
        });
      });
      // Items that arrive later (search results, async lists) in a group that's already in view.
      groups.forEach((state, el) => {
        if (!state.entered || !el.isConnected) return;
        const kids = [...el.children].filter((c) => !c.classList.contains('is-in'));
        if (kids.length) play(kids, el.dataset.revealGroup || 'up', { stagger: 0.05, duration: 0.8 });
      });

      fresh('[data-scrub]').forEach((el) => {
        SplitText.create(el, {
          type: 'words', autoSplit: true,
          onSplit: (self) => gsap.fromTo(self.words, { opacity: 0.16 }, {
            opacity: 1, stagger: 0.12, ease: 'none',
            scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 48%', scrub: 0.6 },
          }),
        });
      });

      fresh('[data-parallax]').forEach((el) => {
        const amt = parseFloat(el.dataset.parallax) || 8;
        gsap.fromTo(el, { yPercent: -amt }, {
          yPercent: amt, ease: 'none',
          scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });

      fresh('[data-count]').forEach(countUp);
    });

    let timer;
    const rescan = () => { clearTimeout(timer); timer = setTimeout(() => { scan(); ScrollTrigger.refresh(); }, 60); };
    const observer = new MutationObserver(rescan);
    observer.observe(root, { childList: true, subtree: true });
    // Images and fonts change the page height — keep trigger points honest.
    const onLoad = (e) => { if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') rescan(); };
    root.addEventListener('load', onLoad, true);
    document.fonts?.ready.then(rescan);

    try { scan(); } catch (err) {
      console.warn('Motion disabled:', err);
      html.classList.remove('motion-ok');
    }

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      root.removeEventListener('load', onLoad, true);
      ctx.revert();
    };
  }, [pathname]);

  return null;
};

export default MotionRoot;
