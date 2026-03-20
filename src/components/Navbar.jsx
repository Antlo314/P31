import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import './Navbar.css';

import logoPath from '../assets/23BC16A7-6829-41F2-9EC4-E6BA907BC9D0.png';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isHomeTop = location.pathname === '/' && !isScrolled;

  return (
    <nav className={`navbar-v2 ${isScrolled ? 'scrolled' : ''}`}>
      <div className="navbar-v2-inner">
        <Link to="/" className="nav-brand">
          <img src={logoPath} alt="Proverbs 31 Marketplace" className="nav-logo-img" style={{ opacity: isHomeTop ? 0 : 1, transition: 'opacity 0.5s ease', mixBlendMode: 'screen', filter: 'drop-shadow(0 0 10px rgba(212, 175, 55, 0.4))' }} />
        </Link>

        <div className="nav-links desktop-only">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Explore</Link>
          <Link to="/about" className={location.pathname === '/about' ? 'active' : ''}>The Vision</Link>
          <Link to="/visionaries" className={location.pathname === '/visionaries' ? 'active' : ''}>Visionaries</Link>
          <Link to="/directory" className={location.pathname === '/directory' ? 'active' : ''}>Curators</Link>
          <Link to="/calendar" className={location.pathname === '/calendar' ? 'active' : ''}>Experience</Link>
        </div>

        <div className="nav-actions desktop-only">
          <a href="https://forms.gle/vmkK7fhgwiYNYEa38" target="_blank" rel="noreferrer" className="btn-outline" style={{ borderBottom: 'none' }}>
            Apply
          </a>
        </div>

        <button className="mobile-menu-btn mobile-only" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} color="#D4AF37" /> : <Menu size={24} color="#D4AF37" />}
        </button>

        {isMobileMenuOpen && (
          <div className="mobile-dropdown">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>Explore</Link>
            <Link to="/about" onClick={() => setIsMobileMenuOpen(false)}>The Vision</Link>
            <Link to="/visionaries" onClick={() => setIsMobileMenuOpen(false)}>Visionaries</Link>
            <Link to="/directory" onClick={() => setIsMobileMenuOpen(false)}>Curators</Link>
            <Link to="/calendar" onClick={() => setIsMobileMenuOpen(false)}>Experience</Link>
            <a href="https://forms.gle/vmkK7fhgwiYNYEa38" target="_blank" rel="noreferrer" onClick={() => setIsMobileMenuOpen(false)}>Apply</a>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
