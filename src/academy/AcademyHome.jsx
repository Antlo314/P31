import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CalendarDays, KeyRound, BookOpen, ClipboardCheck, Video, MessageCircle, FolderLock,
  Target, Award, Smartphone, BadgeCheck,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { PROGRAMS, STEPS } from './content';
import { openCalendly } from '../lib/calendly';
import mark from '../assets/academy/collective-mark.png';
import founder from '../assets/web/melanie23_rm.webp';
import './mentorship.css';
import './collective-home.css';
import './pillars.css';
import JoinCollective from '../components/JoinCollective';

// What every member gets, in either program.
const INSIDE = [
  { Icon: BookOpen, title: 'Lessons at your pace', body: 'Modules with video, notes and downloads, released by your mentor.' },
  { Icon: ClipboardCheck, title: 'Assignments with clear criteria', body: 'See exactly how work is graded, hand it in, and get written feedback.' },
  { Icon: Video, title: 'Live classes in your browser', body: 'Group sessions and one-on-ones open right in the classroom. Nothing to install.' },
  { Icon: MessageCircle, title: 'A private line to your mentor', body: 'Questions, wins and prayer requests between sessions, with files and photos.' },
  { Icon: FolderLock, title: 'Tasks and files just for you', body: 'Personal assignments and private documents only you can see.' },
  { Icon: Target, title: 'Action plans and goals', body: 'Clear next steps after every session, and goals your mentor helps you reach.' },
  { Icon: Award, title: 'Progress and a certificate', body: 'Track what’s left to finish and earn a certificate anyone can verify.' },
  { Icon: Smartphone, title: 'On your phone', body: 'Install the classroom like an app and get notified when something new arrives.' },
];

// /academy — the mentorship side of the Collective: both programs, how to join, and the classroom.
const AcademyHome = () => (
  <div className="k-page">
    <PageHeader
      eyebrow="The P31 Academy"
      title="Mentorship,"
      accent="made personal."
      lead="Private business and faith-based mentorship with Melanie JC: your own classroom, live sessions and a mentor who knows your name."
      media={{ src: founder, portrait: true, alt: 'Melanie JC' }}
      actions={<>
        <JoinCollective className="k-btn k-btn--gold" />
        <button type="button" className="k-btn k-btn--light" onClick={() => openCalendly('intro', { source: 'academy-hero' })}><CalendarDays size={18} /> Book an intro call</button>
        <Link to="/portal" className="k-btn k-btn--light"><KeyRound size={17} /> Member sign in</Link>
      </>}
    />

    <section className="k-section">
      <div className="k-head k-center">
        <img src={mark} alt="" className="mt-mark" data-reveal="scale" />
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Two paths, one calling</p>
        <h2 className="k-h2" data-split>Choose your <em>mentorship</em></h2>
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

    <section className="k-section k-section--mist">
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">How it works</p>
        <h2 className="k-h2" data-split>From first call to <em>your classroom</em></h2>
        <p className="k-lede" data-reveal>Every mentorship begins with a conversation. Pricing is shared personally after your call.</p>
      </div>
      <ol className="pl-steps" data-reveal-group>
        {STEPS.map(([t, b], i) => (
          <li key={t}><span className="pl-steps__n">0{i + 1}</span><strong>{t}</strong><span>{b}</span></li>
        ))}
      </ol>
      <div className="k-actions k-center pl-center" data-reveal>
        <button type="button" className="k-btn k-btn--gold" onClick={() => openCalendly('intro', { source: 'academy-steps' })}><CalendarDays size={18} /> Book an intro call</button>
        <JoinCollective className="k-btn k-btn--plum" />
        <Link to="/mentorship" className="k-btn k-btn--ghost">More about the mentorships <ArrowRight size={17} /></Link>
      </div>
    </section>

    <section className="k-section">
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Inside your classroom</p>
        <h2 className="k-h2" data-split>Everything in <em>one place</em></h2>
      </div>
      <div className="k-grid k-grid--4 pl-features" data-reveal-group>
        {INSIDE.map((f) => (
          <article key={f.title} className="pl-feature">
            <span className="k-icon"><f.Icon size={20} /></span>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="k-section k-section--mist">
      <div className="k-head k-center pl-mentor">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Your mentor</p>
        <h2 className="k-h2" data-split>Melanie <em>JC</em></h2>
        <p className="k-lede" data-reveal>
          A passionate servant of God, visionary, mentor, and entrepreneur, Melanie JC is a woman driven by purpose, anchored in
          faith, and led by obedience. Founder of Not Easily Broken Apart (NEBA) Women’s Ministry and the visionary behind
          Proverbs 31 Marketplace and The P31 Collective by NEBA.
        </p>
        <figure className="ch-melanie__verse pl-mentor__mandate" data-reveal>
          <blockquote>Heal. Rise. Build. Prosper God’s Way.</blockquote>
          <figcaption>Her mandate</figcaption>
        </figure>
        <div className="k-actions pl-center" data-reveal>
          <JoinCollective className="k-btn k-btn--gold" />
          <Link to="/#melanie" className="k-btn k-btn--ghost">Read her story <ArrowRight size={17} /></Link>
        </div>
      </div>
    </section>

    <section className="k-section k-section--night k-dark">
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Members</p>
        <h2 className="k-h2" data-split>Already <em>enrolled?</em></h2>
      </div>
      <div className="k-grid k-grid--2 ch-doors" data-reveal-group>
        <Link to="/portal" className="ch-door">
          <span className="k-icon"><KeyRound size={22} /></span>
          <small>Students &amp; mentors</small>
          <h3>Sign in to your classroom</h3>
          <p>Lessons, sessions, assignments, your library and the member line.</p>
          <span className="k-link">Sign in <ArrowRight size={16} /></span>
        </Link>
        <Link to="/verify" className="ch-door">
          <span className="k-icon"><BadgeCheck size={22} /></span>
          <small>Anyone</small>
          <h3>Verify a certificate</h3>
          <p>Confirm a Proverbs 31 Collective certificate of completion by its number.</p>
          <span className="k-link">Verify <ArrowRight size={16} /></span>
        </Link>
      </div>
    </section>
  </div>
);

export default AcademyHome;
