import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Users, PhoneCall, MessageCircle, FileCheck2, CalendarDays, Plus, Send, Copy, Check, Trash2, Mail, Phone, BookOpen,
  Upload, Download, Eye, EyeOff, ArrowUp, ArrowDown, Pencil, Megaphone, Pin, Link2, X, ClipboardCheck, Search, ArrowLeft, Video,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { money, BILLING, fmtDate, fmtDateTime, fileSize, openFile, uploadAcademyFile, CONTACT_EMAIL } from '../../lib/academy';
import { DashHead, DashEmpty } from '../../apps/DashShell';
import RichText from '../RichText';
import Thread from './Thread';
import { useAcademy, useNow, useRows, write } from './data';

// ── Small building blocks ────────────────────────────────────
const Modal = ({ title, onClose, children }) => (
  <div className="ds-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}>
    <div className="ds-modal__panel">
      <button className="k-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
      <h2>{title}</h2>
      {children}
    </div>
  </div>
);
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
const daysFromNow = (d) => new Date(Date.now() + d * 86400e3).toISOString();
const useRoster = (program) => useRows(() => supabase.rpc('academy_roster', { p_program: program.id }), [program.id]);
const STATUS_PILL = { active: 'ds-pill--green', past_due: 'ds-pill--red', canceled: '', expired: '' };

// ── Overview ─────────────────────────────────────────────────
export const MentorOverview = () => {
  const { program } = useAcademy();
  const roster = useRoster(program);
  const calls = useRows(() => supabase.from('academy_inquiries').select('*').eq('program_id', program.id).order('created_at', { ascending: false }).limit(50), [program.id]);
  const review = useRows(() => supabase.rpc('academy_awaiting_review', { p_program: program.id }), [program.id], { initial: 0 });
  const sessions = useRows(() => supabase.from('academy_sessions').select('*').eq('program_id', program.id).gte('starts_at', new Date(Date.now() - 3600e3).toISOString()).order('starts_at').limit(6), [program.id]);
  const active = roster.data.filter((r) => r.status === 'active').length;
  const unread = roster.data.reduce((n, r) => n + (r.unread || 0), 0);
  const newCalls = calls.data.filter((c) => c.status === 'new');
  const who = (id) => roster.data.find((r) => r.user_id === id)?.full_name;

  return (
    <>
      <DashHead eyebrow={`${program.title} · Mentor`} title="Your" accent="classroom" lead="Students, intro calls and everything you’ve shared — at a glance." />
      <div className="ds-grid ds-grid--4">
        <Link to="students" className="ds-stat"><strong>{active}</strong><span>Active students</span></Link>
        <Link to="calls" className="ds-stat"><strong>{newCalls.length}</strong><span>New intro-call requests</span></Link>
        <Link to="students" className="ds-stat"><strong>{unread}</strong><span>Unread messages</span></Link>
        <Link to="students" className="ds-stat"><strong>{review.data || 0}</strong><span>Waiting for your feedback</span></Link>
      </div>
      <div className="ds-grid ds-grid--2 ds-section">
        <article className="ds-card">
          <div className="ds-card__head"><h2><CalendarDays size={18} /> Coming up</h2><Link to="sessions" className="k-link">Sessions</Link></div>
          {sessions.data.length ? (
            <ul className="ds-list">{sessions.data.map((s) => (
              <li key={s.id} className="ds-row"><Video size={18} /><div><strong>{s.title}</strong><small>{fmtDateTime(s.starts_at)}{s.student_id ? ` · 1:1 with ${who(s.student_id) || 'a student'}` : ' · group'}</small></div></li>
            ))}</ul>
          ) : <p className="ds-muted">Nothing scheduled.</p>}
        </article>
        <article className="ds-card">
          <div className="ds-card__head"><h2><PhoneCall size={18} /> New intro calls</h2><Link to="calls" className="k-link">All requests</Link></div>
          {newCalls.length ? (
            <ul className="ds-list">{newCalls.slice(0, 5).map((c) => (
              <li key={c.id} className="ds-row"><PhoneCall size={18} /><div><strong>{c.full_name}</strong><small>{c.preferred_times || 'No times given'} · {fmtDate(c.created_at)}</small></div></li>
            ))}</ul>
          ) : <p className="ds-muted">No new requests. Share {window.location.origin}/mentorship/{program.slug} to invite people.</p>}
        </article>
      </div>
    </>
  );
};

