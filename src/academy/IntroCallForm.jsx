import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CONTACT_EMAIL } from '../lib/academy';

const PROGRAM_OPTIONS = [['business', 'Business mentorship'], ['faith', 'Faith-based mentorship'], ['', 'Not sure yet']];

// The only public way into the mentorships: request an intro call.
const IntroCallForm = ({ program = '' }) => {
  const [form, setForm] = useState({ program, name: '', email: '', phone: '', times: '', message: '', trap: '' });
  const [state, setState] = useState('idle'); // idle | sending | done
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setState('sending'); setError('');
    const { error: err } = await supabase.rpc('request_intro_call', {
      p_program: form.program || null, p_name: form.name, p_email: form.email, p_phone: form.phone,
      p_message: form.message, p_times: form.times, p_trap: form.trap,
    });
    if (err) {
      setError(/Please add/.test(err.message) ? err.message : `We couldn’t send that just now. Please try again, or email ${CONTACT_EMAIL}.`);
      setState('idle');
      return;
    }
    setState('done');
  };

  if (state === 'done') {
    return (
      <div className="k-success">
        <span className="k-icon"><CheckCircle2 size={28} /></span>
        <h3>Your request is in</h3>
        <p>Thank you, {form.name.split(' ')[0] || 'friend'}. Our team will reach out to schedule your intro call. Questions in the meantime? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </div>
    );
  }

  return (
    <form className="k-form" onSubmit={submit}>
      <div className="k-field">
        <span>I’m interested in</span>
        <div className="k-segs" role="group" aria-label="Mentorship">
          {PROGRAM_OPTIONS.map(([v, label]) => (
            <button type="button" key={label} aria-pressed={form.program === v} onClick={() => setForm({ ...form, program: v })}>{label}</button>
          ))}
        </div>
      </div>
      <div className="k-row">
        <label className="k-field"><span>Full name</span>
          <input required autoComplete="name" value={form.name} onChange={set('name')} />
        </label>
        <label className="k-field"><span>Email</span>
          <input required type="email" inputMode="email" autoComplete="email" value={form.email} onChange={set('email')} />
        </label>
      </div>
      <div className="k-row">
        <label className="k-field"><span>Phone (optional)</span>
          <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
        </label>
        <label className="k-field"><span>Best days &amp; times for a call</span>
          <input value={form.times} onChange={set('times')} placeholder="e.g. Weekday evenings after 6" />
        </label>
      </div>
      <label className="k-field"><span>Tell us about your season (optional)</span>
        <textarea rows={4} value={form.message} onChange={set('message')} placeholder="Where you are, what you’re building, what you’re praying about…" />
      </label>
      <input className="k-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.trap} onChange={set('trap')} />
      {error && <p className="k-error" role="alert">{error}</p>}
      <button className="k-btn k-btn--gold k-btn--lg k-btn--block" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : <>Request my intro call <ArrowRight size={18} /></>}
      </button>
      <p className="k-fine" style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
        <Mail size={13} /> Prefer email? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </form>
  );
};

export default IntroCallForm;
