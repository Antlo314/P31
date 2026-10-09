import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { collectiveHome } from '../lib/site';
import founder from '../assets/web/melanie23_rm.webp';
import './FounderNote.css';
import { JOIN_COLLECTIVE_URL } from '../lib/academy';

// A small "why she started it" insert for the marketplace. Melanie's full story
// lives on the Collective.
const FounderNote = ({ dark = false }) => (
  <aside className={`fn ${dark ? 'fn--dark' : ''}`} data-reveal>
    <span className="fn__photo"><img src={founder} alt="Melanie JC" loading="lazy" decoding="async" /></span>
    <div className="fn__copy">
      <p className="fn__eyebrow">Why it began</p>
      <p className="fn__quote">Melanie started P31 with a simple conviction: gifted women deserve a stage as excellent as their work.</p>
      <p className="fn__by">
        Melanie JC, founder ·{' '}
        <a href={`${collectiveHome()}#melanie`}>Meet Melanie <ArrowUpRight size={14} /></a>
        {' · '}
        <a href={JOIN_COLLECTIVE_URL} target="_blank" rel="noopener noreferrer">Join P31 Collective <ArrowUpRight size={14} /></a>
      </p>
    </div>
  </aside>
);

export default FounderNote;
