import React, { useState, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';
import './HelpTip.css';

// Small "?" button that opens a plain-English how-to card. Written for
// non-technical curators — keep contents step-by-step and jargon-free.
const HelpTip = ({ title, label, children }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={`helptip-btn ${label ? 'with-label' : ''}`}
        onClick={() => setOpen(true)}
        aria-label={`Help: ${title}`}
        title={title}
      >
        <HelpCircle size={15} />
        {label && <span>{label}</span>}
      </button>
      {open && (
        <div className="helptip-overlay" onClick={() => setOpen(false)}>
          <div className="helptip-card" onClick={(e) => e.stopPropagation()}>
            <div className="helptip-head">
              <h4><HelpCircle size={18} /> {title}</h4>
              <button type="button" className="helptip-close" onClick={() => setOpen(false)} aria-label="Close help">
                <X size={18} />
              </button>
            </div>
            <div className="helptip-body">{children}</div>
            <button type="button" className="helptip-done" onClick={() => setOpen(false)}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpTip;
