import React, { useEffect, useState } from 'react';
import { Mail, Lock, Plus, X, RotateCcw, Crown, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useRoles } from '../../lib/roles';

// Systems > Email recipients: who gets each team email, saved in app_settings 'notify' as
// { [flow]: { to: [...] }, ceo_copy: false }. The email functions read it through
// supabase/functions/_shared/notify.ts (cached for 30 seconds). A flow with nothing saved keeps its
// default: the Supabase secret named below when one is set, else the addresses shown here.
const FOUNDER = 'founder@thep31collective.org';
const MEMBERS = 'members@thep31collective.org';
const VENDOR = 'vendor@p31market.com';
const MARKET_TEAM = [VENDOR, FOUNDER];
/** The signed coaching forms hold date of birth, home address and emergency contact: team mailboxes only. */
const PRIVATE_DOMAINS = ['@thep31collective.org', '@p31market.com'];
const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[a-z]{2,}$/i;

// Every team email, in the words the team uses. `ceo`: ceo@ gets a copy unless the switch below is off.
// The defaults here are display text; they must match the code in each function.
const GROUPS = [
  {
    title: 'Collective',
    flows: [
      { key: 'collective', name: 'New Collective application', about: 'Someone applied to join The P31 Collective (thep31collective.org/join).', defaults: [MEMBERS, FOUNDER], secret: 'JOIN_NOTIFY_TO', ceo: true },
      { key: 'introcall', name: 'Mentorship intro-call request', about: 'Someone asked for an intro call from the mentorship page.', defaults: [MEMBERS, FOUNDER], secret: 'INTRO_NOTIFY_TO', ceo: true },
      { key: 'enrollment', name: 'New enrollment (after payment)', about: 'A mentee paid and is enrolled; her welcome email has gone out.', defaults: [FOUNDER] },
    ],
  },
  {
    title: 'Private coaching forms',
    private: true,
    flows: [
      { key: 'coaching_coaching', name: 'Signed Business Coaching Agreement', about: 'A mentee signed the first of the three forms. The signed PDF is attached.', defaults: [FOUNDER], private: true },
      { key: 'coaching_confidentiality', name: 'Signed Confidentiality Agreement', about: 'A mentee signed the second form. The signed PDF is attached.', defaults: [FOUNDER], private: true },
      { key: 'coaching_safety', name: 'Signed Client Safety form', about: 'A mentee signed the Client Safety & Emergency Contact form. The signed PDF is attached.', defaults: [MEMBERS, FOUNDER], private: true },
    ],
  },
  {
    title: 'Marketplace',
    flows: [
      { key: 'vendor', name: 'New vendor application', about: 'A business applied to vend (p31market.com/apply).', defaults: MARKET_TEAM, secret: 'VENDOR_NOTIFY_TO', ceo: true },
      { key: 'agreement', name: 'Storefront agreement signed', about: 'A vendor signed the Storefront Agreement.', defaults: MARKET_TEAM, secret: 'VENDOR_NOTIFY_TO', ceo: true },
      { key: 'registration', name: 'Market registration', about: 'A vendor registered for a market day and signed the rules.', defaults: MARKET_TEAM, secret: 'VENDOR_NOTIFY_TO', ceo: true },
      { key: 'shop_signup', name: 'New storefront', about: 'Someone created a shop (pre-approved or waiting for review).', defaults: MARKET_TEAM, secret: 'VENDOR_NOTIFY_TO', ceo: true },
      { key: 'feedback', name: 'Vendor feedback survey', about: 'A vendor answered the after-market survey.', defaults: MARKET_TEAM, secret: 'FEEDBACK_NOTIFY_TO, then VENDOR_NOTIFY_TO', ceo: true },
      { key: 'volunteer', name: 'Volunteer sign-up', about: 'Someone signed the volunteer acknowledgment.', defaults: ['outreach@p31market.com', FOUNDER], secret: 'VOLUNTEER_NOTIFY_TO', ceo: true },
      { key: 'merch', name: 'Merch orders and Printful problems', about: 'A merch order was paid, or Printful reports a failed, cancelled or held order.', defaults: [VENDOR, 'ceo@p31market.com'], secret: 'MERCH_NOTIFY_TO' },
    ],
  },
  {
    title: 'Team and systems',
    flows: [
      { key: 'carla', name: 'Carla hand-offs', about: 'A DM or comment Carla passed to a person, an info request, or a low Google review.', defaults: [], secret: 'DM_AGENT_NOTIFY_EMAIL' },
      { key: 'digest', name: 'Morning team digest', about: 'The 8 AM summary of what came in over the last day.', defaults: [FOUNDER], secret: 'DIGEST_TO' },
      { key: 'watchdog', name: 'System alerts', about: 'The hourly system check: something broke, and the 8 AM list of open items.', defaults: ['ceo@p31market.com'], secret: 'OPS_ALERT_TO, then DIGEST_TO' },
      { key: 'autocreate', name: 'Month of posts drafted', about: 'Content Studio drafted next month’s posts and they are ready for review.', defaults: ['marketing@p31market.com', FOUNDER], secret: 'AUTOCREATE_TO' },
    ],
  },
];

