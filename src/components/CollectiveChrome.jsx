import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Mail, ArrowUpRight, ArrowUp, Instagram, Facebook, KeyRound, Home, GraduationCap, ShieldCheck, Store, Phone, MapPin, Users } from 'lucide-react';
import { isFlushRoute } from '../lib/routes';
import { marketHome } from '../lib/site';
import { EMAIL, OFFICE } from '../lib/team';
import mark from '../assets/academy/collective-mark.png';
import './Navbar.css';
import './Footer.css';
import './CollectiveChrome.css';
import JoinCollective from './JoinCollective';

// The Collective's two pillars: the Academy (mentorship) and Systems (the tools that grow both brands).
const ACADEMY = /^\/(academy|mentorship|verify|enroll)(\/|$)/;
const SYSTEMS = /^\/(systems|studio)(\/|$)/;

// Header and footer for thep31collective.org — the mentorship side of P31.
export const CollectiveNav = () => {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const overHero = isFlushRoute(pathname) && !scrolled;

  return (
    <>
    <header className={`nb cl-nb ${overHero ? 'nb--clear' : 'nb--glass'}`}>
      <div className="nb__inner">
        <Link to="/" className="nb__brand" aria-label="The Proverbs 31 Collective — home">
          <img src={mark} alt="" className="cl-nb__mark" />
          <span className="nb__wordmark">
            <strong>The Proverbs 31</strong>
            <small>Collective</small>
          </span>
        </Link>
        <nav className="nb__links" aria-label="Main">
          <NavLink to="/academy" className={() => `nb__link ${ACADEMY.test(pathname) ? 'active' : ''}`}>Academy</NavLink>
          <NavLink to="/systems" className={() => `nb__link ${SYSTEMS.test(pathname) ? 'active' : ''}`}>Systems</NavLink>
          <a href={marketHome()} className="nb__link">Marketplace <ArrowUpRight size={13} /></a>
        </nav>
        <div className="nb__actions cl-nb__actions">
          <JoinCollective className="nb__cta cl-nb__join" size={16} />
          <Link to="/portal" className="nb__cta cl-nb__signin" aria-label="Sign in"><KeyRound size={16} /> <span>Sign in</span></Link>
        </div>
      </div>
    </header>

    {/* Phones: the same floating tab bar as the market, with the Collective's pillars. */}
    <nav className="tb" aria-label="Main">
      <NavLink to="/" end className="tb__item"><Home size={20} /><span>Home</span></NavLink>
      <NavLink to="/academy" className={() => `tb__item ${ACADEMY.test(pathname) ? 'active' : ''}`}><GraduationCap size={20} /><span>Academy</span></NavLink>
      <NavLink to="/systems" className={() => `tb__item ${SYSTEMS.test(pathname) ? 'active' : ''}`}><ShieldCheck size={20} /><span>Systems</span></NavLink>
      <a href={marketHome()} className="tb__item"><Store size={20} /><span>Market</span></a>
      <NavLink to="/portal" className="tb__item"><KeyRound size={20} /><span>Sign in</span></NavLink>
    </nav>
    </>
  );
};

export const CollectiveFooter = () => (
  <footer className="ft k-dark cl-ft">
    <div className="ft__inner">
      <div className="ft__grid">
        <div className="ft__brand">
          <Link to="/" className="ft__logo">
            <img src={mark} alt="" className="cl-ft__mark" />
            <span><strong>The Proverbs 31 Collective</strong><small>Mentorship &amp; team</small></span>
          </Link>
          <p>Private business and faith-based mentorship for faith-driven women — for the business you’re building and the woman you’re becoming.</p>
          <JoinCollective className="k-btn k-btn--gold k-btn--sm cl-ft__join" size={16} />
          <div className="ft__social">
            <a href="https://www.instagram.com/proverbs31market" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
            <a href="https://www.facebook.com/share/1LEtAu9AJD/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>
          </div>
        </div>
        <nav className="ft__col" aria-label="Academy">
          <h4>Academy</h4>
          <Link to="/academy">The P31 Academy</Link>
          <Link to="/mentorship/business">Business mentorship</Link>
          <Link to="/mentorship/faith">Faith-based mentorship</Link>
          <Link to="/portal">Classroom sign in</Link>
          <Link to="/verify">Verify a certificate</Link>
        </nav>
        <nav className="ft__col" aria-label="Systems">
          <h4>Systems</h4>
          <Link to="/systems">P31 Systems</Link>
          <Link to="/studio">Content Studio</Link>
          <Link to="/systems/sign-in">Team sign in</Link>
        </nav>
        <div className="ft__col">
          <h4>Contact</h4>
          <a href={`mailto:${EMAIL.members}`}><Mail size={15} /> {EMAIL.members}</a>
          <a href={`mailto:${EMAIL.support}`}><Mail size={15} /> {EMAIL.support}</a>
          <a href={`tel:${OFFICE.tel}`}><Phone size={15} /> {OFFICE.phone}</a>
          <span><MapPin size={15} /> {OFFICE.mailing.join(', ')}</span>
          <Link to="/#team"><Users size={15} /> Meet the team</Link>
          <a href={marketHome()}><ArrowUpRight size={15} /> Proverbs 31 Marketplace</a>
        </div>
      </div>
      <div className="ft__bottom">
        <span>© {new Date().getFullYear()} The P31 Collective by NEBA · a Proverbs 31 Marketplace ministry</span>
        <span className="ft__bottom-links">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top <ArrowUp size={14} /></button>
        </span>
      </div>
    </div>
  </footer>
);
