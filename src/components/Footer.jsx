import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Mail, Phone, HeartHandshake, ArrowUpRight, MapPin, ArrowRight, ArrowUp, Star } from 'lucide-react';
import { openJoin } from '../lib/join';
import { collectivePortal, hrefFor } from '../lib/site';
import logoPath from '../assets/web/p31-mark-192.webp';
import './Footer.css';
import { EMAIL } from '../lib/team';
import { JOIN_PATH } from '../lib/academy';

const APPLY_URL = 'https://forms.gle/vmkK7fhgwiYNYEa38';
// Opens the "write a review" box on our Google Business Profile.
const GOOGLE_REVIEW_URL = 'https://search.google.com/local/writereview?placeid=ChIJ1TZlBgq_9YgROkLISp4BB7U';

const TikTok = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5v3a8 8 0 0 1-5-1.5z" />
  </svg>
);

const Footer = () => (
  <footer className="ft k-dark">
    <div className="ft__inner">
      <section className="ft__statement">
        <p className="k-eyebrow">Proverbs 31 Marketplace</p>
        <h2 className="ft__title">Where her gifts <em>make room.</em></h2>
        <div className="k-actions">
          <button type="button" className="k-btn k-btn--gold" onClick={openJoin}>Join the collective <ArrowRight size={18} /></button>
          <a href={APPLY_URL} target="_blank" rel="noopener noreferrer" className="k-btn k-btn--light">Become a curator <ArrowUpRight size={18} /></a>
        </div>
      </section>

      <div className="ft__grid">
        <div className="ft__brand">
          <Link to="/" className="ft__logo">
            <img src={logoPath} alt="" />
            <span><strong>Proverbs 31</strong><small>Marketplace</small></span>
          </Link>
          <p>A traveling collective of creativity, empowering women to rise and build using their gifts.</p>
          <div className="ft__social">
            <a href="https://www.instagram.com/proverbs31market" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
            <a href="https://www.facebook.com/share/1LEtAu9AJD/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>
            <a href="https://www.tiktok.com/@p31marketplace" target="_blank" rel="noreferrer" aria-label="TikTok"><TikTok /></a>
          </div>
        </div>

        <nav className="ft__col" aria-label="Explore">
          <h4>Explore</h4>
          <Link to="/shop">Shop the marketplace</Link>
          <Link to="/directory">Curators &amp; shops</Link>
          <Link to="/calendar">Market dates</Link>
          <a href={hrefFor('/academy')}>Mentorship</a>
          <Link to="/about">Our story</Link>
        </nav>
        <nav className="ft__col" aria-label="Join">
          <h4>Join</h4>
          <a href={APPLY_URL} target="_blank" rel="noopener noreferrer">Become a curator</a>
          <Link to="/partner">Partner with us</Link>
          <Link to="/services">Services</Link>
          <Link to="/login">Curator portal</Link>
          <a href={collectivePortal()}>The Collective</a>
          <a href={hrefFor(JOIN_PATH)}>Join P31 Collective</a>
        </nav>
        <div className="ft__col">
          <h4>Contact</h4>
          <a href={`mailto:${EMAIL.community}`}><Mail size={15} /> Email us</a>
          <a href={`mailto:${EMAIL.vendors}`}><Mail size={15} /> Curator &amp; vendor help</a>
          <a href="tel:14705622852"><Phone size={15} /> (470) 562-2852</a>
          <span><MapPin size={15} /> Atlanta, GA — touring</span>
          <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer"><Star size={15} /> Review us on Google</a>
          <a href="https://www.paypal.com/donate/?hosted_button_id=WY2ZX3TXDMF5Y" target="_blank" rel="noreferrer" className="ft__seed">
            <HeartHandshake size={15} /> Sow a seed
          </a>
        </div>
      </div>

      <div className="ft__bottom">
        <span>© {new Date().getFullYear()} Proverbs 31 Marketplace. All rights reserved.</span>
        <span className="ft__bottom-links">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top <ArrowUp size={14} /></button>
        </span>
      </div>
    </div>
  </footer>
);

export default Footer;
