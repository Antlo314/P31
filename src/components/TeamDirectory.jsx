import React from 'react';
import { Crown, ClipboardList, Megaphone, Users, Headset, Laptop, Mail, Phone, MapPin } from 'lucide-react';
import { TEAM, OFFICE } from '../lib/team';
import './TeamDirectory.css';

const ICONS = { crown: Crown, clipboard: ClipboardList, megaphone: Megaphone, people: Users, headset: Headset, laptop: Laptop };

/** The P31 team: who does what, and how to reach them. */
const TeamDirectory = ({ eyebrow = 'Our team', title = 'Meet the', accent = 'team', lede, showOffice = true }) => (
  <>
    <div className="k-head k-center">
      <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">{eyebrow}</p>
      <h2 className="k-h2" data-split>{title} <em>{accent}</em></h2>
      {lede && <p className="k-lede" data-reveal>{lede}</p>}
    </div>
    <div className="k-grid k-grid--3 td" data-reveal-group>
      {TEAM.map((p) => {
        const Icon = ICONS[p.icon];
        return (
          <article key={p.name} className="td-card" data-tilt>
            <span className="td-card__icon" aria-hidden="true"><Icon size={22} /></span>
            <h3>{p.name}</h3>
            <p className="td-card__role">{p.role}</p>
            <ul>{p.focus.map((f) => <li key={f}>{f}</li>)}</ul>
            <div className="td-card__mail">
              {p.emails.map((e) => <a key={e} href={`mailto:${e}`}><Mail size={14} /> {e}</a>)}
            </div>
          </article>
        );
      })}
    </div>
    {showOffice && (
      <div className="td-office" data-reveal>
        <a href={`tel:${OFFICE.tel}`}><Phone size={16} /> {OFFICE.phone}</a>
        <span><MapPin size={16} /> {OFFICE.mailing.join(', ')} <small>(mailing)</small></span>
        <span className="td-office__hours">{OFFICE.hours}</span>
      </div>
    )}
  </>
);

export default TeamDirectory;
