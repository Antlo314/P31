import React from 'react';
import { X } from 'lucide-react';
import { pct } from './helpers';

// Small building blocks shared by the mentor and student classrooms.
export const Modal = ({ title, onClose, children, wide = false }) => (
  <div className="ds-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div className={`ds-modal__panel ${wide ? 'ds-modal__panel--wide' : ''}`}>
      <button className="k-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      <h2>{title}</h2>
      {children}
    </div>
  </div>
);

/** Progress bar with a label. */
export const Bar = ({ value, max, label }) => (
  <div className="cl-bar">
    <div className="ds-progress"><span style={{ width: `${Math.min(100, pct(value, max))}%` }} /></div>
    {label !== undefined && <small>{label}</small>}
  </div>
);
