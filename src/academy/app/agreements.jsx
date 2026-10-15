import React, { useState } from 'react';
import { Send, Copy, Check, Mail, Link2, FileCheck2, Trash2, Eye, RotateCcw, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime, CONTACT_EMAIL } from '../../lib/academy';
import { DashHead, DashEmpty } from '../../apps/DashShell';
import { useAcademy, useRows, write } from './data';
import { Modal } from './ui';
import { ORDER, PACKAGES, packagePrice } from '../../../supabase/functions/_shared/coaching-text.js';

const daysFromNow = (d) => new Date(Date.now() + d * 86400e3).toISOString();
const LABEL = { coaching: 'Coaching Agreement', confidentiality: 'Confidentiality', safety: 'Safety & Emergency' };
const STATUS = { sent: 'Link sent', in_progress: 'Signing', complete: 'All signed', revoked: 'Revoked' };

/**
 * Send a new private-coaching client her three forms: the link is created here and emailed by
 * the site (join-notify); the mentor can also copy it or send it from her own mailbox.
 */
export const IntakeModal = ({ prefill = {}, onClose, onCreated }) => {
  const { program } = useAcademy();
  const [form, setForm] = useState({ email: prefill.email || '', full_name: prefill.full_name || '', days: 30 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const { data, error: err } = await write(supabase.from('coaching_intakes').insert({
      email: form.email.trim().toLowerCase(), full_name: form.full_name.trim() || null, program_id: program?.id || null,
      inquiry_id: prefill.inquiry_id || null, expires_at: daysFromNow(Number(form.days)),
    }).select('token').single());
    setBusy(false);
    if (err) return setError(/does not exist|schema cache/.test(err) ? 'Run storefront_v47_coaching_forms.sql first (Systems → Health).' : err);
    setLink(`${window.location.origin}/coaching/forms/${data.token}`);
    // The site emails her the link on its own; this just hurries it along.
    supabase.functions.invoke('join-notify', { body: {} }).catch(() => {});
    onCreated?.();
  };
  const copy = async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const mailto = `mailto:${encodeURIComponent(form.email)}?subject=${encodeURIComponent('Your P31 coaching agreements')}&body=${encodeURIComponent(
    `Hi ${form.full_name.split(' ')[0] || 'there'},\n\nIt was a joy speaking with you. Before we begin, here is your private link to the three forms we go over with every client, signed in order: the Business Coaching Agreement, the Confidentiality Agreement, and the Client Safety & Emergency Contact form.\n\n${link}\n\nEach takes a few minutes; you can come back to the same link to finish later. You'll receive a PDF copy of each one once it's signed.\n\nQuestions? Reply here or email ${CONTACT_EMAIL}.\n\nWith love,\nThe Proverbs 31 Collective`)}`;

  return (
    <Modal title="Send the three agreements" onClose={onClose}>
      {link ? (
        <div className="ds-form">
          <p>Her private link is ready and has been emailed to <strong>{form.email}</strong>. It works for {form.days} days and she can return to it until all three are signed.</p>
          <div className="ds-row"><Link2 size={18} /><div><strong style={{ fontSize: '0.85rem', overflowWrap: 'anywhere' }}>{link}</strong></div></div>
          <div className="k-actions">
            <button className="k-btn k-btn--plum" onClick={copy}>{copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy link</>}</button>
            <a className="k-btn k-btn--gold" href={mailto}><Mail size={16} /> Email it from my mailbox too</a>
          </div>
          <p className="ds-muted">Each signed form is emailed to the team and ceo@p31market.com, with a PDF copy to her. Progress shows under Agreements.</p>
        </div>
      ) : (
        <form className="ds-form" onSubmit={create}>
          <p className="ds-muted">In this order: the Business Coaching Agreement (she picks her package there), the Confidentiality Agreement, then the Client Safety &amp; Emergency Contact form. The page shows package prices only to the person with the link.</p>
          <div className="k-row">
            <label className="k-field"><span>Her email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="k-field"><span>Her name</span><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
          </div>
          <label className="k-field"><span>Link valid for</span>
            <select value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })}>{[7, 14, 30, 60].map((d) => <option key={d} value={d}>{d} days</option>)}</select>
          </label>
          {error && <p className="k-error">{error}</p>}
          <button className="k-btn k-btn--gold" disabled={busy}><Send size={16} /> {busy ? 'Creating…' : 'Create and email the link'}</button>
        </form>
      )}
    </Modal>
  );
};