const clean = (e) => String(e || '').trim().toLowerCase();
const allowed = (flow, e) => !flow.private || PRIVATE_DOMAINS.some((d) => e.endsWith(d));
const savedList = (vals, key) => (Array.isArray(vals?.[key]?.to) ? vals[key].to.filter((e) => EMAIL.test(e)) : []);

/** One email: who gets it now, and the admin's add, remove and Use default. */
const Flow = ({ flow, list, ceoCopy, admin, onSave }) => {
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState('');
  const custom = list.length > 0;
  const shown = custom ? list : flow.defaults;

  const add = async (e) => {
    e.preventDefault();
    const email = clean(draft);
    if (!EMAIL.test(email)) return setProblem('That does not look like an email address.');
    if (!allowed(flow, email)) return setProblem('Only @thep31collective.org or @p31market.com addresses can get this form.');
    if (shown.includes(email)) return setProblem('Already on the list.');
    // The first change starts from the default addresses shown, so adding someone never drops the others.
    const next = [...new Set([...(custom ? list : flow.defaults), email])];
    setProblem('');
    if (await onSave(flow.key, next)) setDraft('');
  };
  const remove = (email) => onSave(flow.key, (custom ? list : flow.defaults).filter((e) => e !== email));

  return (
    <li style={{ display: 'grid', gap: 8, alignItems: 'start' }}>
      <span>
        <strong>{flow.private && <Lock size={13} aria-label="Private" />} {flow.name}</strong>
        <br /><small className="sys-muted">{flow.about}</small>
      </span>
      <div className="sys-chips" aria-label={`Who gets ${flow.name}`}>
        {shown.length ? shown.map((e) => (
          <span key={e} className={`sys-chip ${custom ? 'is-on' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textTransform: 'none', cursor: 'default' }}>
            {e}
            {admin && <button type="button" onClick={() => remove(e)} aria-label={`Remove ${e}`} title="Remove" style={{ border: 0, background: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}><X size={13} /></button>}
          </span>
        )) : <span className="sys-muted" style={{ margin: 0 }}>Nobody (no email is sent)</span>}
        {flow.ceo && ceoCopy && <span className="sys-chip" style={{ textTransform: 'none', cursor: 'default', opacity: 0.75, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Crown size={13} /> + ceo@p31market.com</span>}
      </div>
      <small className="sys-muted" style={{ margin: 0 }}>
        {custom
          ? <>Your list. The default is {flow.defaults.length ? flow.defaults.join(', ') : 'nobody'}{flow.secret ? ` (or the ${flow.secret} secret, when set)` : ''}.</>
          : <>Default{flow.secret ? `: the ${flow.secret} secret when it is set in Supabase, otherwise the addresses above` : ''}.{flow.defaults.length ? ' Adding or removing an address starts your own list from these.' : ''}</>}
      </small>
      {admin && (
        <form className="sys-row" style={{ flexWrap: 'wrap', gap: 8 }} onSubmit={add}>
          <input type="email" className="sys-grow" value={draft} onChange={(e) => { setDraft(e.target.value); setProblem(''); }} placeholder="name@thep31collective.org" aria-label={`Add someone to ${flow.name}`} />
          <button className="sys-btn sys-btn--gold sys-btn--sm" disabled={!draft.trim()}><Plus size={14} /> Add</button>
          {custom && <button type="button" className="sys-btn sys-btn--ghost sys-btn--sm" onClick={() => onSave(flow.key, [])}><RotateCcw size={14} /> Use default</button>}
        </form>
      )}
      {problem && <p className="sys-error" role="alert">{problem}</p>}
    </li>
  );
};

const EmailRecipients = () => {
  const { roles } = useRoles();
  const admin = !!(roles.admin || roles.operator);
  const [vals, setVals] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'notify').maybeSingle().then(({ data, error: err }) => {
      if (err) setError(/does not exist|schema cache/i.test(err.message) ? 'Run storefront_v42_operations.sql first (Systems → Health has a copy button).' : err.message);
      setVals(data?.value && typeof data.value === 'object' ? data.value : {});
    });
  }, []);

  const write = async (value, done) => {
    const before = vals;
    setVals(value); setError(''); setMsg('');
    const { error: err } = await supabase.from('app_settings').upsert({ key: 'notify', value, updated_at: new Date().toISOString() });
    if (err) { setError(`Not saved: ${err.message}`); setVals(before); return false; }
    setMsg(`${done} Emails use it within a minute.`);
    return true;
  };
  // An empty list means "use the default": the key is left out entirely.
  const saveFlow = (key, list) => {
    const value = { ...vals };
    if (list.length) value[key] = { ...value[key], to: list };
    else delete value[key];
    const name = GROUPS.flatMap((g) => g.flows).find((f) => f.key === key)?.name || key;
    return write(value, list.length ? `Saved who gets “${name}”.` : `“${name}” is back on its default.`);
  };
  const ceoCopy = vals?.ceo_copy !== false;
  const flipCeo = () => write({ ...vals, ceo_copy: !ceoCopy }, ceoCopy ? 'The CEO copy is off.' : 'The CEO copy is on.');

  return (
    <div className="sys-page">
      <header className="sys-page__head">
        <p className="sys-eyebrow">Email recipients</p>
        <h1>Who gets which email</h1>
        <p className="sys-muted">Every email the sites send the team when something comes in. Add or remove addresses here instead of asking a developer; a flow you have not changed keeps its default. The person who filled in a form always gets their own copy, whatever is chosen here.</p>
      </header>

      {error && <p className="sys-error" role="alert">{error}</p>}
      {msg && <p className="sys-ok"><Check size={16} /> {msg}</p>}

      <section className="sys-card">
        <h2><Crown size={18} /> CEO copy</h2>
        <ul className="sys-list">
          <li>
            <span><strong>Copy ceo@p31market.com</strong><br /><small className="sys-muted">Adds ceo@ to the emails marked “+ ceo@” below (applications, vendor forms, volunteers, intro calls, new shops). Never the private coaching forms or the enrollment notice.</small></span>
            <button type="button" className={`sys-chip ${ceoCopy ? 'is-on' : ''}`} aria-pressed={ceoCopy} disabled={!admin || !vals} onClick={flipCeo}>{ceoCopy ? 'On' : 'Off'}</button>
          </li>
        </ul>
      </section>

      {vals && GROUPS.map((g) => (
        <section className="sys-card" key={g.title}>
          <h2>{g.private ? <Lock size={18} /> : <Mail size={18} />} {g.title}</h2>
          {g.private && <p className="sys-alert">These forms include her date of birth, home address and emergency contact, with the signed PDF attached. To keep that private they can only go to P31 mailboxes: addresses ending in @thep31collective.org or @p31market.com. The CEO copy never applies to them.</p>}
          <ul className="sys-list">
            {g.flows.map((f) => <Flow key={f.key} flow={f} list={savedList(vals, f.key).filter((e) => allowed(f, e))} ceoCopy={ceoCopy} admin={admin} onSave={saveFlow} />)}
          </ul>
        </section>
      ))}
      {vals && !admin && <p className="sys-muted">Only an admin can change these.</p>}
    </div>
  );
};

export default EmailRecipients;
