import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Tour from '../components/Tour';
import { startTour } from '../components/tourEvents';
import { SYSTEMS_CHAPTERS } from './walkthroughs';

/**
 * Plays any Systems walkthrough chapter (src/systems/walkthroughs.js): startTour('sys:orders',
 * { autoplay: true }) from anywhere in the console, or a link like /systems/orders?tour=sys:orders&auto=1.
 */
const SystemsTour = ({ user }) => {
  const [active, setActive] = useState(null);
  const { search } = useLocation();

  useEffect(() => {
    const onStart = (e) => {
      const d = typeof e.detail === 'string' ? { id: e.detail } : e.detail || {};
      if (SYSTEMS_CHAPTERS[d.id]) setActive((a) => (a?.id === d.id ? a : { id: d.id, autoplay: !!d.autoplay, n: Date.now() }));
    };
    window.addEventListener('p31:tour', onStart);
    return () => window.removeEventListener('p31:tour', onStart);
  }, []);

  // A ?tour=sys:… link mounts that chapter; the Tour itself then reads the link and starts.
  useEffect(() => {
    const id = new URLSearchParams(search).get('tour');
    if (!id || !SYSTEMS_CHAPTERS[id]) return undefined;
    const t = setTimeout(() => setActive((a) => (a?.id === id ? a : { id, autoplay: false, fromLink: true, n: Date.now() })), 0);
    return () => clearTimeout(t);
  }, [search]);

  // Started by a button: once the chapter is mounted, tell it to begin.
  useEffect(() => {
    if (!active || active.fromLink) return undefined;
    const t = setTimeout(() => startTour(active.id, { autoplay: active.autoplay }), 30);
    return () => clearTimeout(t);
  }, [active]);

  if (!active) return null;
  const chapter = SYSTEMS_CHAPTERS[active.id];
  return <Tour key={active.n} id={active.id} steps={chapter.steps} user={user} autoStart={false} onEnd={() => setActive(null)} />;
};

export default SystemsTour;
