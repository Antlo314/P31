import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User, ShoppingBag, Palette, DollarSign, Tag, Star, Megaphone, Camera, BarChart3, Bell, MessageSquare,
  HelpCircle, ExternalLink, Crown, ShieldCheck, ChevronDown, Menu, X, LogOut,
} from 'lucide-react';
import { startCuratorTour } from './studioTour';
import './StudioNav.css';

// The studio menu, in five short groups. Groups fold; on phones the whole menu folds
// behind one button so the page comes first.
const GROUPS = [
  { id: 'shop', label: 'Your shop', items: [
    { id: 'identity', label: 'Identity', Icon: User },
    { id: 'storefront', label: 'Storefront', Icon: ShoppingBag },
    { id: 'design', label: 'Store Design', Icon: Palette },
  ] },
  { id: 'sell', label: 'Sell', items: [
    { id: 'orders', label: 'Orders', Icon: DollarSign, alias: ['sales'] },
    { id: 'discounts', label: 'Discounts', Icon: Tag },
    { id: 'testimonials', label: 'Testimonials', Icon: Star },
  ] },
  { id: 'grow', label: 'Grow', items: [
    { id: 'marketing', label: 'Marketing', Icon: Megaphone, alias: ['toolkit'] },
    { id: 'studio', label: 'Creative Studio', Icon: Camera },
    { id: 'analytics', label: 'Intelligence', Icon: BarChart3 },
  ] },
  { id: 'help', label: 'Help', items: [
    { id: 'concierge', label: 'Concierge', Icon: Bell },
    { id: 'community', label: 'The Gathering', Icon: MessageSquare },
    { id: 'guide', label: 'Help & Guide', Icon: HelpCircle, tour: true },
    { id: 'directory', label: 'View Directory', Icon: ExternalLink, to: '/directory' },
  ] },
  { id: 'admin', label: 'Admin', admin: true, items: [
    { id: 'governance', label: 'Governance', Icon: Crown },
    { id: 'approvals', label: 'Vendor Approvals', Icon: ShieldCheck },
  ] },
];

const KEY = 'p31_studio_nav';
const readFolded = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

const isOn = (item, activeTab) => item.id === activeTab || (item.alias || []).includes(activeTab);

/** Grouped, foldable studio menu. onSelect(tabId) switches the page. */
const StudioNav = ({ activeTab, onSelect, isAdmin, onSignOut }) => {
  const [folded, setFolded] = useState(readFolded);
  const [open, setOpen] = useState(false); // phones: the whole menu
  const groups = GROUPS.filter((g) => !g.admin || isAdmin);
  const current = groups.flatMap((g) => g.items).find((i) => isOn(i, activeTab));

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(folded)); } catch { /* private mode */ } }, [folded]);

  const toggle = (id) => setFolded((f) => ({ ...f, [id]: !f[id] }));
  // Picking a page closes the phone menu.
  const pick = (item) => {
    setOpen(false);
    if (item.tour) startCuratorTour(); else onSelect(item.id);
  };

  return (
    <div className={`sn ${open ? 'is-open' : ''}`}>
      <button type="button" className="sn__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="sn-groups">
        {open ? <X size={18} /> : <Menu size={18} />}
        <span>{open ? 'Close menu' : current?.label || 'Menu'}</span>
      </button>

      <nav id="sn-groups" className="sn__groups" aria-label="Studio">
        {groups.map((g) => {
          const active = g.items.some((i) => isOn(i, activeTab));
          const shut = !!folded[g.id] && !active;
          return (
            <section key={g.id} className={`sn__group ${shut ? 'is-shut' : ''}`}>
              <button type="button" className="sn__label" onClick={() => toggle(g.id)} aria-expanded={!shut}>
                <span>{g.label}</span><ChevronDown size={14} />
              </button>
              {!shut && g.items.map((item) => {
                const Icon = item.Icon;
                const cls = `nav-item ${isOn(item, activeTab) ? 'active' : ''}`;
                if (item.to) return <Link key={item.id} to={item.to} className={cls} data-tour={`nav-${item.id}`} onClick={() => setOpen(false)}><Icon size={18} /> {item.label}</Link>;
                return (
                  <button key={item.id} type="button" className={cls} onClick={() => pick(item)} data-tour={`nav-${item.id}`} aria-current={isOn(item, activeTab) ? 'page' : undefined}>
                    <Icon size={18} /> {item.label}
                  </button>
                );
              })}
            </section>
          );
        })}
      </nav>

      <div className="sn__foot sidebar-footer">
        <button type="button" onClick={onSignOut} className="logout-btn"><LogOut size={18} /> Exit Studio</button>
      </div>
    </div>
  );
};

export default StudioNav;
