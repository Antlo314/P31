import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Home, Store, CalendarDays, Handshake, LayoutGrid, ShoppingBasket, Heart, X, ChevronRight, Sparkles, Info,
  LayoutDashboard, LogOut, Lock, Instagram, Facebook, UserRound, Crown, ShoppingBag, GraduationCap, KeyRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { isFlushRoute } from '../lib/routes';
import { collectiveHome, collectivePortal } from '../lib/site';
import './Navbar.css';

import logoPath from '../assets/web/logo-160.webp';

const APPLY_URL = 'https://forms.gle/vmkK7fhgwiYNYEa38';

const TikTok = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5v3a8 8 0 0 1-5-1.5z" />
  </svg>
);

const LINKS = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/shop', label: 'Shop the Marketplace', Icon: ShoppingBasket },
  { to: '/directory', label: 'Curators & Shops', Icon: Store },
  { to: '/favorites', label: 'Favorites', Icon: Heart },
  { to: '/calendar', label: 'Market Dates', Icon: CalendarDays },
  { to: '/mentorship', href: collectiveHome(), label: 'Mentorship', Icon: GraduationCap },
  { to: '/portal', href: collectivePortal(), label: 'Member Portal', Icon: KeyRound },
  { to: '/partner', label: 'Partner With Us', Icon: Handshake },
  { to: '/services', label: 'Services', Icon: Sparkles },
  { to: '/about', label: 'Our Story', Icon: Info },
];

// Phones: an app-style bottom bar for the four places people go most,
// plus "Menu" for everything else.
const TABS = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/shop', label: 'Shop', Icon: ShoppingBasket },
  { to: '/directory', label: 'Curators', Icon: Store },
  { to: '/calendar', label: 'Dates', Icon: CalendarDays },
];

