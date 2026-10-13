import React, { useEffect, useRef } from 'react';
import { sizeOf } from './draw';
import { paintThumb } from './thumbs';

/** A design preview that fills its width. */
const Thumb = ({ doc, width = 220, className = '', label }) => {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !doc) return;
    let live = true;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && live) { io.disconnect(); paintThumb(c, doc); }
    }, { rootMargin: '200px' });
    io.observe(c);
    return () => { live = false; io.disconnect(); };
  }, [doc]);
  const { w, h } = sizeOf(doc);
  return <canvas ref={ref} width={width} height={Math.round(width * (h / w))} className={`dz-thumb ${className}`} role="img" aria-label={label || 'Design preview'} />;
};

export default Thumb;
