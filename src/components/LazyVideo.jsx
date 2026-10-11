import React, { useEffect, useRef, useState } from 'react';

// Video that only downloads when it's about to scroll into view, pauses
// when it leaves, and stays a still poster for reduced-motion / data-saver.
// Phones and slow links get the poster first; the film starts once the page has loaded.
const deferEager = () => {
  const c = navigator.connection;
  return window.matchMedia('(max-width: 767px)').matches || (c?.effectiveType && c.effectiveType !== '4g');
};

const LazyVideo = ({ src, phoneSrc, poster, className, eager = false, label, ...rest }) => {
  const ref = useRef(null);
  // Phones get the lighter encode when there is one (picked once, so it never swaps mid-play).
  const [file] = useState(() => (phoneSrc && window.matchMedia('(max-width: 767px)').matches ? phoneSrc : src));
  const [still] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!navigator.connection?.saveData);
  const [active, setActive] = useState(eager && !still && !deferEager());

  useEffect(() => {
    if (!eager || still || active) return undefined;
    let t;
    const go = () => { t = setTimeout(() => setActive(true), 600); };
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
    return () => { clearTimeout(t); window.removeEventListener('load', go); };
  }, [eager, still, active]);

  useEffect(() => {
    const el = ref.current;
    if (!el || still) return;

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setActive(true);
        el.play?.().catch(() => {});
      } else {
        el.pause?.();
      }
    }, { rootMargin: '120px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [still]);

  return (
    <video
      ref={ref}
      className={className}
      src={active ? file : undefined}
      poster={poster}
      muted
      loop
      playsInline
      autoPlay={active}
      preload={eager ? 'auto' : 'none'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}
    />
  );
};

export default LazyVideo;