const Navbar = () => {
  const { user, profile, isAdmin, signOut } = useAuth();
  const { count, openCart } = useCart();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  // Over the dark page heroes the bar is clear; once you scroll (and on
  // storefronts and the studio) it becomes frosted glass.
  const overHero = isFlushRoute(pathname) && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menus on navigation.
  useEffect(() => {
    Promise.resolve().then(() => { setSheetOpen(false); setUserMenu(false); });
  }, [pathname]);

  // Lock the page behind the sheet; Escape closes it.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setSheetOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [sheetOpen]);

  const firstName = profile?.full_name?.split(' ')[0];
  const initial = (firstName || user?.email || '?').charAt(0).toUpperCase();

  return (
    <>
      <header className={`nb ${overHero ? 'nb--clear' : 'nb--glass'}`}>
        <div className="nb__inner">
          <Link to="/" className="nb__brand" aria-label="Proverbs 31 Marketplace — home">
            <img src={logoPath} alt="" />
            <span className="nb__wordmark">
              <strong>Proverbs 31</strong>
              <small>Marketplace</small>
            </span>
          </Link>

          <nav className="nb__links" aria-label="Main">
            {[['/shop', 'Shop'], ['/directory', 'Curators'], ['/calendar', 'Dates']].map(([to, label]) => (
              <NavLink key={to} to={to} className="nb__link">{label}</NavLink>
            ))}
            <a href={collectiveHome()} className="nb__link">Mentorship</a>
            <NavLink to="/partner" className="nb__link">Partner</NavLink>
          </nav>

          <div className="nb__actions">
            <button className="nb__bag" onClick={openCart} aria-label={`Bag, ${count} item${count === 1 ? '' : 's'}`}>
              <ShoppingBag size={19} />
              {count > 0 && <span>{count > 99 ? '99+' : count}</span>}
            </button>
            {user ? (
              <div className="nb__user">
                <button className="nb__avatar" onClick={() => setUserMenu(!userMenu)} aria-expanded={userMenu} aria-label="Account menu">
                  {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <span>{initial}</span>}
                  {isAdmin && <Crown size={11} className="nb__crown" />}
                </button>
                {userMenu && (
                  <div className="nb__menu" role="menu">
                    <p className="nb__menu-name">{firstName || 'Your account'}</p>
                    <Link to="/portal?choose" role="menuitem"><LayoutDashboard size={16} /> My dashboards</Link>
                    <button role="menuitem" onClick={signOut}><LogOut size={16} /> Sign out</button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" className="nb__cta">
                <UserRound size={16} /> <span>Curator Portal</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── Bottom tab bar (phones) — the studio has its own nav ── */}
      {!pathname.startsWith('/dashboard') && <nav className="tb" aria-label="Quick navigation">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="tb__item">
            <t.Icon size={21} strokeWidth={1.9} />
            <span>{t.label}</span>
          </NavLink>
        ))}
        <button className={`tb__item ${sheetOpen ? 'active' : ''}`} onClick={() => setSheetOpen(true)} aria-expanded={sheetOpen}>
          <LayoutGrid size={21} strokeWidth={1.9} />
          <span>Menu</span>
        </button>
      </nav>}

      {/* ── Menu sheet ──────────────────────────────────────── */}
      <div className={`sheet ${sheetOpen ? 'is-open' : ''}`} aria-hidden={!sheetOpen}>
        <button className="sheet__backdrop" onClick={() => setSheetOpen(false)} aria-label="Close menu" tabIndex={sheetOpen ? 0 : -1} />
        <div className="sheet__panel" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="sheet__grip" aria-hidden="true" />
          <div className="sheet__head">
            <span className="sheet__title">Menu</span>
            <button className="sheet__close" onClick={() => setSheetOpen(false)} aria-label="Close"><X size={20} /></button>
          </div>

          <div className="sheet__account">
            {user ? (
              <>
                <span className="sheet__avatar">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initial}</span>
                <div>
                  <strong>{firstName || 'Welcome back'}</strong>
                  <span>Signed in</span>
                </div>
                <Link to="/dashboard" className="sheet__pill">Studio</Link>
              </>
            ) : (
              <>
                <span className="sheet__avatar sheet__avatar--gold"><UserRound size={20} /></span>
                <div>
                  <strong>Curator Portal</strong>
                  <span>Manage your storefront</span>
                </div>
                <Link to="/login" className="sheet__pill">Sign in</Link>
              </>
            )}
          </div>

          <ul className="sheet__list">
            {LINKS.map((l) => (
              <li key={l.to}>
                {l.href ? (
                  <a href={l.href}>
                    <span className="sheet__icon"><l.Icon size={18} /></span>
                    {l.label}
                    <ChevronRight size={18} className="sheet__chev" />
                  </a>
                ) : (
                  <NavLink to={l.to} end={l.end}>
                    <span className="sheet__icon"><l.Icon size={18} /></span>
                    {l.label}
                    <ChevronRight size={18} className="sheet__chev" />
                  </NavLink>
                )}
              </li>
            ))}
            <li>
              <a href={APPLY_URL} target="_blank" rel="noopener noreferrer">
                <span className="sheet__icon sheet__icon--gold"><Sparkles size={18} /></span>
                Become a Curator
                <ChevronRight size={18} className="sheet__chev" />
              </a>
            </li>
            <li>
              <Link to="/systems">
                <span className="sheet__icon sheet__icon--dark"><Lock size={16} /></span>
                Systems <small>Team</small>
                <ChevronRight size={18} className="sheet__chev" />
              </Link>
            </li>
            {user && (
              <li>
                <button onClick={signOut}>
                  <span className="sheet__icon"><LogOut size={18} /></span>
                  Sign out
                </button>
              </li>
            )}
          </ul>

          <div className="sheet__social">
            <a href="https://www.instagram.com/proverbs31market" target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram size={18} /></a>
            <a href="https://www.facebook.com/share/1LEtAu9AJD/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label="Facebook"><Facebook size={18} /></a>
            <a href="https://www.tiktok.com/@p31marketplace" target="_blank" rel="noreferrer" aria-label="TikTok"><TikTok /></a>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
