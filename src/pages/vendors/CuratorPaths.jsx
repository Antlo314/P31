import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarHeart, Store, ArrowRight, Check } from 'lucide-react';
import './forms.css';

// The two ways to become a P31 curator, each with its own page (the CEO's request, 2026-10-14):
// a booth at a market event (/apply) and a virtual storefront on p31market.com (/storefront).
const PATHS = [
  {
    key: 'market', to: '/apply#apply', Icon: CalendarHeart, kicker: 'Market events', title: 'Vend at a P31 Market',
    body: 'A booth at our seasonal Atlanta markets. Apply once; acceptance and event details are emailed to you.',
    cta: 'Apply to vend',
  },
  {
    key: 'storefront', to: '/storefront#sign', Icon: Store, kicker: 'Online, all year', title: 'Open a virtual storefront',
    body: 'Your own storefront on p31market.com: up to 10 products or services, P31 marketing and support. Free for your first 3 months.',
    cta: 'Start your storefront',
  },
];

/** "Which door?" strip at the top of both pages; `current` marks the page you are on. */
const CuratorPaths = ({ current }) => (
  <section className="k-section k-section--tight" aria-label="Two ways to become a curator">
    <div className="vf-paths" data-reveal-group>
      {PATHS.map((p) => {
        const here = p.key === current;
        const Inner = (
          <>
            <span className="k-icon"><p.Icon size={20} /></span>
            <small>{p.kicker}</small>
            <h3>{p.title}</h3>
            <p>{p.body}</p>
            <span className="k-link">{here ? <><Check size={14} /> You are here · fill in the form below</> : <>{p.cta} <ArrowRight size={14} /></>}</span>
          </>
        );
        return here
          ? <a key={p.key} href={`#${p.to.split('#')[1]}`} className="vf-path is-here" aria-current="page">{Inner}</a>
          : <Link key={p.key} to={p.to} className="vf-path">{Inner}</Link>;
      })}
    </div>
    <p className="k-fine vf-paths__note">Many curators do both. Start with either; the team will help with the other.</p>
  </section>
);

export default CuratorPaths;