// ── Invite modal (used from intro calls and the invites page) ─
const InviteModal = ({ prefill = {}, onClose, onCreated }) => {
  const { program } = useAcademy();
  const plans = useRows(() => supabase.from('academy_plans').select('*').eq('program_id', program.id), [program.id]);
  const order = ['month', 'week', 'six_months', 'one_time'];
  const sorted = [...plans.data].sort((a, b) => order.indexOf(a.billing) - order.indexOf(b.billing));
  const [form, setForm] = useState({ email: prefill.email || '', full_name: prefill.full_name || '', plan_id: '', days: 14 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const planId = form.plan_id || sorted.find((p) => p.is_active && p.price_cents)?.id || '';

  const create = async (e) => {
    e.preventDefault();
    if (!planId) return setError('No priced plan is available yet — an admin sets prices in Systems → Academy.');
    setBusy(true); setError('');
    const { data, error: err } = await write(supabase.from('academy_invites').insert({
      program_id: program.id, plan_id: planId, email: form.email.trim().toLowerCase(), full_name: form.full_name.trim() || null,
      inquiry_id: prefill.inquiry_id || null, expires_at: daysFromNow(Number(form.days)),
    }).select('token').single());
    setBusy(false);
    if (err) return setError(err);
    if (prefill.inquiry_id) await supabase.from('academy_inquiries').update({ status: 'scheduled', updated_at: new Date().toISOString() }).eq('id', prefill.inquiry_id).eq('status', 'new');
    setLink(`${window.location.origin}/enroll/${data.token}`);
    onCreated?.();
  };
  const copy = async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const mailto = `mailto:${encodeURIComponent(form.email)}?subject=${encodeURIComponent(`Your ${program.title} enrollment link`)}&body=${encodeURIComponent(
    `Hi ${form.full_name.split(' ')[0] || 'there'},\n\nIt was a joy speaking with you. Here is your private link to enroll in the ${program.title}:\n\n${link}\n\nCreate your account with this email address (${form.email}) and you’ll be guided through checkout. Your classroom opens right after.\n\nQuestions? Reply here or email ${CONTACT_EMAIL}.\n\nWith love,\nThe Proverbs 31 Collective`)}`;

  return (
    <Modal title="Send an enrollment invite" onClose={onClose}>
      {link ? (
        <div className="ds-form">
          <p>Your private link is ready. It works once, for <strong>{form.email}</strong>, for {form.days} days.</p>
          <div className="ds-row"><Link2 size={18} /><div><strong style={{ fontSize: '0.85rem' }}>{link}</strong></div></div>
          <div className="k-actions">
            <button className="k-btn k-btn--plum" onClick={copy}>{copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy link</>}</button>
            <a className="k-btn k-btn--gold" href={mailto}><Mail size={16} /> Email it</a>
          </div>
        </div>
      ) : (
        <form className="ds-form" onSubmit={create}>
          <div className="k-row">
            <label className="k-field"><span>Their email</span><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="k-field"><span>Their name</span><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
          </div>
          <div className="k-field"><span>Plan</span>
            <div className="ds-list">
              {sorted.map((p) => {
                const ok = p.is_active && p.price_cents;
                return (
                  <label key={p.id} className="ds-row" style={{ opacity: ok ? 1 : 0.55, cursor: ok ? 'pointer' : 'not-allowed' }}>
                    <input type="radio" name="plan" disabled={!ok} checked={planId === p.id} onChange={() => setForm({ ...form, plan_id: p.id })} />
                    <div><strong>{p.label}</strong><small>{ok ? `${money(p.price_cents)}${BILLING[p.billing]?.per ? ` / ${BILLING[p.billing].per}` : p.access_days ? ` · ${p.access_days} days of access` : ''}` : 'Not priced yet'}</small></div>
                  </label>
                );
              })}
            </div>
          </div>
          <label className="k-field"><span>Link valid for</span>
            <select value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })}>{[3, 7, 14, 30].map((d) => <option key={d} value={d}>{d} days</option>)}</select>
          </label>
          {error && <p className="k-error">{error}</p>}
          <button className="k-btn k-btn--gold" disabled={busy}><Send size={16} /> {busy ? 'Creating…' : 'Create private link'}</button>
          <p className="ds-muted">Prices stay private — only the person with this link sees theirs.</p>
        </form>
      )}
    </Modal>
  );
};

