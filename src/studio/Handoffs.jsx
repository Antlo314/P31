import React, { useEffect, useState } from 'react';
import { Check, Mail, MessageCircleQuestion } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Messages and comments Carla passed to the team (v56): who asked, what, why, and the conversation.
// v57 adds the brand it came in for (site) and, for an info request (kind lead), the email the
// person gave. Rows from before v57, or that Carla could not place, show no brand badge.
// Shown on top of Content Studio > Messages until someone marks them handled.
const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const BRAND = { market: { label: 'Marketplace', className: 'ds-pill ds-pill--gold' }, collective: { label: 'Collective', className: 'ds-pill' } };
const PLATFORM = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', googlebusiness: 'Google' };
const platformName = (p) => PLATFORM[String(p || '').toLowerCase()] || (p ? `${String(p)[0].toUpperCase()}${String(p).slice(1)}` : 'Social');
const KIND = { dm: 'DM', comment: 'comment', review: 'review', lead: 'DM' };
// Only a plain address becomes a mailto link (the text came from a DM).
const isEmail = (e) => /^[^\s@?&#<>]+@[^\s@?&#<>]+\.[^\s@?&#<>]+$/.test(e || '');

const Handoffs = () => {
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => supabase.from('dm_handoffs').select('*').is('resolved_at', null).order('created_at', { ascending: false }).limit(50)
    .then(({ data, error }) => setRows(error ? [] : data || []));
  useEffect(() => { Promise.resolve().then(load); }, []);
  const done = async (r) => {
    const { data: me } = await supabase.auth.getUser();
    await supabase.from('dm_handoffs').update({ resolved_at: new Date().toISOString(), resolved_by: me.user?.id || null }).eq('id', r.id);
    setRows((list) => list.filter((x) => x.id !== r.id));
  };
  if (!rows?.length) return null;
  return (
    <section className="ds-card" style={{ marginBottom: 16 }}>
      <div className="ds-card__head"><h3><MessageCircleQuestion size={18} /> Waiting for the team · {rows.length}</h3></div>
      <p className="ds-muted" style={{ marginTop: 0 }}>Questions Carla could not answer from the websites or that need a person, and info requests waiting for an email. Reply where it came in (the Instagram, Facebook or TikTok app, or Zernio), or by email for an info request, then mark it handled.</p>
      <ul className="ds-list">
        {rows.map((r) => {
          const brand = BRAND[r.site];
          const lead = r.kind === 'lead';
          return (
            <li key={r.id} className="ds-row" style={{ display: 'grid', gap: 6, alignItems: 'start' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <strong>{r.sender || 'Someone'}</strong>
                {brand && <span className={brand.className}>{brand.label}</span>}
                {lead && <span className="ds-pill ds-pill--green"><Mail size={12} /> Info request</span>}
                <small className="ds-muted">{platformName(r.platform)} {KIND[r.kind] || 'DM'} · {ago(r.created_at)}</small>
              </div>
              {lead && (
                <div style={{ display: 'grid', gap: 2 }}>
                  {isEmail(r.email)
                    ? <a href={`mailto:${r.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '1.05rem', color: 'var(--ds-ink)', textDecoration: 'underline', textUnderlineOffset: 3, overflowWrap: 'anywhere' }}><Mail size={16} /> {r.email}</a>
                    : <strong>{r.email || 'No email on file: see the conversation'}</strong>}
                  <small className="ds-muted">They were promised the details within 24–48 hours.</small>
                </div>
              )}
              {r.question && <span>“{r.question}”</span>}
              {(r.reason || r.carla_reply) && <small className="ds-muted">{r.reason ? `Why: ${r.reason}` : ''}{r.reason && r.carla_reply ? ' · ' : ''}{r.carla_reply ? `Carla said: “${r.carla_reply}”` : ''}</small>}
              {open === r.id && r.transcript && <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: '0.85rem', background: 'rgba(155, 113, 178, 0.14)', padding: 10, borderRadius: 10 }}>{r.transcript}</pre>}
              <div style={{ display: 'flex', gap: 8 }}>
                {r.transcript && <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Hide' : 'Show'} conversation</button>}
                <button type="button" className="k-btn k-btn--plum k-btn--sm" onClick={() => done(r)}><Check size={14} /> Handled</button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default Handoffs;
