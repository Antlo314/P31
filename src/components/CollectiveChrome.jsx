import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Mail, ArrowUpRight, ArrowUp, Instagram, Facebook, KeyRound } from 'lucide-react';
import { isFlushRoute } from '../lib/routes';
import { marketHome } from '../lib/site';
import { CONTACT_EMAIL } from '../lib/academy';
import mark from '../assets/academy/collective-mark.png';
import './Navbar.css';
import './Footer.css';
import './CollectiveChrome.css';

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
          <NavLink to="/mentorship/business" className="nb__link">Business</NavLink>
          <NavLink to="/mentorship/faith" className="nb__link">Faith</NavLink>
          <a href={marketHome()} className="nb__link">Marketplace <ArrowUpRight size={13} /></a>
        </nav>
        <div className="nb__actions cl-nb__actions">
          <Link to="/portal" className="nb__cta"><KeyRound size={16} /> <span>Member sign in</span></Link>
        </div>
      </div>
    </header>
  );
};

export const CollectiveFooter = () => (
  <footer className="ft k-dark cl-ft">
    <div className="ft__inner">
      <div className="ft__grid">
        <div className="ft__brand">
          <Link to="/" className="ft__logo">
            <img src={mark} alt="" className="cl-ft__mark" />
            <span><strong>The Proverbs 31 Collective</strong><small>Mentorship</small></span>
          </Link>
          <p>Private business and faith-based mentorship for faith-driven women — for the business you’re building and the woman you’re becoming.</p>
          <div className="ft__social">
            <a href="https://www.instagram.com/proverbs31market" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
            <a href="https://www.facebook.com/share/1LEtAu9AJD/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>
          </div>
        </div>
        <nav className="ft__col" aria-label="Mentorship">
          <h4>Mentorship</h4>
          <Link to="/mentorship/business">Business mentorship</Link>
          <Link to="/mentorship/faith">Faith-based mentorship</Link>
          <Link to="/portal">Member sign in</Link>
        </nav>
        <div className="ft__col">
          <h4>Contact</h4>
          <a href={`mailto:${CONTACT_EMAIL}`}><Mail size={15} /> {CONTACT_EMAIL}</a>
          <a href={marketHome()}><ArrowUpRight size={15} /> Proverbs 31 Marketplace</a>
        </div>
      </div>
      <div className="ft__bottom">
        <span>© {new Date().getFullYear()} The Proverbs 31 Collective · a Proverbs 31 Marketplace ministry</span>
        <span className="ft__bottom-links">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top <ArrowUp size={14} /></button>
        </span>
      </div>
    </div>
  </footer>
);
