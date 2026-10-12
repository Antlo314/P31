import React from 'react';
import { Crown, ClipboardList, Megaphone, Users, Headset, Laptop, Mail, Phone, MapPin } from 'lucide-react';
import { TEAM, OFFICE } from '../lib/team';
import { PHOTO_BY_NAME, PORTRAIT_BY_KEY } from '../lib/teamPhotos';
import './TeamDirectory.css';

const ICONS = { crown: Crown, clipboard: ClipboardList, megaphone: Megaphone, people: Users, headset: Headset, laptop: Laptop };

/**
 * The P31 team: who does what, and how to reach them.
 *   portraits  show the team's portraits under the cards, each with her name and role
 */
const TeamDirectory = ({ eyebrow = 'Our team', title = 'Meet the', accent = 'team', lede, showOffice = true, portraits = false }) => {
  const people = TEAM.filter((p) => p.photo && PORTRAIT_BY_KEY[p.photo]);
  return (
    <>
      <div className="k-head k-center">
        <p className="k-eyebrow k-eyebrow--center" data-reveal="fade">{eyebrow}</p>
        <h2 className="k-h2" data-split>{title} <em>{accent}</em></h2>
        {lede && <p className="k-lede" data-reveal>{lede}</p>}
      </div>
      <div className="k-grid k-grid--3 td" data-reveal-group>
        {TEAM.map((p) => {
          const Icon = ICONS[p.icon];
          const src = PHOTO_BY_NAME[p.name];
          return (
            <article key={p.name} className={`td-card ${src ? 'has-photo' : ''}`}>
              {src
                ? <span className="td-card__photo"><img src={src} alt={p.name} loading="lazy" decoding="async" /></span>
                : <span className="td-card__icon" aria-hidden="true"><Icon size={22} /></span>}
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
      {portraits && people.length > 0 && (
        <div className="td-gallery" data-reveal-group aria-label="The P31 team">
          {people.map((p) => (
            <figure key={p.name} className="td-portrait">
              <img src={PORTRAIT_BY_KEY[p.photo]} alt={`${p.name}, ${p.role}`} loading="lazy" decoding="async" />
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
