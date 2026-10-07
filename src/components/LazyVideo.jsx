import React, { useEffect, useRef, useState } from 'react';

// Video that only downloads when it's about to scroll into view, pauses
// when it leaves, and stays a still poster for reduced-motion / data-saver.
const LazyVideo = ({ src, poster, className, eager = false, label, ...rest }) => {
  const ref = useRef(null);
  const [still] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!navigator.connection?.saveData);
  const [active, setActive] = useState(eager && !still);

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
    }, { rootMargin: '300px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [still]);

  return (
    <video
      ref={ref}
      className={className}
      src={active ? src : undefined}
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
