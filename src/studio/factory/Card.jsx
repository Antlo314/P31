import React, { useEffect, useRef, useState } from 'react';
import mark from '../../assets/web/p31-market-mark-192.webp';
import './card.css';

export const CARD_W = 1080;
export const CARD_H = 1350;

/** A card that fills whatever width it is given (thumbnails, phone columns). */
export const FitCard = ({ spec, className = '' }) => {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => { const w = el.clientWidth; if (w) setScale(w / CARD_W); };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    const raf = requestAnimationFrame(measure);
    return () => { ro?.disconnect(); cancelAnimationFrame(raf); };
  }, []);
  return <div ref={ref} className={`pc-fit ${className}`}><Card spec={spec} scale={scale} /></div>;
};

const Blank = ({ wide }) => <span className={`pc-blank ${wide ? 'pc-blank--wide' : ''}`} />;

/**
 * One social card (1080×1350) drawn from a spec: { type, style, ...fields }.
 * Full size by default; pass `scale` for a thumbnail (the wrapper shrinks with it).
 */
const Card = ({ spec, scale = 1, className = '' }) => {
  if (!spec) return null;
  const s = spec;
  let body = null;
  switch (s.type) {
    case 'fill':
      body = (
        <div className="pc-inner pc-center">
          <p className="pc-eyebrow">Bible fill-in-the-blank</p>
          <p className="pc-verse">“{s.text}<Blank />.”</p>
          <p className="pc-ref">{(s.ref || '').toUpperCase()} · KJV</p>
          <span className="pc-ask">No peeking — answer in the comments 👇</span>
        </div>
      );
      break;
    case 'prompt':
      body = (
        <div className="pc-inner pc-center">
          <p className="pc-eyebrow">Finish the sentence</p>
          <p className="pc-verse pc-verse--big">{s.text}<Blank wide /></p>
          <span className="pc-ask">{s.ask || 'Your answer below 👇'}</span>
        </div>
      );
      break;
    case 'choice':
      body = (
        <div className="pc-inner pc-center">
          <p className="pc-eyebrow">This or that</p>
          <h1 className="pc-q">{s.text}</h1>
          <div className="pc-opts">
            {(s.options || []).slice(0, 2).map((o, i) => <div className="pc-opt" key={i}><b>{'AB'[i]}</b><span>{o}</span></div>)}
          </div>
          <span className="pc-ask">Comment A or B 👇</span>
        </div>
      );
      break;
    case 'quiz':
      body = (
        <div className="pc-inner pc-center">
          <p className="pc-eyebrow">P31 pop quiz</p>
          <h1 className="pc-q">{s.text}</h1>
          <div className="pc-opts">
            {(s.options || []).slice(0, 4).map((o, i) => <div className="pc-opt" key={i}><b>{'ABCD'[i]}</b><span>{o}</span></div>)}
          </div>
          <span className="pc-ask">Answer below, no peeking 👇</span>
        </div>
      );
      break;
    case 'amen':
      body = (
        <div className="pc-inner pc-center">
          <p className="pc-eyebrow">Sunday word</p>
          <p className={`pc-verse ${(s.text || '').length > 150 ? 'pc-verse--small' : ''}`}>“{s.text}”</p>
          <p className="pc-ref">{(s.ref || '').toUpperCase()} · KJV</p>
          <span className="pc-ask">If this is your prayer this week, comment Amen 🙏🏾</span>
        </div>
      );
      break;
    case 'tip':
      body = (
        <div className="pc-inner pc-center">
          <p className="pc-eyebrow">For the women who build</p>
          <p className="pc-verse pc-verse--tip">{s.text}</p>
          <span className="pc-ask">{s.ask || 'Agree? Tell us below 👇'}</span>
        </div>
      );
      break;
    default:
      body = (
        <div className="pc-inner">
          <img className="pc-logo" src={mark} alt="" />
          <p className="pc-eyebrow">{s.eyebrow}</p>
          <h1 className="pc-title" dangerouslySetInnerHTML={{ __html: s.title || '' }} />
          <ul className="pc-list">{(s.items || []).map((i) => <li key={i}>{i}</li>)}</ul>
          <span className="pc-pill">{s.pill}</span>
        </div>
      );
  }
  const wrap = scale === 1 ? {} : { width: CARD_W * scale, height: CARD_H * scale };
  return (
    <div className={`pc-wrap ${className}`} style={wrap}>
      <section className={`pc pc--${s.style || 'night'} pc--${s.type}`} style={scale === 1 ? undefined : { transform: `scale(${scale})` }} aria-label={`${s.type} card`}>
        <div className="pc-frame" /><span className="pc-gate" />
        {body}
        {s.type !== 'cta' && <p className="pc-handle">@proverbs31market</p>}
      </section>
    </div>
  );
};

export default Card;
