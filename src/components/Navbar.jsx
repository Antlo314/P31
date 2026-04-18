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
          <Link to="/visionary" className={location.pathname === '/visionary' ? 'active' : ''}>Visionary</Link>
          <Link to="/directory" className={location.pathname === '/directory' ? 'active' : ''}>Curators</Link>
          <a href="https://forms.gle/vmkK7fhgwiYNYEa38" target="_blank" rel="noopener noreferrer">Storefront Application</a>
        </div>

        <div className="nav-actions">
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

        {isMobileMenuOpen && (
          <div className="mobile-dropdown">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>Home</Link>
            <Link to="/visionary" onClick={() => setIsMobileMenuOpen(false)}>Visionary</Link>
            <Link to="/directory" onClick={() => setIsMobileMenuOpen(false)}>Curators</Link>
            <Link to="/apply" onClick={() => setIsMobileMenuOpen(false)}>Storefront App</Link>
            <Link to="/login" onClick={() => setIsMobileMenuOpen(false)}>Curator Portal</Link>
            <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>Dashboard</Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