// ── Intro calls ──────────────────────────────────────────────
const CALL_STATUS = [['new', 'New'], ['scheduled', 'Scheduled'], ['enrolled', 'Enrolled'], ['not_a_fit', 'Not a fit'], ['closed', 'Closed']];
export const MentorCalls = () => {
  const { program } = useAcademy();
  const [filter, setFilter] = useState('open');
  const [invite, setInvite] = useState(null);
  const calls = useRows(() => supabase.from('academy_inquiries').select('*').eq('program_id', program.id).order('created_at', { ascending: false }).limit(300), [program.id]);
  const shown = calls.data.filter((c) => filter === 'all' || (filter === 'open' ? ['new', 'scheduled'].includes(c.status) : c.status === filter));
  const update = async (c, patch) => { await write(supabase.from('academy_inquiries').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', c.id)); calls.reload(); };

  return (
    <>
      <DashHead eyebrow={`${program.title} · Mentor`} title="Intro" accent="calls" lead="Requests from the mentorship page. Reach out, meet, then send a private enrollment link." />
      <div className="ds-tabs-inline" role="tablist">
        {[['open', 'Open'], ...CALL_STATUS, ['all', 'All']].map(([v, l]) => (
          <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}>{l}{v === 'new' ? ` (${calls.data.filter((c) => c.status === 'new').length})` : ''}</button>
        ))}
      </div>
      {shown.length ? (
        <div className="ds-grid ds-grid--2">
          {shown.map((c) => (
            <article key={c.id} className="ds-card">
              <div className="ds-card__head"><h3>{c.full_name}</h3><span className={`ds-pill ${c.status === 'new' ? 'ds-pill--gold' : c.status === 'enrolled' ? 'ds-pill--green' : ''}`}>{CALL_STATUS.find(([v]) => v === c.status)?.[1]}</span></div>
              <p className="ds-muted">{fmtDateTime(c.created_at)}</p>
              <div className="k-actions">
                <a className="k-btn k-btn--sm k-btn--ghost" href={`mailto:${c.email}?subject=${encodeURIComponent(`Your intro call — ${program.title}`)}`}><Mail size={15} /> {c.email}</a>
                {c.phone && <a className="k-btn k-btn--sm k-btn--ghost" href={`tel:${c.phone}`}><Phone size={15} /> {c.phone}</a>}
              </div>
              {c.preferred_times && <p><strong>Best times:</strong> {c.preferred_times}</p>}
              {c.message && <p style={{ whiteSpace: 'pre-wrap' }}>{c.message}</p>}
              <label className="k-field"><span>Status</span>
                <select value={c.status} onChange={(e) => update(c, { status: e.target.value })}>{CALL_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
              <label className="k-field"><span>Private notes</span>
                <textarea rows={2} defaultValue={c.notes || ''} onBlur={(e) => e.target.value !== (c.notes || '') && update(c, { notes: e.target.value })} />
              </label>
              {c.status !== 'enrolled' && <button className="k-btn k-btn--gold k-btn--sm" style={{ justifySelf: 'start' }} onClick={() => setInvite({ email: c.email, full_name: c.full_name, inquiry_id: c.id })}><Send size={15} /> Send enrollment invite</button>}
            </article>
          ))}
        </div>
      ) : <DashEmpty Icon={PhoneCall} title="No requests here">New intro-call requests from {window.location.host}/mentorship/{program.slug} show up here.</DashEmpty>}
      {invite && <InviteModal prefill={invite} onClose={() => setInvite(null)} onCreated={calls.reload} />}
    </>
  );
};

// ── Invites ──────────────────────────────────────────────────
export const MentorInvites = () => {
  const { program } = useAcademy();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const invites = useRows(() => supabase.from('academy_invites').select('*, plan:academy_plans(label, billing, price_cents)').eq('program_id', program.id).order('created_at', { ascending: false }), [program.id]);
  const copy = async (inv) => { await navigator.clipboard.writeText(`${window.location.origin}/enroll/${inv.token}`); setCopied(inv.id); setTimeout(() => setCopied(''), 1500); };
  const revoke = async (inv) => { if (window.confirm('Revoke this link?')) { await write(supabase.from('academy_invites').delete().eq('id', inv.id)); invites.reload(); } };
  const state = (inv) => (inv.used_at ? ['Used', 'ds-pill--green'] : new Date(inv.expires_at) < new Date() ? ['Expired', ''] : ['Waiting', 'ds-pill--gold']);
  return (
    <>
      <DashHead eyebrow={`${program.title} · Mentor`} title="Enrollment" accent="invites" lead="Private, single-use links. Each one shows its price only to the person it was sent to."
        actions={<button className="k-btn k-btn--gold" onClick={() => setOpen(true)}><Plus size={16} /> New invite</button>} />
      {invites.data.length ? (
        <ul className="ds-list">
          {invites.data.map((inv) => {
            const [label, cls] = state(inv);
            return (
              <li key={inv.id} className="ds-row">
                <Send size={18} />
                <div><strong>{inv.full_name || inv.email}</strong><small>{inv.email} · {inv.plan?.label} {inv.plan?.price_cents ? `(${money(inv.plan.price_cents)})` : ''} · sent {fmtDate(inv.created_at)}</small></div>
                <span className={`ds-pill ${cls}`}>{label}</span>
                {!inv.used_at && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => copy(inv)}>{copied === inv.id ? <Check size={15} /> : <Copy size={15} />}</button>}
                {!inv.used_at && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => revoke(inv)} aria-label="Revoke"><Trash2 size={15} /></button>}
              </li>
            );
          })}
        </ul>
      ) : <DashEmpty Icon={Send} title="No invites yet">After an intro call, send a private enrollment link from here or from the intro-call card.</DashEmpty>}
      {open && <InviteModal onClose={() => setOpen(false)} onCreated={invites.reload} />}
    </>
  );
};

