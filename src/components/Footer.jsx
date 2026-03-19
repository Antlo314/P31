import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook } from 'lucide-react';
import './Footer.css';
import footerLogo from '../assets/premium_logo_1_1773960265213.png';

const Footer = () => {
  return (
    <footer className="footer-v2">
      <div className="container-fluid">
        <div className="footer-top-v2">
          
          <div className="footer-logo-area">
            <img src={footerLogo} alt="Proverbs 31 Marketplace" />
            <p>
              A traveling sanctuary of creativity, empowering women to rise and build using their gifts.
            </p>
            <div className="socials-v2" style={{marginTop: '24px'}}>
              <a href="https://www.instagram.com/proverbs31market" target="_blank" rel="noreferrer" aria-label="Instagram">
                <Instagram size={20} />
              </a>
              <a href="https://www.facebook.com/share/1LEtAu9AJD/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label="Facebook">
                <Facebook size={20} />
              </a>
              <a href="https://www.tiktok.com/@p31marketplace" target="_blank" rel="noreferrer" aria-label="TikTok">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><path d="m9 9 12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
              </a>
            </div>
          </div>
          
          <div className="footer-links-v2">
            <div className="link-col">
              <h4>Navigation</h4>
              <ul>
                <li><Link to="/">Explore</Link></li>
                <li><Link to="/about">The Vision</Link></li>
                <li><Link to="/directory">Curators</Link></li>
                <li><Link to="/calendar">Experience</Link></li>
              </ul>
            </div>
            
            <div className="link-col">
              <h4>Connect</h4>
              <ul>
                <li><a href="mailto:proverbs31markets@gmail.com">proverbs31markets@gmail.com</a></li>
                <li><a href="tel:14705622852">1 (470) 562-2852</a></li>
                <li><a href="https://forms.gle/vmkK7fhgwiYNYEa38" target="_blank" rel="noreferrer" className="text-gold">Apply as Curator &rarr;</a></li>
                <li><a href="https://www.eventbrite.com/e/proverbs-31-marketplace-tickets-1984190041828" target="_blank" rel="noreferrer" className="text-gold">RSVP &rarr;</a></li>
                <li style={{marginTop: '16px'}}>
                   <a href="https://www.paypal.com/donate/?hosted_button_id=WY2ZX3TXDMF5Y" target="_blank" rel="noreferrer" className="btn-outline">
                     Sow (Donate)
                   </a>
                </li>
              </ul>
            </div>
          </div>
          
        </div>
        
        <div className="footer-bottom-v2">
          <p>&copy; {new Date().getFullYear()} Proverbs 31 Marketplace. All rights reserved.</p>
          <p>Atlanta, GA</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
