import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap, Clapperboard, ShieldCheck, ArrowUpRight, Sparkles, Instagram, CalendarDays, Handshake, Video, Lock } from 'lucide-react';
import { PROGRAMS } from './content';
import { marketHome } from '../lib/site';
import { CALENDLY, openCalendly } from '../lib/calendly';
import mark from '../assets/academy/collective-mark.png';
import melanie from '../assets/web/melanie23_rm.webp';
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
          <button type="button" className="k-btn k-btn--gold k-btn--lg" onClick={() => openCalendly('intro', { source: 'home-hero' })}><CalendarDays size={18} /> Book an intro call</button>
          <Link to="/mentorship" className="k-btn k-btn--light k-btn--lg">Explore mentorship <ArrowRight size={18} /></Link>
        </div>
      </div>
    </header>

    <section className="k-section ch-melanie" id="melanie">
      <div className="k-split k-split--wide-right">
        <div className="ch-melanie__photo" data-reveal="clip">
          <img src={melanie} alt="Melanie Jeffers-Cameron" loading="lazy" decoding="async" />
        </div>
        <div className="k-head" style={{ marginBottom: 0 }}>
          <p className="k-eyebrow" data-reveal="fade">Meet your mentor</p>
          <h2 className="k-h2" data-split>Melanie <em>Jeffers-Cameron</em></h2>
          <p className="k-lede" data-reveal>
            Melanie is the founder and lead curator of Proverbs 31 Marketplace, an Atlanta-based, traveling marketplace and
            community for women creatives and faith-driven entrepreneurs. She built it on a simple conviction: gifted women
            deserve a stage as excellent as their work.
          </p>
          <p className="k-body" data-reveal>
            The Collective carries that conviction from the market floor into the quieter work of building — a business with
            strategy, structure and accountability, and a life anchored in faith. In the Business Mentorship, Melanie works
            with women one-on-one, meeting each of them where they are.
          </p>
          <ul className="k-checks" data-reveal-group>
            <li><Sparkles size={18} /> Founder &amp; lead curator, Proverbs 31 Marketplace</li>
            <li><Sparkles size={18} /> Business mentor — strategy, structure, accountability, Kingdom impact</li>
            <li><Sparkles size={18} /> Building community for women across Atlanta</li>
          </ul>
          <figure className="ch-melanie__verse" data-reveal>
            <blockquote>“Give her of the fruit of her hands; and let her own works praise her in the gates.”</blockquote>
            <figcaption>Proverbs 31:31 · the verse P31 is built on</figcaption>
          </figure>
          <div className="k-actions" data-reveal>
            <button type="button" className="k-btn k-btn--plum" onClick={() => openCalendly('connect', { source: 'meet-melanie' })}><Handshake size={18} /> Connect with Melanie JC</button>
            <Link to="/mentorship/business" className="k-btn k-btn--ghost">Mentorship with Melanie <ArrowRight size={18} /></Link>
            <a href="https://www.instagram.com/proverbs31market" target="_blank" rel="noreferrer" className="k-btn k-btn--ghost"><Instagram size={17} /> Follow along</a>
          </div>
        </div>
      </div>
    </section>

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

    <section className="k-section k-section--mist" id="book">
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Ways to connect</p>
        <h2 className="k-h2" data-split>Book a <em>call</em></h2>
        <p className="k-lede" data-reveal>Pick a time that works for you — you’ll get a calendar invite right away.</p>
      </div>
      <div className="k-grid k-grid--3 ch-calls" data-reveal-group>
        <article className="ch-call ch-call--gold">
          <span className="ch-call__icon"><CalendarDays size={22} /></span>
          <small>{CALENDLY.intro.length} · open to everyone</small>
          <h3>Private Mentorship Intro Call</h3>
          <p>Talk through your goals and your season, and see whether the business or faith mentorship is the right fit.</p>
          <button type="button" className="k-btn k-btn--gold" onClick={() => openCalendly('intro', { source: 'book-section' })}>Book an intro call</button>
        </article>
        <article className="ch-call">
          <span className="ch-call__icon"><Handshake size={22} /></span>
          <small>{CALENDLY.connect.length} · open to everyone</small>
          <h3>Connect or Collab with Melanie JC</h3>
          <p>Partnerships, collaborations, speaking and community — a conversation with Melanie directly.</p>
          <button type="button" className="k-btn k-btn--plum" onClick={() => openCalendly('connect', { source: 'book-section' })}>Connect with Melanie JC</button>
        </article>
        <article className="ch-call ch-call--members">
          <span className="ch-call__icon"><Video size={22} /></span>
          <small>{CALENDLY.session.length} · active mentees</small>
          <h3>Private Mentorship Session</h3>
          <p>Already enrolled? Schedule your one-on-one session from your classroom, where your details are filled in for you.</p>
          <Link to="/portal" className="k-btn k-btn--ghost"><Lock size={16} /> Members: sign in to schedule</Link>
        </article>
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
