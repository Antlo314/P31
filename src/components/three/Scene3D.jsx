import React, { useEffect, useRef } from 'react';
import { reducedMotion } from '../../lib/motion';
import './scene3d.css';

// Can this device draw WebGL at all? (Checked once, without loading Three.js.)
let webgl;
const hasWebGL = () => {
  if (webgl !== undefined) return webgl;
  try {
    const c = document.createElement('canvas');
    webgl = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { webgl = false; }
  return webgl;
};

/**
 * A decorative 3D accent (gem | arches | engine). Three.js downloads only when the
 * accent is about to scroll into view, renders only while visible, and is skipped on
 * data-saver or devices without WebGL — the CSS glow behind it stays as the fallback.
 * Reduced motion: one still frame, no animation.
 */
const Scene3D = ({ variant = 'gem', className = '' }) => {
  const host = useRef(null);

  useEffect(() => {
    const el = host.current;
    if (!el || navigator.connection?.saveData || !hasWebGL()) return undefined;
    let scene = null;
    let visible = false;
    let cancelled = false;

    const mount = async () => {
      try {
        const { createScene } = await import('./scenes');
        if (cancelled) return;
        scene = createScene(el, variant, { still: reducedMotion() });
        el.classList.add('is-live');
        if (visible) scene.start();
      } catch (err) {
        console.warn('3D accent unavailable:', err?.message || err);
      }
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !scene) mount();
      else if (scene) (visible ? scene.start() : scene.stop());
    }, { rootMargin: '200px 0px' });
    io.observe(el);

    const onVis = () => { if (!scene) return; if (document.hidden) scene.stop(); else if (visible) scene.start(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      scene?.dispose();
    };
  }, [variant]);

  return <div ref={host} className={`s3d s3d--${variant} ${className}`} aria-hidden="true" />;
};

export default Scene3D;