// ── Students ─────────────────────────────────────────────────
export const MentorStudents = () => {
  const { program } = useAcademy();
  const roster = useRoster(program);
  const lessons = useRows(() => supabase.from('academy_lessons').select('id', { count: 'exact', head: false }).eq('program_id', program.id).eq('is_published', true), [program.id]);
  const [q, setQ] = useState('');
  const shown = roster.data.filter((r) => !q || `${r.full_name} ${r.email}`.toLowerCase().includes(q.toLowerCase()));
  const total = lessons.data.length;
  return (
    <>
      <DashHead eyebrow={`${program.title} · Mentor`} title="Your" accent="students" lead={`${roster.data.filter((r) => r.status === 'active').length} active · ${roster.data.length} total`} />
      <label className="k-search" style={{ maxWidth: 420, marginBottom: 14, height: 50, boxShadow: 'none', border: '1px solid var(--line)' }}>
        <Search size={18} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students" aria-label="Search students" />
      </label>
      {roster.error && <p className="k-error">{roster.error}</p>}
      {shown.length ? (
        <ul className="ds-list">
          {shown.map((r) => (
            <li key={r.user_id}>
              <Link to={r.user_id} className="ds-row">
                <Users size={18} />
                <div><strong>{r.full_name}</strong><small>{r.email} · {r.plan_label || r.source} · since {fmtDate(r.started_at)}{total ? ` · ${r.lessons_done}/${total} lessons` : ''}</small></div>
                {r.unread > 0 && <span className="ds-badge">{r.unread}</span>}
                <span className={`ds-pill ${STATUS_PILL[r.status] || ''}`}>{r.status.replace('_', ' ')}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : <DashEmpty Icon={Users} title="No students yet">Students appear here as soon as they complete their enrollment link.</DashEmpty>}
    </>
  );
};

const PlanModal = ({ student, onClose, onSaved }) => {
  const { program } = useAcademy();
  const [form, setForm] = useState({ title: `Action plan — ${fmtDate(new Date().toISOString(), { month: 'long', day: 'numeric' })}`, summary: '' });
  const [items, setItems] = useState([{ text: '', due: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (e) => {
    e.preventDefault();
    const list = items.filter((i) => i.text.trim());
    if (!list.length) return setError('Add at least one next step.');
    setBusy(true); setError('');
    const { data: plan, error: err } = await write(supabase.from('academy_action_plans').insert({ program_id: program.id, student_id: student, title: form.title.trim(), summary: form.summary.trim() || null }).select('id').single());
    if (err) { setBusy(false); return setError(err); }
    const { error: err2 } = await write(supabase.from('academy_action_items').insert(list.map((i, n) => ({ plan_id: plan.id, program_id: program.id, student_id: student, text: i.text.trim(), due_date: i.due || null, position: n }))));
    setBusy(false);
    if (err2) return setError(err2);
    onSaved(); onClose();
  };
  return (
    <Modal title="New action plan" onClose={onClose}>
      <form className="ds-form" onSubmit={save}>
        <label className="k-field"><span>Title</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label className="k-field"><span>Session summary (optional)</span><textarea rows={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></label>
        <div className="k-field"><span>Next steps</span>
          {items.map((it, i) => (
            <div key={i} className="k-row" style={{ gridTemplateColumns: '1fr 160px auto', alignItems: 'center' }}>
              <input value={it.text} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} placeholder={`Step ${i + 1}`} />
              <input type="date" value={it.due} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)))} aria-label="Due date" />
              <button type="button" className="k-btn k-btn--icon k-btn--ghost" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove step"><X size={16} /></button>
            </div>
          ))}
          <button type="button" className="k-btn k-btn--sm k-btn--ghost" style={{ justifySelf: 'start' }} onClick={() => setItems([...items, { text: '', due: '' }])}><Plus size={15} /> Add step</button>
        </div>
        {error && <p className="k-error">{error}</p>}
        <button className="k-btn k-btn--gold" disabled={busy}>{busy ? 'Saving…' : 'Share with student'}</button>
      </form>
    </Modal>
  );
};

export const SessionModal = ({ session, studentId, onClose, onSaved }) => {
  const { program } = useAcademy();
  const [form, setForm] = useState({
    title: session?.title || (studentId ? '1:1 Mentorship Session' : ''), description: session?.description || '',
    starts_at: toLocalInput(session?.starts_at), duration_minutes: session?.duration_minutes || 60,
    join_url: session?.join_url || '', recording_url: session?.recording_url || '', notes: session?.notes || '',
  });
  const [error, setError] = useState('');
  const save = async (e) => {
    e.preventDefault();
    const row = { ...form, starts_at: fromLocalInput(form.starts_at), duration_minutes: Number(form.duration_minutes), program_id: program.id,
      student_id: session ? session.student_id : studentId || null, join_url: form.join_url || null, recording_url: form.recording_url || null };
    const { error: err } = await write(session ? supabase.from('academy_sessions').update(row).eq('id', session.id) : supabase.from('academy_sessions').insert(row));
    if (err) return setError(err);
    onSaved(); onClose();
  };
  const remove = async () => { if (window.confirm('Delete this session?')) { await write(supabase.from('academy_sessions').delete().eq('id', session.id)); onSaved(); onClose(); } };
  return (
    <Modal title={session ? 'Edit session' : studentId ? 'Schedule a 1:1 session' : 'Schedule a group session'} onClose={onClose}>
      <form className="ds-form" onSubmit={save}>
        <label className="k-field"><span>Title</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <div className="k-row">
          <label className="k-field"><span>Starts</span><input required type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></label>
          <label className="k-field"><span>Length (minutes)</span><input type="number" min="5" max="600" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></label>
        </div>
        <label className="k-field"><span>Join link (Zoom, Google Meet…)</span><input type="url" value={form.join_url} onChange={(e) => setForm({ ...form, join_url: e.target.value })} placeholder="https://" /></label>
        <label className="k-field"><span>Description (optional)</span><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        {session && <label className="k-field"><span>Session notes (visible to the student)</span><textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>}
        {session && <label className="k-field"><span>Recording link (optional)</span><input type="url" value={form.recording_url} onChange={(e) => setForm({ ...form, recording_url: e.target.value })} /></label>}
        {error && <p className="k-error">{error}</p>}
        <div className="k-actions">
          <button className="k-btn k-btn--gold">{session ? 'Save' : 'Schedule'}</button>
          {session && <button type="button" className="k-btn k-btn--ghost" onClick={remove}><Trash2 size={15} /> Delete</button>}
        </div>
      </form>
    </Modal>
  );
};

export const MentorStudent = () => {
  const { userId } = useParams();
  const { program, user } = useAcademy();
  const roster = useRoster(program);
  const s = roster.data.find((r) => r.user_id === userId);
  const [tab, setTab] = useState('messages');
  const [modal, setModal] = useState(null);
  const plans = useRows(() => supabase.from('academy_action_plans').select('*, items:academy_action_items(*)').eq('program_id', program.id).eq('student_id', userId).order('created_at', { ascending: false }), [program.id, userId]);
  const sessions = useRows(() => supabase.from('academy_sessions').select('*').eq('program_id', program.id).eq('student_id', userId).order('starts_at', { ascending: false }), [program.id, userId]);
  const subs = useRows(() => supabase.from('academy_submissions').select('*').eq('program_id', program.id).eq('student_id', userId).order('created_at', { ascending: false }), [program.id, userId]);
  const review = async (sub, feedback) => { await write(supabase.from('academy_submissions').update({ feedback, status: 'reviewed', reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', sub.id)); subs.reload(); };

  return (
    <>
      <Link to=".." relative="path" className="k-link" style={{ marginBottom: 12 }}><ArrowLeft size={16} /> All students</Link>
      <DashHead eyebrow={`${program.title} · Student`} title={s?.full_name || 'Student'}
        lead={s ? `${s.email} · ${s.plan_label || s.source} · ${s.status.replace('_', ' ')}${s.access_until ? ` · access to ${fmtDate(s.access_until)}` : ''}` : ''}
        actions={s && <a className="k-btn k-btn--ghost k-btn--sm" href={`mailto:${s.email}`}><Mail size={15} /> Email</a>} />
      <div className="ds-tabs-inline" role="tablist">
        {[['messages', 'Messages'], ['plans', 'Action plans'], ['sessions', '1:1 sessions'], ['work', `Work${subs.data.some((x) => x.status === 'submitted') ? ' •' : ''}`]].map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>

      {tab === 'messages' && <div style={{ maxWidth: 820 }}><Thread programId={program.id} studentId={userId} meId={user?.id} mentorView emptyText="Start the conversation." /></div>}

      {tab === 'plans' && (
        <>
          <button className="k-btn k-btn--gold k-btn--sm" style={{ marginBottom: 14 }} onClick={() => setModal('plan')}><Plus size={15} /> New action plan</button>
          {plans.data.length ? <div className="ds-grid">{plans.data.map((p) => {
            const items = [...(p.items || [])].sort((a, b) => a.position - b.position);
            return (
              <article key={p.id} className="ds-card">
                <div className="ds-card__head"><h3>{p.title}</h3><span className="ds-pill">{items.filter((i) => i.is_done).length}/{items.length} done</span></div>
                {p.summary && <RichText text={p.summary} />}
                <ul className="ds-list">{items.map((it) => <li key={it.id} className={`ds-row ${it.is_done ? 'is-done' : ''}`}>{it.is_done ? <Check size={18} color="#17A673" /> : <ClipboardCheck size={18} />}<div><strong>{it.text}</strong>{it.due_date && <small>Due {fmtDate(it.due_date)}</small>}</div></li>)}</ul>
                <button className="k-btn k-btn--sm k-btn--ghost" style={{ justifySelf: 'start' }} onClick={async () => { if (window.confirm('Delete this plan?')) { await write(supabase.from('academy_action_plans').delete().eq('id', p.id)); plans.reload(); } }}><Trash2 size={15} /> Delete</button>
              </article>
            );
          })}</div> : <p className="ds-muted">No action plans yet.</p>}
        </>
      )}

      {tab === 'sessions' && (
        <>
          <button className="k-btn k-btn--gold k-btn--sm" style={{ marginBottom: 14 }} onClick={() => setModal('session')}><Plus size={15} /> Schedule 1:1</button>
          {sessions.data.length ? <ul className="ds-list">{sessions.data.map((x) => (
            <li key={x.id}><button className="ds-row" onClick={() => setModal({ session: x })}><CalendarDays size={18} /><div><strong>{x.title}</strong><small>{fmtDateTime(x.starts_at)} · {x.duration_minutes} min{x.notes ? ' · notes added' : ''}</small></div><Pencil size={15} /></button></li>
          ))}</ul> : <p className="ds-muted">No 1:1 sessions scheduled.</p>}
        </>
      )}

      {tab === 'work' && (subs.data.length ? <div className="ds-grid">{subs.data.map((x) => (
        <article key={x.id} className="ds-card">
          <div className="ds-card__head"><h3>{x.title}</h3><span className={`ds-pill ${x.status === 'reviewed' ? 'ds-pill--green' : 'ds-pill--gold'}`}>{x.status === 'reviewed' ? 'Reviewed' : 'Needs review'}</span></div>
          <p className="ds-muted">{fmtDateTime(x.created_at)}</p>
          {x.note && <p>{x.note}</p>}
          <div className="k-actions">
            {x.file_path && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => openFile(x.file_path)}><Download size={15} /> {x.file_name} {fileSize(x.size_bytes)}</button>}
            {x.link_url && <a className="k-btn k-btn--sm k-btn--ghost" href={x.link_url} target="_blank" rel="noopener noreferrer"><Link2 size={15} /> Open link</a>}
          </div>
          <form className="ds-form" onSubmit={(e) => { e.preventDefault(); review(x, new FormData(e.target).get('fb')); }}>
            <label className="k-field"><span>Your feedback</span><textarea name="fb" rows={4} defaultValue={x.feedback || ''} required /></label>
            <button className="k-btn k-btn--plum k-btn--sm" style={{ justifySelf: 'start' }}><Send size={15} /> {x.status === 'reviewed' ? 'Update feedback' : 'Send feedback'}</button>
          </form>
        </article>
      ))}</div> : <p className="ds-muted">Nothing submitted yet.</p>)}

      {modal === 'plan' && <PlanModal student={userId} onClose={() => setModal(null)} onSaved={plans.reload} />}
      {modal === 'session' && <SessionModal studentId={userId} onClose={() => setModal(null)} onSaved={sessions.reload} />}
      {modal?.session && <SessionModal session={modal.session} onClose={() => setModal(null)} onSaved={sessions.reload} />}
    </>
  );
};

// ── Curriculum (modules, lessons, files) ─────────────────────
const LessonModal = ({ lesson, moduleId, onClose, onSaved }) => {
  const { program } = useAcademy();
  const [form, setForm] = useState({ title: lesson?.title || '', body: lesson?.body || '', video_url: lesson?.video_url || '', reflection_prompt: lesson?.reflection_prompt || '', is_published: lesson?.is_published ?? false });
  const [error, setError] = useState('');
  const save = async (e) => {
    e.preventDefault();
    const row = { ...form, video_url: form.video_url || null, reflection_prompt: form.reflection_prompt || null, updated_at: new Date().toISOString() };
    const { error: err } = await write(lesson
      ? supabase.from('academy_lessons').update(row).eq('id', lesson.id)
      : supabase.from('academy_lessons').insert({ ...row, program_id: program.id, module_id: moduleId, position: Date.now() % 1e9 }));
    if (err) return setError(err);
    onSaved(); onClose();
  };
  return (
    <Modal title={lesson ? 'Edit lesson' : 'New lesson'} onClose={onClose}>
      <form className="ds-form" onSubmit={save}>
        <label className="k-field"><span>Title</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label className="k-field"><span>Lesson (# heading, - bullets, **bold**, links)</span><textarea rows={10} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
        <label className="k-field"><span>Video link (YouTube, Vimeo, Loom — optional)</span><input type="url" value={form.video_url} onChange={(e) => setForm({ ...form, video_url: e.target.value })} /></label>
        <label className="k-field"><span>Reflection question (optional)</span><input value={form.reflection_prompt} onChange={(e) => setForm({ ...form, reflection_prompt: e.target.value })} /></label>
        <label className="ds-row" style={{ cursor: 'pointer' }}><input type="checkbox" className="ds-check" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /><div><strong>Published</strong><small>Students can see it</small></div></label>
        {error && <p className="k-error">{error}</p>}
        <button className="k-btn k-btn--gold">Save lesson</button>
      </form>
    </Modal>
  );
};

export const MentorCurriculum = () => {
  const { program } = useAcademy();
  const modules = useRows(() => supabase.from('academy_modules').select('*').eq('program_id', program.id).order('position'), [program.id]);
  const lessons = useRows(() => supabase.from('academy_lessons').select('*').eq('program_id', program.id).order('position'), [program.id]);
  const files = useRows(() => supabase.from('academy_resources').select('*').eq('program_id', program.id).order('created_at', { ascending: false }), [program.id]);
  const [modal, setModal] = useState(null);
  const [newModule, setNewModule] = useState('');
  const [upload, setUpload] = useState({ title: '', lesson_id: '', file: null, busy: false, error: '' });

  const addModule = async (e) => {
    e.preventDefault();
    if (!newModule.trim()) return;
    await write(supabase.from('academy_modules').insert({ program_id: program.id, title: newModule.trim(), position: modules.data.length }));
    setNewModule(''); modules.reload();
  };
  const patchModule = async (m, patch) => { await write(supabase.from('academy_modules').update(patch).eq('id', m.id)); modules.reload(); };
  const moveModule = async (i, d) => {
    const a = modules.data[i]; const b = modules.data[i + d];
    if (!a || !b) return;
    await Promise.all([write(supabase.from('academy_modules').update({ position: b.position }).eq('id', a.id)), write(supabase.from('academy_modules').update({ position: a.position }).eq('id', b.id))]);
    modules.reload();
  };
  const removeModule = async (m) => { if (window.confirm(`Delete “${m.title}” and its lessons?`)) { await write(supabase.from('academy_modules').delete().eq('id', m.id)); modules.reload(); lessons.reload(); } };
  const moveLesson = async (ls, i, d) => {
    const a = ls[i]; const b = ls[i + d];
    if (!a || !b) return;
    await Promise.all([write(supabase.from('academy_lessons').update({ position: b.position }).eq('id', a.id)), write(supabase.from('academy_lessons').update({ position: a.position }).eq('id', b.id))]);
    lessons.reload();
  };
  const togglePublish = async (l) => { await write(supabase.from('academy_lessons').update({ is_published: !l.is_published }).eq('id', l.id)); lessons.reload(); };
  const removeLesson = async (l) => { if (window.confirm(`Delete “${l.title}”?`)) { await write(supabase.from('academy_lessons').delete().eq('id', l.id)); lessons.reload(); } };

  const doUpload = async (e) => {
    e.preventDefault();
    if (!upload.file) return setUpload({ ...upload, error: 'Choose a file.' });
    setUpload({ ...upload, busy: true, error: '' });
    try {
      const meta = await uploadAcademyFile(program.slug, 'files', upload.file);
      const { error } = await write(supabase.from('academy_resources').insert({ program_id: program.id, lesson_id: upload.lesson_id || null, title: upload.title.trim() || upload.file.name.replace(/\.[^.]+$/, ''), ...meta }));
      if (error) throw new Error(error);
      setUpload({ title: '', lesson_id: '', file: null, busy: false, error: '' }); e.target.reset(); files.reload();
    } catch (err) { setUpload((u) => ({ ...u, busy: false, error: err.message })); }
  };
  const removeFile = async (f) => { if (window.confirm(`Remove “${f.title}”?`)) { await supabase.storage.from('academy').remove([f.file_path]); await write(supabase.from('academy_resources').delete().eq('id', f.id)); files.reload(); } };

  return (
    <>
      <DashHead eyebrow={`${program.title} · Mentor`} title="Curriculum &" accent="library" lead="Build modules and lessons, attach downloads, and publish when ready." />
      <form className="ds-card ds-form" onSubmit={addModule} style={{ marginBottom: 14 }}>
        <div className="k-row" style={{ gridTemplateColumns: '1fr auto', alignItems: 'end' }}>
          <label className="k-field"><span>New module</span><input value={newModule} onChange={(e) => setNewModule(e.target.value)} placeholder="e.g. Clarifying your vision" /></label>
          <button className="k-btn k-btn--plum"><Plus size={16} /> Add module</button>
        </div>
      </form>
      {modules.data.length ? (
        <div className="ds-grid">
          {modules.data.map((m, i) => {
            const ls = lessons.data.filter((l) => l.module_id === m.id);
            return (
              <section key={m.id} className="ds-card">
                <div className="ds-card__head">
                  <h2><span className="k-num">0{i + 1}</span> {m.title}</h2>
                  <div className="k-actions">
                    <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => moveModule(i, -1)} aria-label="Move up"><ArrowUp size={15} /></button>
                    <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => moveModule(i, 1)} aria-label="Move down"><ArrowDown size={15} /></button>
                    <button className={`k-btn k-btn--sm ${m.is_published ? 'k-btn--ghost' : 'k-btn--gold'}`} onClick={() => patchModule(m, { is_published: !m.is_published })}>{m.is_published ? <><Eye size={15} /> Published</> : <><EyeOff size={15} /> Publish</>}</button>
                    <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => removeModule(m)} aria-label="Delete module"><Trash2 size={15} /></button>
                  </div>
                </div>
                <input className="k-input" defaultValue={m.summary || ''} placeholder="Module summary (optional)" onBlur={(e) => e.target.value !== (m.summary || '') && patchModule(m, { summary: e.target.value })} />
                <ul className="ds-list">
                  {ls.map((l, j) => (
                    <li key={l.id} className="ds-row">
                      <BookOpen size={18} />
                      <div><strong>{l.title}</strong><small>{l.is_published ? 'Published' : 'Draft'}{l.video_url ? ' · video' : ''}{l.reflection_prompt ? ' · reflection' : ''}</small></div>
                      <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => moveLesson(ls, j, -1)} aria-label="Move up"><ArrowUp size={14} /></button>
                      <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => moveLesson(ls, j, 1)} aria-label="Move down"><ArrowDown size={14} /></button>
                      <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => togglePublish(l)} aria-label={l.is_published ? 'Unpublish' : 'Publish'}>{l.is_published ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                      <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => setModal({ lesson: l })} aria-label="Edit"><Pencil size={14} /></button>
                      <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => removeLesson(l)} aria-label="Delete"><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
                <button className="k-btn k-btn--sm k-btn--ghost" style={{ justifySelf: 'start' }} onClick={() => setModal({ moduleId: m.id })}><Plus size={15} /> Add lesson</button>
              </section>
            );
          })}
        </div>
      ) : <DashEmpty Icon={BookOpen} title="Start with a module">Group lessons into modules — for example “Clarifying your vision” or “Branding & messaging”.</DashEmpty>}

      <section className="ds-section">
        <h2>Library & downloads</h2>
        <form className="ds-card ds-form" onSubmit={doUpload}>
          <div className="k-row">
            <label className="k-field"><span>File (PDF, worksheet, slides — up to 50 MB)</span><input type="file" onChange={(e) => setUpload({ ...upload, file: e.target.files[0] || null })} /></label>
            <label className="k-field"><span>Title</span><input value={upload.title} onChange={(e) => setUpload({ ...upload, title: e.target.value })} placeholder="Defaults to the file name" /></label>
          </div>
          <label className="k-field"><span>Attach to a lesson (optional)</span>
            <select value={upload.lesson_id} onChange={(e) => setUpload({ ...upload, lesson_id: e.target.value })}>
              <option value="">Library only</option>
              {lessons.data.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </label>
          {upload.error && <p className="k-error">{upload.error}</p>}
          <button className="k-btn k-btn--gold k-btn--sm" style={{ justifySelf: 'start' }} disabled={upload.busy}><Upload size={15} /> {upload.busy ? 'Uploading…' : 'Upload'}</button>
        </form>
        {files.data.length > 0 && (
          <ul className="ds-list" style={{ marginTop: 12 }}>
            {files.data.map((f) => (
              <li key={f.id} className="ds-row">
                <Download size={18} />
                <div><strong>{f.title}</strong><small>{f.file_name} · {fileSize(f.size_bytes)}{f.lesson_id ? ` · ${lessons.data.find((l) => l.id === f.lesson_id)?.title || 'lesson'}` : ' · library'}</small></div>
                <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => openFile(f.file_path)} aria-label="Download"><Download size={14} /></button>
                <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => removeFile(f)} aria-label="Remove"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {modal?.lesson && <LessonModal lesson={modal.lesson} onClose={() => setModal(null)} onSaved={lessons.reload} />}
      {modal?.moduleId && <LessonModal moduleId={modal.moduleId} onClose={() => setModal(null)} onSaved={lessons.reload} />}
    </>
  );
};

// ── Announcements ────────────────────────────────────────────
export const MentorAnnouncements = () => {
  const { program } = useAcademy();
  const list = useRows(() => supabase.from('academy_announcements').select('*').eq('program_id', program.id).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }), [program.id]);
  const [form, setForm] = useState({ title: '', body: '', is_pinned: false });
  const [error, setError] = useState('');
  const post = async (e) => {
    e.preventDefault();
    const { error: err } = await write(supabase.from('academy_announcements').insert({ ...form, program_id: program.id }));
    if (err) return setError(err);
    setForm({ title: '', body: '', is_pinned: false }); list.reload();
  };
  return (
    <>
      <DashHead eyebrow={`${program.title} · Mentor`} title="Announcements" lead="News, reminders and encouragement for everyone in the program." />
      <form className="ds-card ds-form" onSubmit={post}>
        <label className="k-field"><span>Title</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label className="k-field"><span>Message</span><textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
        <label className="ds-row" style={{ cursor: 'pointer' }}><input type="checkbox" className="ds-check" checked={form.is_pinned} onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })} /><div><strong>Pin to the top</strong></div></label>
        {error && <p className="k-error">{error}</p>}
        <button className="k-btn k-btn--gold k-btn--sm" style={{ justifySelf: 'start' }}><Megaphone size={15} /> Post</button>
      </form>
      <section className="ds-section">
        {list.data.length ? <div className="ds-grid ds-grid--2">{list.data.map((a) => (
          <article key={a.id} className="ds-card">
            <div className="ds-card__head"><h3>{a.is_pinned && <Pin size={14} />} {a.title}</h3><span className="ds-muted">{fmtDate(a.created_at)}</span></div>
            {a.body && <RichText text={a.body} />}
            <button className="k-btn k-btn--sm k-btn--ghost" style={{ justifySelf: 'start' }} onClick={async () => { await write(supabase.from('academy_announcements').delete().eq('id', a.id)); list.reload(); }}><Trash2 size={15} /> Delete</button>
          </article>
        ))}</div> : <p className="ds-muted">Nothing posted yet.</p>}
      </section>
    </>
  );
};

// ── Sessions (group + all 1:1s) ──────────────────────────────
export const MentorSessions = () => {
  const { program } = useAcademy();
  const roster = useRoster(program);
  const list = useRows(() => supabase.from('academy_sessions').select('*').eq('program_id', program.id).order('starts_at', { ascending: false }).limit(200), [program.id]);
  const [modal, setModal] = useState(null);
  const now = useNow();
  const upcoming = list.data.filter((s) => new Date(s.starts_at).getTime() >= now).reverse();
  const past = list.data.filter((s) => new Date(s.starts_at).getTime() < now);
  const who = (id) => roster.data.find((r) => r.user_id === id)?.full_name || 'Student';
  const row = (s) => (
    <li key={s.id}><button className="ds-row" onClick={() => setModal({ session: s })}>
      <CalendarDays size={18} /><div><strong>{s.title}</strong><small>{fmtDateTime(s.starts_at)} · {s.duration_minutes} min · {s.student_id ? `1:1 with ${who(s.student_id)}` : 'Group'}{s.join_url ? '' : ' · no join link yet'}</small></div><Pencil size={15} />
    </button></li>
  );
  return (
    <>
      <DashHead eyebrow={`${program.title} · Mentor`} title="Sessions" lead="Group sessions for everyone; schedule 1:1 sessions from a student’s page."
        actions={<button className="k-btn k-btn--gold" onClick={() => setModal('new')}><Plus size={16} /> Group session</button>} />
      {upcoming.length ? <ul className="ds-list">{upcoming.map(row)}</ul> : <DashEmpty Icon={CalendarDays} title="Nothing scheduled">Add a group session, or schedule a 1:1 from a student’s page.</DashEmpty>}
      {past.length > 0 && <section className="ds-section"><h2>Past — add notes and recordings</h2><ul className="ds-list">{past.map(row)}</ul></section>}
      {modal === 'new' && <SessionModal onClose={() => setModal(null)} onSaved={list.reload} />}
      {modal?.session && <SessionModal session={modal.session} onClose={() => setModal(null)} onSaved={list.reload} />}
    </>
  );
};
