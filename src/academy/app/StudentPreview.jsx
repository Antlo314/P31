import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Eye, X, Smartphone, Tablet, Monitor, RotateCw, ExternalLink } from 'lucide-react';
import { useAcademy } from './data';
import { useRoster } from './helpers';
import { PREVIEW_PREFIX, previewPageFor } from './previewMode';
import './preview.css';

const PAGES = [['', 'Home'], ['learn', 'Lessons'], ['assignments', 'Assignments'], ['sessions', 'Sessions'], ['messages', 'Messages'],
  ['quizzes', 'Quizzes'], ['discussions', 'Discussions'], ['progress', 'Progress'], ['plans', 'Action plans'], ['library', 'Library']];
const DEVICES = { phone: [390, 844, Smartphone, 'Phone'], tablet: [820, 1180, Tablet, 'Tablet'], desktop: [1280, 800, Monitor, 'Desktop'] };

/** "Preview" in the mentor console: the student classroom in a device frame, as a new student or as one student. */
const StudentPreview = () => {
  const { program } = useAcademy();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState('new');
  const [page, setPage] = useState('');
  const [device, setDevice] = useState('phone');
  const [nonce, setNonce] = useState(0);
  const [scale, setScale] = useState(1);
  const stage = useRef(null);
  const roster = useRoster(program);

  const openPanel = () => {
    // Start on the student page that matches where the mentor is, or as the student they're looking at.
    const studentId = pathname.match(/\/teach\/(?:students|inbox)\/([0-9a-f-]{8,})/i)?.[1];
    setWho(studentId || 'new');
    setPage(previewPageFor(pathname));
    setNonce((n) => n + 1);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);

  // Fit the device inside the panel.
  useEffect(() => {
    if (!open || !stage.current) return undefined;
    const [w, h] = DEVICES[device];
    const fit = () => {
      const r = stage.current.getBoundingClientRect();
      setScale(Math.min(1, (r.width - 32) / w, (r.height - 32) / h));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage.current);
    return () => ro.disconnect();
  }, [open, device]);

  const src = `/academy/${program.slug}${page ? `/${page}` : ''}`;
  const frameName = `${PREVIEW_PREFIX}${who}`;
  const [w, h] = DEVICES[device];

  return (
    <>
      <button className="ds-icon-btn sp-open" onClick={openPanel} title="Preview the classroom as a student" aria-label="Preview as a student">
        <Eye size={17} /><span>Preview</span>
      </button>
      {open && createPortal(
        <div className="sp" role="dialog" aria-modal="true" aria-label="Student preview">
          <div className="sp__bar">
            <strong className="sp__title"><Eye size={16} /> Student preview</strong>
            <label className="sp__field">
              <span>Viewing as</span>
              <select value={who} onChange={(e) => { setWho(e.target.value); setNonce((n) => n + 1); }}>
                <option value="new">A new student (what everyone sees)</option>
                {(roster.data || []).map((s) => <option key={s.user_id} value={s.user_id}>{s.full_name || s.email}</option>)}
              </select>
            </label>
            <label className="sp__field">
              <span>Page</span>
              <select value={page} onChange={(e) => { setPage(e.target.value); setNonce((n) => n + 1); }}>
                {PAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <div className="sp__devices" role="group" aria-label="Screen size">
              {Object.entries(DEVICES).map(([k, d]) => {
                const Icon = d[2];
                return <button key={k} aria-pressed={device === k} onClick={() => setDevice(k)} title={d[3]}><Icon size={16} /><span>{d[3]}</span></button>;
              })}
            </div>
            <div className="sp__actions">
              <button className="ds-icon-btn" onClick={() => setNonce((n) => n + 1)} title="Reload" aria-label="Reload preview"><RotateCw size={16} /></button>
              <button className="ds-icon-btn" onClick={() => window.open(src, frameName)} title="Open in a new tab" aria-label="Open preview in a new tab"><ExternalLink size={16} /></button>
              <button className="ds-icon-btn" onClick={() => setOpen(false)} title="Close" aria-label="Close preview"><X size={17} /></button>
            </div>
          </div>
          <div className="sp__stage" ref={stage}>
            <div className={`sp__device sp__device--${device}`} style={{ width: w, height: h, transform: `scale(${scale})` }}>
              <iframe key={`${who}|${page}|${nonce}`} name={frameName} src={src} title="Student classroom preview" />
            </div>
          </div>
          <p className="sp__note">Preview only: buttons that would submit work, join a class or change anything are turned off here.</p>
        </div>,
        document.body,
      )}
    </>
  );
};

export default StudentPreview;
