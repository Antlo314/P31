import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Mail, Phone, UserCheck } from 'lucide-react';
import { EMAIL, OFFICE } from '../../lib/team';
import { marketChoices, formatPhone } from '../../lib/forms';
import '../../academy/join.css';
import './forms.css';

/** One-of-many as chips (the radio questions on the forms). */
export const Chips = ({ label, options, value, onChange, required, children }) => (
  <fieldset className="k-field jn-group">
    <legend>{label}{required && ' *'}</legend>
    <div className="jn-chips" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        const l = typeof o === 'string' ? o : o.label;
        return <button type="button" key={v} role="radio" aria-checked={value === v} aria-pressed={value === v} className="jn-chip" onClick={() => onChange(v)}>{l}</button>;
      })}
    </div>
    {children}
  </fieldset>
);

/** 1 to 5. */
export const Scale = ({ label, value, onChange, required, low = '1 · Poor', high = '5 · Excellent' }) => (
  <fieldset className="k-field jn-group vf-scale">
    <legend>{label}{required && ' *'}</legend>
    <div className="vf-scale__row" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} role="radio" aria-checked={value === n} className="vf-scale__n" onClick={() => onChange(n)}>{n}</button>
      ))}
    </div>
    <div className="vf-scale__ends" aria-hidden="true"><span>{low}</span><span>{high}</span></div>
  </fieldset>
);

/** First name / last name, like the JotForm name block. */
export const NameRow = ({ f, set, label = 'Contact Person Full Name', required = true }) => (
  <fieldset className="k-field jn-group">
    <legend>{label}{required && ' *'}</legend>
    <div className="k-row">
      <label className="k-field"><span>First Name</span><input required={required} autoComplete="given-name" value={f.first_name} onChange={set('first_name')} /></label>
      <label className="k-field"><span>Last Name</span><input required={required} autoComplete="family-name" value={f.last_name} onChange={set('last_name')} /></label>
    </div>
  </fieldset>
);

/** Email + phone. */
export const ContactRow = ({ f, set, emailLabel = 'Email Address', phoneLabel = 'Phone Number' }) => (
  <div className="k-row">
    <label className="k-field"><span>{emailLabel} *</span>
      <input required type="email" inputMode="email" autoComplete="email" placeholder="example@example.com" value={f.email} onChange={set('email')} />
    </label>
    <label className="k-field"><span>{phoneLabel} *</span>
      <input required type="tel" inputMode="tel" autoComplete="tel" placeholder="(000) 000-0000" value={f.phone} onChange={(e) => set('phone')({ target: { value: formatPhone(e.target.value) } })} />
      <small className="k-fine">Format: (000) 000-0000.</small>
    </label>
  </div>
);

/**
 * Which market: the real ones from Systems → Events as chips, plus "another month / year" typed in.
 * value = { eventId, label, other }
 */
export const MarketPicker = ({ label, which = 'upcoming', value, onChange, required = true, hint }) => {
  const [list, setList] = useState(null);
  useEffect(() => { marketChoices(which).then(setList); }, [which]);
  const typed = value.other || (list && !list.length);
  return (
    <fieldset className="k-field jn-group">
      <legend>{label}{required && ' *'}</legend>
      {list === null ? <div className="k-skel" style={{ height: 40 }} aria-hidden="true" /> : (
        <>
          {list.length > 0 && (
            <div className="jn-chips" role="radiogroup" aria-label={label}>
              {list.map((e) => (
                <button type="button" key={e.id} role="radio" aria-checked={value.eventId === e.id} aria-pressed={value.eventId === e.id} className="jn-chip"
                  onClick={() => onChange({ eventId: e.id, label: e.label, other: false })}>
                  {e.title}{e.date_public ? ` · ${e.label.split(' · ')[1] || ''}` : e.month_public ? ` · ${e.label.split(' · ')[1] || ''} · date announcing soon` : ' · date announcing soon'}
                </button>
              ))}
              <button type="button" role="radio" aria-checked={!!value.other} aria-pressed={!!value.other} className="jn-chip" onClick={() => onChange({ eventId: null, label: '', other: true })}>Another month / year</button>
            </div>
          )}
          {typed && <input className="jn-other" value={value.label} onChange={(e) => onChange({ eventId: null, label: e.target.value, other: true })} placeholder="e.g. March 2027" aria-label="Month and year of the event" maxLength={120} />}
        </>
      )}
      {hint && <p className="k-fine">{hint}</p>}
    </fieldset>
  );
};

/** "Signed in as…": what was filled in for a curator who is logged in. */
export const Prefilled = ({ who }) => (who ? (
  <p className="vf-prefill"><UserCheck size={16} /> Signed in as <b>{who.email}</b>. We filled in what we already know; change anything that is off.</p>
) : null);

/** The confirmation that replaces the form (and comes back for 30 days on this device). */
export const Done = ({ title, children, again, onAgain, focus }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!focus || !ref.current) return;
    const el = ref.current;
    requestAnimationFrame(() => requestAnimationFrame(() => { el.scrollIntoView({ block: 'start', behavior: 'instant' }); el.focus({ preventScroll: true }); }));
  }, [focus]);
  return (
    <div className="k-success jn-done" ref={ref} tabIndex={-1} role="status" aria-live="polite">
      <span className="k-icon"><CheckCircle2 size={28} /></span>
      <h3>{title}</h3>
      {children}
      {again && <button type="button" className="jn-again" onClick={onAgain}>{again}</button>}
    </div>
  );
};

/** Help line under every form. */
export const HelpLine = ({ email = EMAIL.vendors }) => (
  <p className="k-fine jn-alt">
    <Mail size={13} /> Questions? <a href={`mailto:${email}`}>{email}</a>
    {' · '}<Phone size={13} /> <a href={`tel:${OFFICE.tel}`}>{OFFICE.phone}</a>
    {' · '}<Link to="/vendors">All vendor forms</Link>
  </p>
);

export const Trap = ({ f, set }) => <input className="k-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.trap} onChange={set('trap')} />;
