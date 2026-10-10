import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, KeyRound, Clapperboard, ImagePlus, Film, Megaphone, MessageCircleHeart, Users, Radar,
  Mail, CalendarDays, Receipt, GraduationCap, Store, Sparkles,
} from 'lucide-react';
import { CollectiveNav, CollectiveFooter } from '../components/CollectiveChrome';
import PageHeader from '../components/PageHeader';
import MotionRoot from '../components/MotionRoot';
import { COLLECTIVE_META, applyMeta } from '../lib/seo';
import { hrefFor } from '../lib/site';
import '../academy/mentorship.css';
import '../academy/collective-home.css';
import '../academy/pillars.css';
import JoinCollective from '../components/JoinCollective';
import Scene3D from '../components/three/Scene3D';

const M = 'Marketplace';
const C = 'Collective';

// The tools P31 builds for itself, grouped by what they do.
const GROUPS = [
  {
    eyebrow: 'Create', title: 'Make the content', tools: [
      { Icon: Clapperboard, name: 'Clip Studio', serves: [M, C], body: 'Raw phone footage in, a finished reel out: it cuts the dead air, adds transitions, a look and timed captions you can style.' },
      { Icon: ImagePlus, name: 'Photo Studio', serves: [M, C], body: 'Removes backgrounds, stages products on a backdrop and frames them for every channel. Curators use it from their phones.' },
      { Icon: Film, name: 'Pro Edit', serves: [M, C], body: 'Premium DaVinci Resolve edits for curators and the team, handled by Iris and delivered back to the dashboard.' },
    ],
  },
  {
    eyebrow: 'Share', title: 'Show up every day', tools: [
      { Icon: Megaphone, name: 'Content Studio', serves: [M, C], body: 'Instagram and Facebook in one place: plan the month, schedule posts, see what works and when to post.', to: '/studio' },
      { Icon: MessageCircleHeart, name: 'Carla, the P31 assistant', serves: [M, C], body: 'Answers DMs, comments, story replies and Google reviews in a warm P31 voice, and points people to the right place.' },
      { Icon: Mail, name: 'Campaigns', serves: [M, C], body: 'Email the Inner Circle, curators or everyone, with AI help drafting and a test send first.' },
    ],
  },
  {
    eyebrow: 'Grow', title: 'Know every person', tools: [
      { Icon: Users, name: 'CRM', serves: [M, C], body: 'One timeline per person, from first sign-up to market RSVPs, intro calls, enrollment and live classes.' },
      { Icon: Radar, name: 'Growth', serves: [M, C], body: 'Finds groups, creators and events that fit P31, and tracks the outreach.' },
      { Icon: CalendarDays, name: 'Markets & RSVPs', serves: [M], body: 'Create markets, choose when the date goes public, and see who’s coming.' },
      { Icon: Receipt, name: 'Orders', serves: [M], body: 'Every shop’s card sales and order requests, updating live.' },
      { Icon: GraduationCap, name: 'Academy tools', serves: [C], body: 'Mentors, members, private plans and live-class tracking behind both mentorships.' },
    ],
  },
];

// /systems for visitors: what P31 Systems is. The team signs in from here; signed-in operators
// never see this page (they land in the console).
const SystemsShowcase = () => {
  useEffect(() => { applyMeta({ path: '/systems', ...COLLECTIVE_META['/systems'] }); }, []);

  return (
    <div className="app-container cl-site">
      <CollectiveNav />
      <MotionRoot />
      <main className="site-main is-flush">
        <div className="k-page">
          <PageHeader
            eyebrow="P31 Systems"
            title="The engine behind"
            accent="both brands."
            lead="The tools we build to help the Marketplace and the Collective grow: content, video, photos, people and markets, working together."
            visual={<Scene3D variant="engine" />}
            actions={<>
              <a href="#tools" className="k-btn k-btn--gold">See the tools <ArrowRight size={18} /></a>
              <Link to="/systems/sign-in" className="k-btn k-btn--light"><KeyRound size={17} /> Team sign in</Link>
            </>}
          />

          {GROUPS.map((g, gi) => (
            <section key={g.eyebrow} id={gi === 0 ? 'tools' : undefined} className={`k-section ${gi === 1 ? 'k-section--mist' : ''}`}>
              <div className="k-head k-center">
                <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">{g.eyebrow}</p>
                <h2 className="k-h2" data-split>{g.title.split(' ').slice(0, -1).join(' ')} <em>{g.title.split(' ').slice(-1)}</em></h2>
              </div>
              <div className="k-grid k-grid--3 pl-tools" data-reveal-group>
                {g.tools.map((t) => (
                  <article key={t.name} className="pl-tool" data-tilt>
                    <span className="k-icon"><t.Icon size={20} /></span>
                    <h3>{t.name}</h3>
                    <p>{t.body}</p>
                    <span className="pl-serves">
                      {t.serves.map((s) => <span key={s} className={`pl-tag ${s === M ? 'pl-tag--market' : ''}`}>{s}</span>)}
                    </span>
                    {t.to && <Link to={t.to} className="k-link pl-tool__go">Open <ArrowRight size={15} /></Link>}
                  </article>
                ))}
              </div>
            </section>
          ))}

          <section className="k-section k-section--night k-dark">
            <div className="k-head k-center">
              <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">Built for both</p>
              <h2 className="k-h2" data-split>One engine, <em>two front doors</em></h2>
            </div>
            <div className="k-grid k-grid--2 ch-doors" data-reveal-group>
              <a href={hrefFor('/')} className="ch-door">
                <span className="k-icon"><Store size={22} /></span>
                <small>p31market.com</small>
                <h3>For the Marketplace</h3>
                <p>Curators get Photo and Clip Studio on their phones. Markets fill through RSVPs, campaigns and Growth, and every order lands in one place.</p>
                <span className="k-link">Visit the market <ArrowUpRight size={16} /></span>
              </a>
              <Link to="/academy" className="ch-door">
                <span className="k-icon"><Sparkles size={22} /></span>
                <small>thep31collective.org</small>
                <h3>For the Collective</h3>
                <p>The CRM follows each woman from intro call to certificate, live classes are tracked automatically, and the Studio keeps the mentorship visible.</p>
                <span className="k-link">Explore the Academy <ArrowRight size={16} /></span>
              </Link>
            </div>
          </section>

          <section className="k-section k-section--tight">
            <div className="k-actions pl-center" data-reveal style={{ marginTop: 0, marginBottom: 'clamp(28px, 4vw, 48px)' }}><JoinCollective className="k-btn k-btn--gold" /></div>
            <div className="k-head k-center">
              <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">P31 team</p>
              <h2 className="k-h2" data-split>Sign in to <em>your tools</em></h2>
            </div>
            <div className="k-actions pl-center" data-reveal>
              <Link to="/systems/sign-in" className="k-btn k-btn--plum"><KeyRound size={17} /> Systems sign in</Link>
              <Link to="/studio" className="k-btn k-btn--ghost">Content Studio <ArrowRight size={17} /></Link>
              <a href={hrefFor('/login')} className="k-btn k-btn--ghost">Curator Portal <ArrowUpRight size={16} /></a>
            </div>
          </section>
        </div>
      </main>
      <CollectiveFooter />
    </div>
  );
};

export default SystemsShowcase;
