import React, { useEffect, useState } from 'react';
import { Check, MessageCircleQuestion } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Messages and comments Carla passed to the team (v56): who asked, what, why, and the conversation.
// Shown on top of Content Studio > Messages until someone marks them handled.
const ago = (iso) => {
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

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
      <p className="ds-muted" style={{ marginTop: 0 }}>Questions Carla could not answer from the websites, or that need a person. Reply in the Instagram or Facebook app, then mark it handled.</p>
      <ul className="ds-list">
        {rows.map((r) => (
          <li key={r.id} className="ds-row" style={{ display: 'grid', gap: 6, alignItems: 'start' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <strong>{r.sender || 'Someone'}</strong>
              <small className="ds-muted">{r.platform} {r.kind === 'comment' ? 'comment' : 'DM'} · {ago(r.created_at)}</small>
            </div>
            <span>“{r.question}”</span>
            <small className="ds-muted">Why: {r.reason}{r.carla_reply ? ` · Carla said: “${r.carla_reply}”` : ''}</small>
            {open === r.id && r.transcript && <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: '0.85rem', background: 'var(--mist, #F8F3FA)', padding: 10, borderRadius: 10 }}>{r.transcript}</pre>}
            <div style={{ display: 'flex', gap: 8 }}>
              {r.transcript && <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Hide' : 'Show'} conversation</button>}
              <button type="button" className="k-btn k-btn--plum k-btn--sm" onClick={() => done(r)}><Check size={14} /> Handled</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default Handoffs;
