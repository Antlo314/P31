import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap, Clapperboard, ShieldCheck, ArrowUpRight, Sparkles, Instagram, CalendarDays, Handshake, Video, Lock } from 'lucide-react';
import { PROGRAMS } from './content';
import { marketHome } from '../lib/site';
import { CALENDLY, openCalendly } from '../lib/calendly';
import TeamDirectory from '../components/TeamDirectory';
import mark from '../assets/academy/collective-mark.webp';
import melanie from '../assets/web/melanie23_rm.webp';
import './mentorship.css';
import './collective-home.css';
import './pillars.css';
import JoinCollective from '../components/JoinCollective';

// The Collective's two pillars, plus the Studio the content team signs in to.
const DOORS = [
  { to: '/academy', Icon: GraduationCap, title: 'Academy', who: 'Mentorship', body: 'Business and faith-based mentorship with Melanie: your classroom, live sessions and certificate.', cta: 'Explore the Academy' },
  { to: '/systems', Icon: ShieldCheck, title: 'Systems', who: 'The P31 tools', body: 'Clip Studio, Photo Studio, the CRM and more, built to help the market and the Collective grow.', cta: 'See the tools' },
  { to: '/studio', Icon: Clapperboard, title: 'Content Studio', who: 'P31 content team', body: 'Plan, create and schedule posts, and keep up with DMs and comments.', cta: 'Sign in' },
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
          Mentorship for faith-driven women, and the home of the P31 team: the Academy for mentorship, and Systems, the tools that help the market and the Collective grow.
        </p>
        <div className="k-actions ch-hero__actions" data-intro="0.55">
          <JoinCollective className="k-btn k-btn--gold k-btn--lg" />
          <button type="button" className="k-btn k-btn--light k-btn--lg" onClick={() => openCalendly('intro', { source: 'home-hero' })}><CalendarDays size={18} /> Book an intro call</button>
          <Link to="/academy" className="k-btn k-btn--light k-btn--lg">Explore the Academy <ArrowRight size={18} /></Link>
        </div>
      </div>
    </header>

    <section className="k-section ch-melanie" id="melanie">
      <div className="k-split k-split--wide-right">
        <div className="ch-melanie__photo" data-reveal="clip">
          <img src={melanie} alt="Melanie JC" loading="lazy" decoding="async" />
        </div>
        <div className="k-head" style={{ marginBottom: 0 }}>
          <p className="k-eyebrow" data-reveal="fade">Meet your mentor</p>
          <h2 className="k-h2" data-split>Melanie <em>JC</em></h2>
          <p className="k-lede" data-reveal>
            A passionate servant of God, visionary, mentor, and entrepreneur, Melanie JC is a woman driven by purpose,
            anchored in faith, and led by obedience.
          </p>
          <p className="k-body" data-reveal>
            In 2019, she founded Not Easily Broken Apart (NEBA) Women’s Ministry, a faith-based ministry dedicated to healing,
            restoration, and purposeful living through biblical teaching and intentional mentorship. As a spiritual matriarch with
            a heart for cultivating spiritual and emotional wholeness, Melanie has devoted herself to helping individuals break
            cycles, discover their God-given identity, and walk boldly in their calling.
          </p>
          <p className="k-body" data-reveal>
            As the visionary behind Proverbs 31 Marketplace and The P31 Collective by NEBA, Melanie has expanded that mission to
            bridge faith, fellowship, purpose, and business. What began as a calling to help women heal has evolved into a
            movement empowering women to build, lead, and prosper God’s way.
          </p>
          <details className="ch-melanie__more" data-reveal>
            <summary>Read her full story</summary>
            <p className="k-body">
              Through marketplace experiences, meaningful connections, business mentorship, and community, she is cultivating an
              environment where faith-driven women are equipped to turn their gifts into purpose-filled endeavors.
            </p>
            <p className="k-body">
              Melanie is also the CEO of Incandescent Lily Collection, a plant-based body care brand established in 2023. With a
              foundation in theological education through her seminary studies, complemented by academic achievements in Emotional
              Intelligence, the Arts and Science of Relationships, and Leadership, she brings both biblical wisdom and practical
              insight to her work. As a visionary and matriarch, she believes that true leadership is cultivated through spiritual
              maturity, intentional stewardship, and, above all, obedience to God.
            </p>
            <p className="k-body">
              Her mission extends beyond building businesses; it is about building people. As a matriarch, mentor and Kingdom
              builder, she is committed to empowering women to heal spiritually, grow emotionally, prosper financially, and
              establish legacies that will impact generations to come.
            </p>
            <p className="k-body">
              For Melanie, success is not merely measured by what she acquires, but by what she stewards, whom she serves, and
              what she leaves behind.
            </p>
          </details>
          <ul className="k-checks" data-reveal-group>
            <li><Sparkles size={18} /> Founder, Not Easily Broken Apart (NEBA) Women’s Ministry, 2019</li>
            <li><Sparkles size={18} /> Visionary behind Proverbs 31 Marketplace and The P31 Collective by NEBA</li>
            <li><Sparkles size={18} /> CEO, Incandescent Lily Collection, plant-based body care, est. 2023</li>
            <li><Sparkles size={18} /> Seminary studies; Emotional Intelligence, the Arts &amp; Science of Relationships, and Leadership</li>
          </ul>
          <figure className="ch-melanie__verse" data-reveal>
            <blockquote>Heal. Rise. Build. Prosper God’s Way.</blockquote>
            <figcaption>Her mandate is simple · With grace &amp; purpose, Melanie JC</figcaption>
          </figure>
          <div className="k-actions" data-reveal>
            <JoinCollective className="k-btn k-btn--gold" />
            <button type="button" className="k-btn k-btn--plum" onClick={() => openCalendly('connect', { source: 'meet-melanie' })}><Handshake size={18} /> Connect with Melanie JC</button>
            <Link to="/academy" className="k-btn k-btn--ghost">Mentorship with Melanie <ArrowRight size={18} /></Link>
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

    <section className="k-section" id="team">
      <TeamDirectory eyebrow="The P31 team" lede="Reach the right person directly. We’re here Monday to Friday." />
    </section>

    <section className="k-section k-section--night k-dark">
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Academy & Systems</p>
        <h2 className="k-h2" data-split>Where would you <em>like to go?</em></h2>
      </div>
      <div className="k-grid k-grid--3 ch-doors" data-reveal-group>
        {DOORS.map((d) => (
          <Link key={d.to} to={d.to} className="ch-door">
            <span className="k-icon"><d.Icon size={22} /></span>
            <small>{d.who}</small>
            <h3>{d.title}</h3>
            <p>{d.body}</p>
            <span className="k-link">{d.cta} <ArrowRight size={16} /></span>
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
      <div className="k-actions pl-center" data-reveal><JoinCollective className="k-btn k-btn--gold k-btn--lg" /></div>
    </section>
  </div>
);

export default CollectiveHome;
