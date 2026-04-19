import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Crown, Leaf, User, LogOut, Layout } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

import logoPath from '../assets/p31_logo_legacy_transparent.png';

const Navbar = () => {
  const { user, profile, curatorData, isAdmin, signOut } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
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
          <Link to="/partner" className={location.pathname === '/partner' ? 'active' : ''}>Partner</Link>
          <Link to="/services" className={location.pathname === '/services' ? 'active' : ''}>Services</Link>
          <div className="nav-link-with-badge">
            <Link to="/directory" className={location.pathname === '/directory' ? 'active' : ''}>Curators</Link>
            <span className="construction-badge">Soon</span>
          </div>
          <div className="nav-link-with-badge disabled-nav-link">
            <a href="#" className="disabled">Storefront App</a>
            <span className="construction-badge">Refining</span>
          </div>
        </div>

        <div className="nav-actions desktop-only">
          {user ? (
            <div className="user-nav-wrapper">
              <button className="user-nav-btn" onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}>
                <div className="user-nav-avatar">
                  <img src={profile?.avatar_url || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=50'} alt="Me" />
                  {isAdmin && <Crown size={12} className="prestige-icon admin-crown" />}
                  {curatorData?.is_early_bird && !isAdmin && <Leaf size={12} className="prestige-icon founder-leaf" />}
                </div>
                <span className="user-nav-name desktop-only">{profile?.full_name?.split(' ')[0]}</span>
              </button>
              
              {isUserMenuOpen && (
                <div className="user-dropdown glass-card shadow-lg">
                  <Link to="/dashboard" onClick={() => setIsUserMenuOpen(false)}><Layout size={16} /> Studio Dashboard</Link>
                  <button onClick={() => { signOut(); setIsUserMenuOpen(false); }} className="nav-logout-btn">
                    <LogOut size={16} /> Exit Studio
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn-solid-gold">
              Curator Portal
            </Link>
          )}
        </div>

        <button className="mobile-menu-btn mobile-only" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} color="#D4AF37" /> : <Menu size={24} color="#D4AF37" />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="mobile-dropdown animate-nav-in">
          <button className="mobile-close-btn" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={32} />
          </button>
          
          <div className="mobile-menu-brand">
            <img src={logoPath} alt="P31" className="mobile-brand-logo" />
          </div>

          <div className="mobile-menu-links">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>Home</Link>
            <Link to="/partner" onClick={() => setIsMobileMenuOpen(false)}>Partner</Link>
            <Link to="/services" onClick={() => setIsMobileMenuOpen(false)}>Services</Link>
            <div className="mobile-nav-link-badge">
              <Link to="/directory" onClick={() => setIsMobileMenuOpen(false)}>Curators</Link>
              <span className="mobile-construction-badge">Soon</span>
            </div>
            <div className="mobile-nav-link-badge disabled">
              <span className="mobile-link-text">Storefront App</span>
              <span className="mobile-construction-badge">Coming Soon</span>
            </div>
          </div>

          <div className="mobile-menu-footer">
            {!user ? (
              <Link to="/login" className="btn-solid-gold w-full" onClick={() => setIsMobileMenuOpen(false)}>
                Curator Portal
              </Link>
            ) : (
              <Link to="/dashboard" className="btn-solid-gold w-full" onClick={() => setIsMobileMenuOpen(false)}>
                Go to Studio
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
