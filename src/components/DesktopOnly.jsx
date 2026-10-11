import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Mail, ArrowRight } from 'lucide-react';
import { useIsPhone } from '../lib/device';
import './DesktopOnly.css';

/** A small "Computer" tag for menus and tiles. */
export const DesktopTag = ({ className = '' }) => (
  <span className={`dko-tag ${className}`} title="Needs a computer"><Monitor size={11} /> Computer</span>
);

/**
 * Wraps a tool that is too heavy for a phone. On narrow screens it shows what the tool does,
 * why it needs a computer, what to do on the phone instead, and a way to email yourself the link.
 *   title, what, why?, instead?: [{ to, label }]
 */
const DesktopOnly = ({ title, what, why, instead = [], children }) => {
  const phone = useIsPhone();
  const [anyway, setAnyway] = useState(false);
  if (!phone || anyway) return children;
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const mail = `mailto:?subject=${encodeURIComponent(`${title} on P31`)}&body=${encodeURIComponent(`Open this on a computer:\n${url}`)}`;
  return (
    <section className="dko" role="note" aria-label={`${title} needs a computer`}>
      <span className="dko__icon"><Monitor size={22} /></span>
      <h2>{title} needs a computer</h2>
      <p className="dko__what">{what}</p>
      <p className="dko__why">{why || 'It works on video right on the device, which a phone can’t do reliably. Everything else here works on your phone.'}</p>
      {instead.length > 0 && (
        <div className="dko__instead">
          <p>On your phone right now:</p>
          <ul>{instead.map((i) => <li key={i.to}><Link to={i.to}>{i.label} <ArrowRight size={13} /></Link></li>)}</ul>
        </div>
      )}
      <div className="dko__actions">
        <a className="dko__btn" href={mail}><Mail size={15} /> Email me the link</a>
        <button type="button" className="dko__link" onClick={() => setAnyway(true)}>Try it here anyway</button>
      </div>
    </section>
  );
};

export default DesktopOnly;
