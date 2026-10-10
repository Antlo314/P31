import React, { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, CalendarDays, Target, ClipboardCheck, TrendingUp, Users, Crown, BookOpen, Check, Mail } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import IntroCallForm from './IntroCallForm';
import CalendlyEmbed from '../components/CalendlyEmbed';
import { PROGRAMS, STEPS } from './content';
import { CONTACT_EMAIL } from '../lib/academy';
import mark from '../assets/academy/collective-mark.webp';
import founder from '../assets/web/melanie23_rm.webp';
import './mentorship.css';
import JoinCollective from '../components/JoinCollective';

const ICONS = { calendar: CalendarDays, target: Target, clipboard: ClipboardCheck, chart: TrendingUp, people: Users, crown: Crown, book: BookOpen };

const toCall = () => document.getElementById('intro-call')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

const IntroCallSection = ({ program }) => (
  <section className="k-section k-section--mist" id="intro-call">
    <div className="k-split" style={{ alignItems: 'start' }}>
      <div className="k-head" style={{ marginBottom: 0 }}>
        <p className="k-eyebrow" data-reveal="fade">Begin with a conversation</p>
        <h2 className="k-h2" data-split>Book your <em>intro call</em></h2>
        <p className="k-lede" data-reveal>
          Every mentorship starts with a real conversation about your goals and your season. If it’s the right fit,
          you’ll receive a private invitation with everything you need to begin.
        </p>
        <ol className="mt-steps" data-reveal-group>
          {STEPS.map(([t, b]) => <li key={t}><strong>{t}</strong><span>{b}</span></li>)}
        </ol>
      </div>
      <IntroCallBooking program={program} />
    </div>
  </section>
);

// Pick a time on the calendar, or leave details and we reach out.
const IntroCallBooking = ({ program }) => {
  const [mode, setMode] = useState('calendar');
  return (
    <div className="mt-book" data-reveal>
      <div className="mt-book__tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'calendar'} onClick={() => setMode('calendar')}>Pick a time</button>
        <button role="tab" aria-selected={mode === 'form'} onClick={() => setMode('form')}>Have us reach out</button>
      </div>
      {mode === 'calendar'
        ? <CalendlyEmbed kind="intro" source={program ? `mentorship-${program}` : 'mentorship'} />
        : <div className="k-card" style={{ padding: 'clamp(22px, 4vw, 40px)' }}><IntroCallForm program={program} /></div>}
      <p className="k-fine mt-book__note">30 minutes · you’ll get a calendar invite right away. Pricing is shared personally after your call.</p>
    </div>
  );
};

// /mentorship — both programs, no prices.
export const MentorshipLanding = () => (
  <div className="k-page">
    <PageHeader
      eyebrow="The Proverbs 31 Collective"
      title="Mentorship that"
      accent="makes room."
      lead="Private mentorship for faith-driven women — for the business you’re building and the woman you’re becoming."
      media={{ src: founder, portrait: true, alt: 'Melanie JC' }}
      actions={<>
        <JoinCollective className="k-btn k-btn--gold" />
        <button type="button" className="k-btn k-btn--light" onClick={toCall}>Book an intro call <ArrowRight size={18} /></button>
        <Link to="/portal" className="k-btn k-btn--light">Member sign in</Link>
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

    <section className="k-section k-section--night k-dark k-section--tight">
      <figure className="k-quote k-center" style={{ maxWidth: 980 }}>
        <blockquote data-scrub>“{PROGRAMS.business.verse[1]}”</blockquote>
        <figcaption data-reveal="fade">{PROGRAMS.business.verse[0]} KJV</figcaption>
      </figure>
    </section>

    <IntroCallSection />
  </div>
);

// /mentorship/:program
export const MentorshipProgram = () => {
  const { program } = useParams();
  const p = PROGRAMS[program];
  if (!p) return <Navigate to="/mentorship" replace />;

  return (
    <div className="k-page">
      <PageHeader
        eyebrow={p.eyebrow}
        title={p.title}
        accent={p.accent}
        lead={p.vision}
        actions={<>
          <JoinCollective className="k-btn k-btn--gold" />
          <button type="button" className="k-btn k-btn--light" onClick={toCall}>Book an intro call <ArrowRight size={18} /></button>
          <a href={`mailto:${CONTACT_EMAIL}`} className="k-btn k-btn--light"><Mail size={16} /> Email us</a>
        </>}
      >
        <ul className="mt-pillars">{p.pillars.map((x) => <li key={x}>{x}</li>)}</ul>
      </PageHeader>

      <section className="k-section">
        <div className="mt-sections">
          {p.sections.map((s, i) => {
            const Icon = ICONS[s.icon] || Check;
            return (
              <article className={`mt-block ${s.points.length > 5 ? 'is-wide' : ''}`} key={s.title} data-reveal>
                <span className="mt-block__icon"><Icon size={22} /></span>
                <div>
                  <p className="k-num">0{i + 1}</p>
                  <h2 className="k-h3">{s.title}</h2>
                  {s.intro && <p className="k-body" style={{ marginTop: 8 }}>{s.intro}</p>}
                  <ul className="k-checks mt-block__list">
                    {s.points.map((pt) => <li key={pt}><Check size={18} /> {pt}</li>)}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="k-section k-section--night k-dark k-section--tight">
        <figure className="k-quote k-center" style={{ maxWidth: 980 }}>
          <blockquote data-scrub>“{p.verse[1]}”</blockquote>
          <figcaption data-reveal="fade">{p.verse[0]} KJV</figcaption>
        </figure>
      </section>

      <IntroCallSection program={p.slug} />
    </div>
  );
};
