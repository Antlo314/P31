import React, { useState } from 'react';
import { Check, ExternalLink, Palette, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { STORE_TEMPLATES, ACCENTS, resolveDesign } from './templates';
import './StoreDesigner.css';

const OPTIONS = {
  heading: [['serif', 'Elegant serif'], ['sans', 'Modern sans']],
  hero: [['banner', 'Banner'], ['tall', 'Tall cinematic'], ['minimal', 'Minimal colour']],
  columns: [[2, '2'], [3, '3'], [4, '4']],
  cards: [['soft', 'Soft'], ['framed', 'Framed'], ['minimal', 'Minimal']],
  buttons: [['pill', 'Pill'], ['rounded', 'Rounded'], ['square', 'Square']],
};

const LABELS = { heading: 'Headings', hero: 'Hero', columns: 'Products per row (desktop)', cards: 'Product cards', buttons: 'Buttons' };

// A small live mock of the storefront using the same choices.
const Preview = ({ d, name, products }) => {
  const tpl = STORE_TEMPLATES.find((t) => t.id === d.template);
  const [bg, , line] = tpl.preview;
  const dark = d.template === 'noir';
  const radius = d.buttons === 'pill' ? 999 : d.buttons === 'rounded' ? 8 : 0;
  const cardRadius = d.cards === 'minimal' ? 0 : d.cards === 'framed' ? 4 : 10;
  const items = products.length ? products.slice(0, d.columns * 2) : Array.from({ length: d.columns * 2 }, () => null);
  const hero = (
    <div className="sd-prev__hero" style={{
      height: d.hero === 'tall' ? 120 : d.hero === 'minimal' ? 64 : 88,
      background: d.hero === 'minimal' ? d.accent : `linear-gradient(135deg, ${d.accent}, #1d0f2e)`,
    }}>
      <span style={{ fontFamily: d.heading === 'serif' ? 'var(--font-heading)' : 'var(--font-body)', fontWeight: d.heading === 'serif' ? 400 : 800 }}>{name || 'Your Shop'}</span>
    </div>
  );
  const grid = (
    <div className="sd-prev__grid" style={{ gridTemplateColumns: `repeat(${d.columns}, 1fr)` }}>
      {items.map((p, i) => (
        <div key={p?.id || i} style={{ borderRadius: cardRadius, padding: d.cards === 'framed' ? 4 : 0, background: d.cards === 'framed' ? line : 'transparent' }}>
          <div className="sd-prev__img" style={{ borderRadius: cardRadius, background: p?.image_url ? `center / cover no-repeat url("${p.image_url}")` : line }} />
          <div className="sd-prev__price" style={{ background: d.accent, opacity: 0.85 }} />
        </div>
      ))}
    </div>
  );
  return (
    <div className="sd-prev" style={{ background: bg, color: dark ? '#fff' : '#222' }}>
      {hero}
      {d.productsFirst ? grid : null}
      {d.showAbout && <div className="sd-prev__about" style={{ background: dark ? '#1B1026' : '#fff', borderColor: line }} />}
      {!d.productsFirst ? grid : null}
      <div className="sd-prev__btn" style={{ borderRadius: radius, background: d.accent }} />
    </div>
  );
};

const StoreDesigner = ({ curator, products = [], onSaved }) => {
  const [d, setD] = useState(() => resolveDesign(curator?.store_design));
  const [state, setState] = useState('idle');

  const pickTemplate = (t) => setD({ ...d, template: t.id, ...t.defaults });

  const save = async () => {
    setState('saving');
    const { error } = await supabase.from('curator_data').update({ store_design: d }).eq('id', curator.id);
    if (error) return setState(`error:${error.message}`);
    setState('saved');
    onSaved?.();
    setTimeout(() => setState('idle'), 2500);
  };

  return (
    <div className="sd">
      <div className="sd-controls">
        <section>
          <h3>Template</h3>
          <div className="sd-templates">
            {STORE_TEMPLATES.map((t) => (
              <button key={t.id} className={`sd-tpl ${d.template === t.id ? 'is-on' : ''}`} onClick={() => pickTemplate(t)} aria-pressed={d.template === t.id}>
                <span className="sd-tpl__sw">{t.preview.map((c) => <i key={c} style={{ background: c }} />)}</span>
                <strong>{t.name}</strong>
                <span>{t.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3><Palette size={16} /> Accent colour</h3>
          <div className="sd-accents">
            {ACCENTS.map((c) => (
              <button key={c} className={`sd-accent ${d.accent === c ? 'is-on' : ''}`} style={{ background: c }} onClick={() => setD({ ...d, accent: c })} aria-label={`Accent ${c}`} />
            ))}
            <label className="sd-accent sd-accent--custom" aria-label="Custom colour">
              <input type="color" value={d.accent} onChange={(e) => setD({ ...d, accent: e.target.value })} />
            </label>
          </div>
        </section>

        {Object.entries(OPTIONS).map(([key, opts]) => (
          <section key={key}>
            <h3>{LABELS[key]}</h3>
            <div className="sd-seg">
              {opts.map(([v, label]) => (
                <button key={v} className={d[key] === v ? 'is-on' : ''} onClick={() => setD({ ...d, [key]: v })}>{label}</button>
              ))}
            </div>
          </section>
        ))}

        <section>
          <h3>Sections</h3>
          <label className="sd-toggle"><span>Show products before your story</span>
            <input type="checkbox" checked={d.productsFirst} onChange={(e) => setD({ ...d, productsFirst: e.target.checked })} /></label>
          <label className="sd-toggle"><span>Show “About / story” section</span>
            <input type="checkbox" checked={d.showAbout} onChange={(e) => setD({ ...d, showAbout: e.target.checked })} /></label>
          <label className="sd-toggle"><span>Show testimonials</span>
            <input type="checkbox" checked={d.showTestimonials} onChange={(e) => setD({ ...d, showTestimonials: e.target.checked })} /></label>
        </section>
      </div>

      <aside className="sd-side">
        <Preview d={d} name={curator?.business_name} products={products} />
        <button className="btn-solid-gold sd-save" onClick={save} disabled={state === 'saving'}>
          {state === 'saved' ? <><Check size={16} /> Saved</> : state === 'saving' ? 'Saving…' : <><Save size={16} /> Publish design</>}
        </button>
        {state.startsWith('error:') && <p className="sd-error">{state.slice(6)}</p>}
        {curator && (
          <a className="sd-view" href={`/${curator.slug || curator.id}`} target="_blank" rel="noreferrer">
            View my storefront <ExternalLink size={14} />
          </a>
        )}
      </aside>
    </div>
  );
};

export default StoreDesigner;
