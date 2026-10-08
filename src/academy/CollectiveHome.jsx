import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap, Clapperboard, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { PROGRAMS } from './content';
import { marketHome } from '../lib/site';
import mark from '../assets/academy/collective-mark.png';
import './mentorship.css';
import './collective-home.css';

const DOORS = [
  { to: '/portal', Icon: GraduationCap, title: 'Mentorship classroom', who: 'Students & mentors', body: 'Lessons, sessions, action plans, your library and the member line.' },
  { to: '/studio', Icon: Clapperboard, title: 'Content Studio', who: 'P31 content team', body: 'Plan, create and schedule posts, and keep up with DMs and comments.' },
  { to: '/systems', Icon: ShieldCheck, title: 'Systems', who: 'P31 operations', body: 'Curators, orders, campaigns, analytics and the creative studios.' },
];

// thep31collective.org — home of the mentorships and every P31 team sign-in.
const CollectiveHome = () => (
  <div className="k-page ch">
    <header className="k-hero k-dark ch-hero">
      <span className="k-hero__arch ch-hero__arch" aria-hidden="true" data-reveal="fade" />
      <div className="ch-hero__inner k-center">
        <img src={mark} alt="" className="mt-mark ch-hero__mark" data-intro="0" />
        <p className="k-eyebrow k-eyebrow--center" data-intro="0.1">The Proverbs 31 Collective</p>
        <h1 className="k-display ch-hero__title" data-split="intro" data-delay="0.15">Rise, build <em>and become.</em></h1>
        <p className="k-lede" data-intro="0.4">
          Mentorship for faith-driven women — and the home of the P31 team. Classrooms, the Content Studio and Systems, all in one place.
        </p>
        <div className="k-actions ch-hero__actions" data-intro="0.55">
          <Link to="/mentorship" className="k-btn k-btn--gold k-btn--lg">Explore mentorship <ArrowRight size={18} /></Link>
          <Link to="/portal" className="k-btn k-btn--light k-btn--lg">Sign in</Link>
        </div>
      </div>
    </header>

    <section className="k-section">
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Mentorship</p>
        <h2 className="k-h2" data-split>Two paths, <em>one calling</em></h2>
        <p className="k-lede" data-reveal>Private mentorship that begins with a conversation. Book an intro call and we’ll find the right fit for your season.</p>
      </div>
      <div className="k-grid k-grid--2" data-reveal-group>
        {Object.values(PROGRAMS).map((p, i) => (
          <Link key={p.slug} to={`/mentorship/${p.slug}`} className={`k-card k-card--link mt-program ${i === 0 ? 'k-card--night' : ''}`}>
            <span className="k-num">0{i + 1}</span>
            <p className="mt-program__pillars">{p.pillars.join(' · ')}</p>
            <h3>{p.title} {p.accent}</h3>
            <p>{p.short}</p>
            <span className="k-link mt-program__go">Explore the mentorship <ArrowRight size={16} /></span>
          </Link>
        ))}
      </div>
    </section>

    <section className="k-section k-section--night k-dark">
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Members & team</p>
        <h2 className="k-h2" data-split>Sign in to your <em>dashboard</em></h2>
      </div>
      <div className="k-grid k-grid--3 ch-doors" data-reveal-group>
        {DOORS.map((d) => (
          <Link key={d.to} to={d.to} className="ch-door">
            <span className="k-icon"><d.Icon size={22} /></span>
            <small>{d.who}</small>
            <h3>{d.title}</h3>
            <p>{d.body}</p>
            <span className="k-link">Sign in <ArrowRight size={16} /></span>
          </Link>
        ))}
      </div>
    </section>

    <section className="k-section k-section--tight">
      <figure className="k-quote k-center" style={{ maxWidth: 980 }}>
        <blockquote data-scrub>“Strength and honour are her clothing; and she shall rejoice in time to come.”</blockquote>
        <figcaption data-reveal="fade">Proverbs 31:25 KJV</figcaption>
      </figure>
      <p className="k-center ch-market" data-reveal="fade">
        Looking for the market? <a href={marketHome()} className="k-link">Visit Proverbs 31 Marketplace <ArrowUpRight size={15} /></a>
      </p>
    </section>
  </div>
);

export default CollectiveHome;
