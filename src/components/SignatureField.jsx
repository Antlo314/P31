import React, { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { Eraser, PenLine } from 'lucide-react';
import './SignatureField.css';

/**
 * Draw-to-sign, like the signature box on the JotForm versions of these forms.
 * Built on signature_pad (MIT). Calls onChange with a PNG data URL, or null when cleared.
 */
const SignatureField = ({ onChange, label = 'Signature *', hint = 'Sign with your finger on a phone, or your mouse or trackpad on a computer.' }) => {
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const pad = new SignaturePad(canvas, { minWidth: 1, maxWidth: 2.6, penColor: '#1f1333', backgroundColor: 'rgba(0,0,0,0)' });
    padRef.current = pad;
    // Keep strokes crisp on high-density screens and when the box changes width.
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const data = pad.toData();
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext('2d').scale(ratio, ratio);
      pad.clear();
      if (data.length) pad.fromData(data);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const done = () => {
      const isEmpty = pad.isEmpty();
      setEmpty(isEmpty);
      onChange?.(isEmpty ? null : pad.toDataURL('image/png'));
    };
    pad.addEventListener('endStroke', done);
    return () => { ro.disconnect(); pad.off(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = () => { padRef.current?.clear(); setEmpty(true); onChange?.(null); };

  return (
    <div className="sig">
      <span className="sig__label">{label}</span>
      <div className={`sig__pad ${empty ? 'is-empty' : ''}`}>
        <canvas ref={canvasRef} aria-label="Signature box: sign here" />
        {empty && <span className="sig__hint" aria-hidden="true"><PenLine size={16} /> Sign here</span>}
        <button type="button" className="sig__clear" onClick={clear} disabled={empty}><Eraser size={14} /> Clear</button>
      </div>
      {hint && <p className="k-fine">{hint}</p>}
    </div>
  );
};

export default SignatureField;
