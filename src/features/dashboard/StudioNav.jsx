import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  User, ShoppingBag, Palette, DollarSign, Tag, Star, Megaphone, Camera, BarChart3, Bell, MessageSquare,
  HelpCircle, ExternalLink, Crown, ShieldCheck, ChevronDown, Menu, X, LogOut, CreditCard, Rocket, Landmark,
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
    { id: 'billing', label: 'Plan & billing', Icon: CreditCard },
  ] },
  { id: 'sell', label: 'Sell', items: [
    { id: 'orders', label: 'Orders', Icon: DollarSign, alias: ['sales'] },
    { id: 'discounts', label: 'Promo codes', Icon: Tag },
    { id: 'testimonials', label: 'Reviews', Icon: Star },
    // Opens her own Stripe dashboard in a new tab (shown once her Stripe account is set up).
    { id: 'stripe', label: 'Stripe dashboard', Icon: Landmark, action: true, needs: 'stripe' },
  ] },
  { id: 'grow', label: 'Grow', items: [
    { id: 'grow', label: 'Add-ons & Featured', Icon: Rocket },
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

/**
 * Grouped, foldable studio menu. onSelect(tabId) switches the page; onAction(id) runs a menu
 * button that is not a page (the Stripe dashboard). `has` turns on items that need something
 * (has.stripe), `counts` puts a small number beside an item (reviews waiting).
 */
const StudioNav = ({ activeTab, onSelect, onAction, isAdmin, onSignOut, has = {}, counts = {} }) => {
  const [folded, setFolded] = useState(readFolded);
  const [open, setOpen] = useState(false); // phones: the whole menu
  const groups = GROUPS.filter((g) => !g.admin || isAdmin)
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.needs || has[i.needs]) }));
  const current = groups.flatMap((g) => g.items).find((i) => isOn(i, activeTab));

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(folded)); } catch { /* private mode */ } }, [folded]);

  const toggle = (id) => setFolded((f) => ({ ...f, [id]: !f[id] }));
  // Picking a page closes the phone menu.
  const pick = (item) => {
    setOpen(false);
    if (item.tour) startCuratorTour();
    else if (item.action) onAction?.(item.id);
    else onSelect(item.id);
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
                    {item.action && <ExternalLink size={13} className="sn__ext" aria-hidden="true" />}
                    {counts[item.id] > 0 && <span className="sn__count" aria-label={`${counts[item.id]} waiting`}>{counts[item.id]}</span>}
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
