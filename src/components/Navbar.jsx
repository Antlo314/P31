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

  return (
    <nav className={`navbar-v2 ${isScrolled ? 'scrolled' : ''}`}>
      <div className="navbar-v2-inner">
        <Link to="/" className="nav-brand">
          <img src={logoPath} alt="Proverbs 31 Marketplace" className="nav-logo-img gold-plated-logo" />
        </Link>

        <div className="nav-links desktop-only">
          <Link to="/visionary" className={location.pathname === '/visionary' ? 'active' : ''}>Visionary</Link>
          <Link to="/directory" className={location.pathname === '/directory' ? 'active' : ''}>Curators</Link>
        </div>

        <div className="nav-actions">
          <a href="#newsletter" className="btn-solid-gold">
            Join Us
          </a>
        </div>

        <button className="mobile-menu-btn mobile-only" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} color="#D4AF37" /> : <Menu size={24} color="#D4AF37" />}
        </button>

        {isMobileMenuOpen && (
          <div className="mobile-dropdown">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>Home</Link>
            <Link to="/visionary" onClick={() => setIsMobileMenuOpen(false)}>Visionary</Link>
            <Link to="/directory" onClick={() => setIsMobileMenuOpen(false)}>Curators</Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
