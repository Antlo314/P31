import React, { useEffect, useState } from 'react';
import { Globe, Phone, AtSign, CalendarDays, HeartHandshake, Mic, BadgeDollarSign, Save, Check, RotateCcw, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRoles } from '../../lib/roles';
import { DEFAULTS, FIELD_GROUPS, FIELDS, applySiteInfo, fieldError, sanitize } from '../../lib/siteInfo';

// Systems > Site info (v63): the phone, hours, links and membership price both public sites show.
// Saved to app_settings 'site_public' (only the fields that differ from the defaults in src/lib/siteInfo.js);
// visitors pick the change up on their next page load, no deploy needed.
const ICONS = { contact: Phone, social: AtSign, booking: CalendarDays, giving: HeartHandshake, podcast: Mic, membership: BadgeDollarSign };

const asText = (v) => (v === undefined || v === null ? '' : String(v));
const norm = (key, v) => (FIELDS[key].kind === 'price' ? Number(v) : asText(v).trim());

const SiteInfo = () => {
  const { roles } = useRoles();
  const admin = !!(roles.admin || roles.operator);
  const [saved, setSaved] = useState(null); // the overrides stored now
  const [form, setForm] = useState(null); // text in every box
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'site_public').maybeSingle().then(({ data, error: err }) => {
      if (err) setError(/does not exist|schema cache|Could not find/i.test(err.message) ? 'Run storefront_v42_operations.sql and storefront_v63_site_public.sql first (Systems → Health has the command).' : err.message);
      const stored = sanitize(data?.value);
      setSaved(stored);
      setForm(Object.fromEntries(Object.keys(FIELDS).map((k) => [k, asText(k in stored ? stored[k] : DEFAULTS[k])])));
    });
  }, []);

  if (!form) return <div className="sys-page"><p className="sys-muted">Loading…</p></div>;

  const errors = Object.fromEntries(Object.keys(FIELDS).map((k) => [k, fieldError(k, FIELDS[k].kind === 'price' ? form[k] : form[k].trim())]));
  const bad = Object.values(errors).some(Boolean);
  // What would be stored: only the fields that differ from the default.
  const next = Object.fromEntries(Object.keys(FIELDS).filter((k) => norm(k, form[k]) !== DEFAULTS[k]).map((k) => [k, norm(k, form[k])]));
  const dirty = JSON.stringify(next) !== JSON.stringify(Object.fromEntries(Object.keys(FIELDS).filter((k) => k in saved).map((k) => [k, saved[k]])));

  const set = (k) => (e) => { setMsg(''); setForm({ ...form, [k]: e.target.value }); };
  const reset = (k) => { setMsg(''); setForm({ ...form, [k]: asText(DEFAULTS[k]) }); };

  const save = async (e) => {
    e.preventDefault();
    if (!admin || bad || busy) return;
    setBusy(true); setError(''); setMsg('');
    const { data: me } = await supabase.auth.getUser();
    const { error: err } = await supabase.from('app_settings').upsert({ key: 'site_public', value: next, updated_by: me?.user?.id || null, updated_at: new Date().toISOString() });
    setBusy(false);
    if (err) return setError(err.message);
    setSaved(next);
    applySiteInfo(next);
    setMsg(Object.keys(next).length ? `Saved. ${Object.keys(next).length} field${Object.keys(next).length === 1 ? '' : 's'} differ from the defaults; visitors see the change on their next page load.` : 'Saved. Every field is back on its default.');
  };

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Settings</p>
        <h1>Site info</h1>
        <p className="sys-muted">The phone, hours, links and membership price shown on p31market.com and thep31collective.org. Changes show on both sites on the next page load, no deploy needed.</p>
      </header>

      <p className="sys-alert">Search-engine text (the Google listing details baked into each page: phone and social links) updates on the next deploy. Mentorship prices are not here; they come from Stripe.</p>
      {error && <p className="sys-error" style={{ marginTop: 12 }}>{error}</p>}

      <form onSubmit={save}>
        {FIELD_GROUPS.map((g) => {
          const Icon = ICONS[g.id] || Globe;
          return (
            <section key={g.id} className="sys-card">
              <h2><Icon size={18} /> {g.label}</h2>
              <div className="sys-form">
                {g.fields.map((f) => {
                  const changed = norm(f.key, form[f.key]) !== DEFAULTS[f.key];
                  const link = (f.kind === 'url' || f.kind === 'calendly') && !errors[f.key] && form[f.key].trim();
                  return (
                    <label key={f.key} className="sys-field">
                      <span>
                        {f.label}{f.optional && <small className="sys-muted"> · optional</small>}
                        {changed && <small style={{ color: 'var(--sys-gold)' }}> · changed</small>}
                      </span>
                      <span className="sys-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          style={{ flex: 1, minWidth: 0 }}
                          type={f.kind === 'price' ? 'number' : f.kind === 'phone' ? 'tel' : f.kind === 'text' ? 'text' : 'url'}
                          step={f.kind === 'price' ? '0.01' : undefined}
                          min={f.kind === 'price' ? '1' : undefined}
                          inputMode={f.kind === 'price' ? 'decimal' : undefined}
                          value={form[f.key]}
                          onChange={set(f.key)}
                          disabled={!admin}
                          aria-invalid={!!errors[f.key]}
                          placeholder={f.optional ? 'Leave empty to hide' : asText(DEFAULTS[f.key])}
                        />
                        {link && <a className="sys-btn sys-btn--ghost" href={link} target="_blank" rel="noopener noreferrer" aria-label={`Open ${f.label}`}><ExternalLink size={15} /></a>}
                        {admin && changed && (
                          <button type="button" className="sys-btn sys-btn--ghost" onClick={() => reset(f.key)} title={`Default: ${asText(DEFAULTS[f.key]) || '(empty)'}`}>
                            <RotateCcw size={15} /> Reset to default
                          </button>
                        )}
                      </span>
                      {errors[f.key] && <small className="sys-error">{errors[f.key]}</small>}
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className="sys-card">
          {msg && <p className="sys-ok"><Check size={16} /> {msg}</p>}
          {!admin && <p className="sys-muted">Only an admin can change site info.</p>}
          {admin && (
            <button className="sys-btn sys-btn--gold" disabled={busy || bad || !dirty}>
              <Save size={16} /> {busy ? 'Saving…' : dirty ? 'Save site info' : 'No changes to save'}
            </button>
          )}
          {bad && <p className="sys-error" style={{ marginTop: 8 }}>Fix the fields marked above to save.</p>}
        </section>
      </form>
    </div>
  );
};

export default SiteInfo;