/** Mentor console → Agreements: who has been sent the forms, what each has signed, and the signed copies. */
export const MentorAgreements = () => {
  const { program } = useAcademy();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(null);
  const intakes = useRows(() => supabase.from('coaching_intakes').select('*').order('created_at', { ascending: false }).limit(200), []);
  const forms = useRows(() => supabase.from('coaching_forms').select('id, intake_id, kind, full_name, package, answers, signature, signed_name, signed_on, created_at').order('created_at', { ascending: false }).limit(600), []);
  const plans = useRows(() => supabase.from('academy_plans').select('id, program_id, package, price_cents, is_active').not('package', 'is', null), []);
  const prices = Object.fromEntries(plans.data.map((p) => [p.package, p.price_cents]));
  const [payLink, setPayLink] = useState(null);
  // The enrollment link for the package she chose: the same private, single-use checkout as Invites.
  const sendPayment = async (i, pkg) => {
    const plan = plans.data.find((p) => p.package === pkg && p.is_active && p.price_cents);
    if (!plan) return window.alert(`No active plan for ${pkg} yet. Check its price in Systems → Academy.`);
    const { data, error } = await write(supabase.from('academy_invites').insert({
      program_id: plan.program_id, plan_id: plan.id, email: i.email, full_name: i.full_name || null, inquiry_id: i.inquiry_id || null, expires_at: daysFromNow(14),
    }).select('token').single());
    if (error) return window.alert(error);
    setPayLink({ intake: i, pkg, link: `${window.location.origin}/enroll/${data.token}` });
  };
  const byIntake = forms.data.reduce((m, f) => ({ ...m, [f.intake_id]: { ...(m[f.intake_id] || {}), [f.kind]: f } }), {});
  const missing = intakes.error && /does not exist|schema cache/.test(intakes.error);
  const revoke = async (i) => { if (window.confirm(`Revoke ${i.full_name || i.email}'s link? She will need a new one.`)) { await write(supabase.from('coaching_intakes').update({ status: 'revoked' }).eq('id', i.id)); intakes.reload(); } };
  const renew = async (i) => { await write(supabase.from('coaching_intakes').update({ status: i.status === 'revoked' ? 'sent' : i.status, expires_at: daysFromNow(30) }).eq('id', i.id)); intakes.reload(); };
  const remove = async (i) => { if (window.confirm(`Delete ${i.full_name || i.email} and every form she signed? This cannot be undone.`)) { await write(supabase.from('coaching_intakes').delete().eq('id', i.id)); intakes.reload(); forms.reload(); } };

  return (
    <>
      <DashHead eyebrow={`${program.title} · Mentor`} title="Coaching" accent="agreements" lead="The three forms every private-coaching client signs, in order: the Business Coaching Agreement, the Confidentiality Agreement, then Client Safety & Emergency Contact. Send the link after the intro call; each signed form is emailed to the team with a PDF copy to her."
        actions={<button className="k-btn k-btn--gold" onClick={() => setOpen(true)}><FileCheck2 size={16} /> Send the agreements</button>} />
      {missing && <p className="k-error">Run storefront_v47_coaching_forms.sql (Systems → Health) to switch this on.</p>}
      {intakes.data.length ? (
        <div className="ds-grid ds-grid--2">
          {intakes.data.map((i) => {
            const done = byIntake[i.id] || {};
            const expired = new Date(i.expires_at) < new Date();
            return (
              <article key={i.id} className="ds-card">
                <div className="ds-card__head"><h3>{i.full_name || i.email}</h3><span className={`ds-pill ${i.status === 'complete' ? 'ds-pill--green' : i.status === 'revoked' || expired ? 'ds-pill--red' : 'ds-pill--gold'}`}>{expired && i.status !== 'complete' ? 'Link expired' : STATUS[i.status] || i.status}</span></div>
                <p className="ds-muted">{i.email} · sent {fmtDateTime(i.created_at)}{i.notified_at ? '' : ' · email on its way'}</p>
                <ul className="ds-list">
                  {ORDER.map((k, n) => {
                    const f = done[k];
                    return (
                      <li key={k} className="ds-row">
                        <span className={`ds-pill ${f ? 'ds-pill--green' : ''}`}>{f ? <Check size={12} /> : n + 1}</span>
                        <div><strong>{LABEL[k]}</strong><small>{f ? `Signed ${fmtDate(f.signed_on)} as ${f.signed_name}${f.package ? ` · ${f.package}: ${packagePrice(f.package, prices)}` : ''}` : 'Not signed yet'}</small></div>
                        {f && <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => setView({ ...f, intake: i })}><Eye size={14} /> View</button>}
                      </li>
                    );
                  })}
                </ul>
                <div className="k-actions">
                  {i.status === 'complete' && done.coaching?.package && <button type="button" className="k-btn k-btn--gold k-btn--sm" onClick={() => sendPayment(i, done.coaching.package)}><CreditCard size={14} /> Send payment link ({done.coaching.package})</button>}
                  <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/coaching/forms/${i.token}`)}><Copy size={14} /> Copy her forms link</button>
                  {(expired || i.status === 'revoked') && <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => renew(i)}><RotateCcw size={14} /> Renew for 30 days</button>}
                  {i.status !== 'revoked' && i.status !== 'complete' && !expired && <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => revoke(i)}>Revoke link</button>}
                  <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => remove(i)}><Trash2 size={14} /> Delete</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : !missing && <DashEmpty Icon={FileCheck2} title="No one has been sent the agreements yet">After an intro call, send the three forms from here or from the intro-call card.</DashEmpty>}
      {open && <IntakeModal onClose={() => setOpen(false)} onCreated={intakes.reload} />}
      {payLink && (
        <Modal title={`Payment link: ${payLink.intake.full_name || payLink.intake.email}`} onClose={() => setPayLink(null)}>
          <div className="ds-form">
            <p>Her private checkout for <strong>{payLink.pkg}</strong> ({packagePrice(payLink.pkg, prices)}) is ready. It works once, for <strong>{payLink.intake.email}</strong>, for 14 days. She creates her account with that email, enters her card on Stripe, and her classroom opens.</p>
            <div className="ds-row"><Link2 size={18} /><div><strong style={{ fontSize: '0.85rem', overflowWrap: 'anywhere' }}>{payLink.link}</strong></div></div>
            <div className="k-actions">
              <button type="button" className="k-btn k-btn--plum" onClick={() => navigator.clipboard.writeText(payLink.link)}><Copy size={16} /> Copy link</button>
              <a className="k-btn k-btn--gold" href={`mailto:${encodeURIComponent(payLink.intake.email)}?subject=${encodeURIComponent('Your P31 coaching enrollment link')}&body=${encodeURIComponent(`Hi ${(payLink.intake.full_name || '').split(' ')[0] || 'there'},

Thank you for signing your agreements. Here is your private link to start your coaching package (${payLink.pkg}):

${payLink.link}

Create your account with this email address (${payLink.intake.email}) and you'll be guided through checkout. Your classroom opens right after.

Questions? Reply here or email ${CONTACT_EMAIL}.

With love,
The Proverbs 31 Collective`)}`}><Mail size={16} /> Email it</a>
            </div>
          </div>
        </Modal>
      )}
      {view && (
        <Modal title={`${LABEL[view.kind]}: ${view.full_name}`} onClose={() => setView(null)}>
          <div className="ds-form">
            <p><b>Signed as</b> {view.signed_name} on {fmtDate(view.signed_on)} · {view.intake.email}</p>
            {view.package && <p><b>Package:</b> {view.package} — {PACKAGES.find((p) => p.key === view.package)?.name} ({packagePrice(view.package, prices)})</p>}
            {view.kind === 'safety' && (
              <ul className="ds-list">
                <li className="ds-row"><div><strong>Emergency contact</strong><small>{view.answers?.emergency_contact}</small></div></li>
                <li className="ds-row"><div><strong>Residential address</strong><small>{view.answers?.address}</small></div></li>
                <li className="ds-row"><div><strong>Best contact number</strong><small>{view.answers?.phone}</small></div></li>
                <li className="ds-row"><div><strong>Date of birth</strong><small>{view.answers?.date_of_birth ? fmtDate(view.answers.date_of_birth) : ''}</small></div></li>
              </ul>
            )}
            {view.signature ? <img src={view.signature} alt="Signature" style={{ maxWidth: 320, background: '#fff', borderRadius: 10, border: '1px solid #ddd' }} /> : <p className="ds-muted">Typed signature only.</p>}
            <p className="ds-muted">The full signed agreement was emailed as a PDF to her and to the team when she signed.</p>
          </div>
        </Modal>
      )}
    </>
  );
};
