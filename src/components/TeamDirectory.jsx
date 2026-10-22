import React from 'react';
import { Crown, ClipboardList, Megaphone, Users, Headset, Laptop, Mail, Phone, MapPin } from 'lucide-react';
import { OFFICE } from '../lib/team';
import { useSiteTeam } from '../lib/teamDirectory';
import './TeamDirectory.css';

const ICONS = { crown: Crown, clipboard: ClipboardList, megaphone: Megaphone, people: Users, headset: Headset, laptop: Laptop };

/**
 * The P31 team: who does what, and how to reach them. The people come from the team directory
 * admins edit in Systems (src/lib/teamDirectory.js), with the code list as the first paint.
 *   portraits  show the team's portraits under the cards, each with her name and role
 */
const TeamDirectory = ({ eyebrow = 'Our team', title = 'Meet the', accent = 'team', lede, showOffice = true, portraits = false }) => {
  const team = useSiteTeam();
  const people = team.filter((p) => p.portrait);
  // Keyed by name, so the cards stay put when the database list replaces the code one.
  const keyOf = (p) => (team.filter((q) => q.name === p.name).length > 1 ? `${p.name}-${p.id}` : p.name);
  return (
    <>
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">{eyebrow}</p>
        <h2 className="k-h2" data-split>{title} <em>{accent}</em></h2>
        {lede && <p className="k-lede" data-reveal>{lede}</p>}
      </div>
      <div className="k-grid k-grid--3 td" data-reveal-group>
        {team.map((p) => {
          const Icon = ICONS[p.icon] || Users;
          const src = p.photo;
          return (
            <article key={keyOf(p)} className={`td-card ${src ? 'has-photo' : ''}`}>
              {src
                ? <span className="td-card__photo"><img src={src} alt={p.name} loading="lazy" decoding="async" /></span>
                : <span className="td-card__icon" aria-hidden="true"><Icon size={22} /></span>}
              <h3>{p.name}</h3>
              <p className="td-card__role">{p.role}</p>
              {p.focus.length > 0 && <ul>{p.focus.map((f) => <li key={f}>{f}</li>)}</ul>}
              <div className="td-card__mail">
                {p.emails.map((e) => <a key={e} href={`mailto:${e}`}><Mail size={14} /> {e}</a>)}
              </div>
            </article>
          );
        })}
      </div>
      {portraits && people.length > 0 && (
        <div className="td-gallery" data-reveal-group aria-label="The P31 team">
          {people.map((p) => (
            <figure key={keyOf(p)} className="td-portrait">
              <img src={p.portrait} alt={`${p.name}, ${p.role}`} loading="lazy" decoding="async" />
              <figcaption>
                <strong>{p.name}</strong>
                <span>{p.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {showOffice && (
        <div className="td-office" data-reveal>
          <a href={`tel:${OFFICE.tel}`}><Phone size={16} /> {OFFICE.phone}</a>
          <span><MapPin size={16} /> {OFFICE.mailing.join(', ')} <small>(mailing)</small></span>
          <span className="td-office__hours">{OFFICE.hours}</span>
        </div>
      )}
    </>
  );
};

export default TeamDirectory;
