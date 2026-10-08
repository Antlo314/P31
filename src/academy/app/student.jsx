import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BookOpen, CalendarDays, CheckCircle2, Circle, ClipboardCheck, Download, ExternalLink, FileText, Flag, Heart, Library,
  MessageCircle, Plus, Send, Sparkles, Target, Trash2, Upload, Video, ArrowRight, ArrowLeft, CalendarPlus, CreditCard, Megaphone,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CONTACT_EMAIL, fileSize, fmtDate, fmtDateTime, openFile, uploadAcademyFile, videoEmbed, downloadIcs, verseOfTheDay, BILLING } from '../../lib/academy';
import { DashHead, DashEmpty } from '../../apps/DashShell';
import RichText from '../RichText';
import Thread from './Thread';
import { useAcademy, useNow, useRows, write } from './data';
import { DueSoon } from './learn';
import { openCalendly } from '../../lib/calendly';

const isBusiness = (p) => p?.slug === 'business';
// Live-class recordings: fresh links from daily-room (they expire after a few hours).
const watchRecording = async (s) => {
  const tab = window.open('', '_blank');
  const { data } = await supabase.functions.invoke('daily-room', { body: { action: 'recording', session_id: s.id } });
  const url = data?.recordings?.[data.recordings.length - 1]?.url;
  if (url && tab) tab.location = url; else { tab?.close(); window.alert('The recording isn’t ready yet — try again in a few minutes.'); }
};
// Join a session: log it (attendance + CRM), then open the meeting.
const joinSession = async (s) => {
  const tab = window.open('', '_blank');
  const { data, error } = await supabase.rpc('academy_join_session', { p_session: s.id });
  const url = data || s.join_url;
  if (error) console.warn('join log:', error.message);
  if (tab) tab.location = url; else window.location.href = url;
};
// Private 1-hour sessions (Calendly), with the member's details filled in.
const bookSession = (user) => openCalendly('session', { name: user?.user_metadata?.full_name || '', email: user?.email || '', source: 'classroom' });
const sessionEnd = (s) => new Date(new Date(s.starts_at).getTime() + (s.duration_minutes || 60) * 60000);

const useSessions = (program, user) => useRows(
  () => supabase.from('academy_sessions').select('*').eq('program_id', program.id).order('starts_at', { ascending: true }),
  [program.id, user?.id],
);
const useLessons = (program) => useRows(
  () => supabase.from('academy_lessons').select('id, module_id, title, position, video_url, is_published').eq('program_id', program.id).eq('is_published', true).order('position'),
  [program.id],
);
const useProgress = (program, user) => useRows(
  () => supabase.from('academy_progress').select('lesson_id').eq('program_id', program.id).eq('user_id', user.id),
  [program.id, user?.id],
);

const SessionCard = ({ s, compact }) => {
  const { program } = useAcademy();
  const now = useNow();
  const live = new Date(s.starts_at).getTime() <= now + 15 * 60000 && sessionEnd(s).getTime() > now;
  return (
    <article className="ds-card">
      <div className="ds-card__head">
        <h3>{s.title}</h3>
        {s.student_id ? <span className="ds-pill ds-pill--gold">1:1</span> : <span className="ds-pill">Group</span>}
      </div>
      <p className="ds-muted"><CalendarDays size={14} style={{ verticalAlign: '-2px' }} /> {fmtDateTime(s.starts_at)} · {s.duration_minutes} min</p>
      {s.description && !compact && <RichText text={s.description} />}
      {s.notes && !compact && <div><p className="k-eyebrow" style={{ margin: '6px 0' }}>Session notes</p><RichText text={s.notes} /></div>}
      <div className="k-actions">
        {s.provider === 'daily' && sessionEnd(s) > new Date() && (
          <Link to={`/academy/${program.slug}/live/${s.id}`} className={`k-btn k-btn--sm ${live ? 'k-btn--gold' : 'k-btn--plum'}`}><Video size={16} /> {live ? 'Join class now' : 'Class room'}</Link>
        )}
        {s.provider !== 'daily' && s.join_url && sessionEnd(s) > new Date() && (
          <button type="button" onClick={() => joinSession(s)} className={`k-btn k-btn--sm ${live ? 'k-btn--gold' : 'k-btn--plum'}`}><Video size={16} /> {live ? 'Join now' : s.provider === 'zoom' ? 'Join on Zoom' : 'Join link'}</button>
        )}
        {sessionEnd(s) > new Date() && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => downloadIcs(s)}><CalendarPlus size={16} /> Add to calendar</button>}
        {s.recording_url && <a href={s.recording_url} target="_blank" rel="noopener noreferrer" className="k-btn k-btn--sm k-btn--ghost"><ExternalLink size={16} /> Recording</a>}
        {s.has_recording && !s.recording_url && <button type="button" className="k-btn k-btn--sm k-btn--ghost" onClick={() => watchRecording(s)}><ExternalLink size={16} /> Watch recording</button>}
      </div>
    </article>
  );
};

// ── Home ─────────────────────────────────────────────────────
export const StudentHome = () => {
  const { program, user } = useAcademy();
  const first = (user?.user_metadata?.full_name || '').split(' ')[0];
  const sessions = useSessions(program, user);
  const lessons = useLessons(program);
  const progress = useProgress(program, user);
  const announcements = useRows(() => supabase.from('academy_announcements').select('*').eq('program_id', program.id)
    .order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3), [program.id]);
  const items = useRows(() => supabase.from('academy_action_items').select('*').eq('program_id', program.id).eq('student_id', user.id)
    .eq('is_done', false).order('due_date', { ascending: true, nullsFirst: false }).limit(5), [program.id, user?.id]);

  const next = sessions.data.find((s) => sessionEnd(s) > new Date());
  const done = new Set(progress.data.map((p) => p.lesson_id));
  const total = lessons.data.length;
  const pct = total ? Math.round((done.size / total) * 100) : 0;
  const nextLesson = lessons.data.find((l) => !done.has(l.id));
  const [ref, verse] = verseOfTheDay();

  const tick = async (item) => {
    await write(supabase.from('academy_action_items').update({ is_done: true }).eq('id', item.id));
    items.reload();
  };

  return (
    <>
      <DashHead eyebrow={program.title} title={first ? 'Welcome back,' : 'Welcome'} accent={first || 'back'} lead="Everything for your mentorship, in one place." />

      <div className="ds-grid ds-grid--2">
        {!isBusiness(program) && (
          <article className="ds-card ds-card--night" style={{ gridColumn: '1 / -1' }}>
            <p className="k-eyebrow" style={{ margin: 0 }}>Today’s verse</p>
            <p style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '1.35rem', lineHeight: 1.35, color: '#fff' }}>“{verse}”</p>
            <p className="ds-muted" style={{ color: 'var(--gold-hi)' }}>{ref} KJV</p>
          </article>
        )}

        <article className="ds-card">
          <div className="ds-card__head"><h2><CalendarDays size={18} /> Next session</h2><Link to="sessions" className="k-link">All</Link></div>
          {next ? <SessionCard s={next} compact /> : <p className="ds-muted">No session scheduled yet — book one, or your mentor will add it here.</p>}
          <button className="k-btn k-btn--ghost k-btn--sm" style={{ justifySelf: 'start' }} onClick={() => bookSession(user)}><CalendarPlus size={15} /> Book a private session</button>
        </article>

        <DueSoon />

        <article className="ds-card">
          <div className="ds-card__head"><h2><BookOpen size={18} /> Your progress</h2><Link to="learn" className="k-link">Lessons</Link></div>
          <p><strong style={{ fontSize: '1.6rem', fontFamily: 'var(--font-heading)', color: 'var(--plum)' }}>{pct}%</strong> <span className="ds-muted">{done.size} of {total} lessons complete</span></p>
          <div className="ds-progress"><span style={{ width: `${pct}%` }} /></div>
          {nextLesson ? <Link to={`learn/${nextLesson.id}`} className="k-btn k-btn--plum k-btn--sm" style={{ justifySelf: 'start' }}>Continue: {nextLesson.title} <ArrowRight size={16} /></Link>
            : total ? <p className="ds-muted">All caught up — well done.</p> : <p className="ds-muted">Lessons will appear as your mentor releases them.</p>}
        </article>

        {isBusiness(program) && (
          <article className="ds-card">
            <div className="ds-card__head"><h2><ClipboardCheck size={18} /> Next steps</h2><Link to="plans" className="k-link">Action plans</Link></div>
            {items.data.length ? (
              <ul className="ds-list">
                {items.data.map((it) => (
                  <li key={it.id} className="ds-row">
                    <input type="checkbox" className="ds-check" onChange={() => tick(it)} aria-label={`Mark “${it.text}” done`} />
                    <div><strong>{it.text}</strong>{it.due_date && <small>Due {fmtDate(it.due_date)}</small>}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="ds-muted">Your action plan appears here after each session.</p>}
          </article>
        )}

        <article className="ds-card">
          <div className="ds-card__head"><h2><Megaphone size={18} /> Announcements</h2></div>
          {announcements.data.length ? announcements.data.map((a) => (
            <div key={a.id} style={{ display: 'grid', gap: 4 }}>
              <strong>{a.title}</strong>
              {a.body && <RichText text={a.body} />}
              <span className="ds-muted">{fmtDate(a.created_at)}</span>
            </div>
          )) : <p className="ds-muted">Nothing new right now.</p>}
        </article>

        <article className="ds-card">
          <div className="ds-card__head"><h2><MessageCircle size={18} /> Your mentor</h2></div>
          <p>Questions, wins or prayer requests between sessions — send them anytime.</p>
          <Link to="messages" className="k-btn k-btn--gold k-btn--sm" style={{ justifySelf: 'start' }}><Send size={16} /> Message your mentor</Link>
        </article>
      </div>
    </>
  );
};

// ── Lessons ──────────────────────────────────────────────────
export const StudentLearn = () => {
  const { program, user } = useAcademy();
  const modules = useRows(() => supabase.from('academy_modules').select('*').eq('program_id', program.id).eq('is_published', true).order('position'), [program.id]);
  const lessons = useLessons(program);
  const progress = useProgress(program, user);
  const done = new Set(progress.data.map((p) => p.lesson_id));

  return (
    <>
      <DashHead eyebrow={program.title} title="Your" accent="lessons" lead="Work through each module at your pace. Mark a lesson complete when you’re done." />
      {modules.data.length ? (
        <div className="ds-grid">
          {modules.data.map((m, i) => {
            const ls = lessons.data.filter((l) => l.module_id === m.id);
            const n = ls.filter((l) => done.has(l.id)).length;
            return (
              <section key={m.id} className="ds-card">
                <div className="ds-card__head">
                  <h2><span className="k-num">0{i + 1}</span> {m.title}</h2>
                  <span className="ds-pill">{n}/{ls.length}</span>
                </div>
                {m.summary && <p>{m.summary}</p>}
                <ul className="ds-list">
                  {ls.map((l) => (
                    <li key={l.id}>
                      <Link to={l.id} className={`ds-row ${done.has(l.id) ? 'is-done' : ''}`}>
                        {done.has(l.id) ? <CheckCircle2 size={20} color="#17A673" /> : <Circle size={20} />}
                        <div><strong>{l.title}</strong>{l.video_url && <small><Video size={12} /> Video</small>}</div>
                        <ArrowRight size={16} />
                      </Link>
                    </li>
                  ))}
                  {!ls.length && <li className="ds-muted">Lessons coming soon.</li>}
                </ul>
              </section>
            );
          })}
        </div>
      ) : <DashEmpty Icon={BookOpen} title="Lessons are on the way">Your mentor is preparing your first module. You’ll see it here as soon as it’s released.</DashEmpty>}
    </>
  );
};

export const StudentLesson = () => {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { program, user } = useAcademy();
  const lesson = useRows(() => supabase.from('academy_lessons').select('*').eq('id', lessonId).maybeSingle(), [lessonId], { initial: null });
  const all = useLessons(program);
  const files = useRows(() => supabase.from('academy_resources').select('*').eq('lesson_id', lessonId).order('created_at'), [lessonId]);
  const progress = useProgress(program, user);
  const [reflection, setReflection] = useState('');
  const [saved, setSaved] = useState('');
  const l = lesson.data;
  const done = progress.data.some((p) => p.lesson_id === lessonId);
  const idx = all.data.findIndex((x) => x.id === lessonId);
  const prev = idx > 0 ? all.data[idx - 1] : null;
  const next = idx >= 0 && idx < all.data.length - 1 ? all.data[idx + 1] : null;
  const embed = videoEmbed(l?.video_url);

  const toggle = async () => {
    if (done) await write(supabase.from('academy_progress').delete().eq('user_id', user.id).eq('lesson_id', lessonId));
    else await write(supabase.from('academy_progress').insert({ user_id: user.id, lesson_id: lessonId, program_id: program.id }));
    progress.reload();
  };
  const saveReflection = async () => {
    if (!reflection.trim()) return;
    const { error } = await write(supabase.from('academy_journal').insert({ program_id: program.id, lesson_id: lessonId, kind: 'reflection', title: l.title, body: reflection.trim() }));
    setSaved(error || 'Saved to your journal.');
    if (!error) setReflection('');
  };

  if (lesson.loading) return <p className="ds-muted">Loading…</p>;
  if (!l) return <DashEmpty Icon={BookOpen} title="Lesson not found" action={<Link to=".." relative="path" className="k-btn k-btn--ghost">Back to lessons</Link>} />;

  return (
    <>
      <Link to=".." relative="path" className="k-link" style={{ marginBottom: 12 }}><ArrowLeft size={16} /> All lessons</Link>
      <DashHead eyebrow={program.title} title={l.title} />
      <div className="ds-grid" style={{ maxWidth: 860 }}>
        {embed ? <div className="ds-video"><iframe src={embed} title={l.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>
          : l.video_url && <a href={l.video_url} target="_blank" rel="noopener noreferrer" className="k-btn k-btn--plum" style={{ justifySelf: 'start' }}><Video size={18} /> Watch the video</a>}
        {l.body && <article className="ds-card"><RichText text={l.body} /></article>}
        {files.data.length > 0 && (
          <article className="ds-card">
            <h2><Download size={18} /> Downloads</h2>
            <ul className="ds-list">{files.data.map((f) => (
              <li key={f.id}><button className="ds-row" onClick={() => openFile(f.file_path)}><FileText size={20} /><div><strong>{f.title}</strong><small>{f.file_name} {fileSize(f.size_bytes)}</small></div><Download size={16} /></button></li>
            ))}</ul>
          </article>
        )}
        {l.reflection_prompt && (
          <article className="ds-card ds-card--night">
            <p className="k-eyebrow" style={{ margin: 0 }}>Reflect</p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', color: '#fff' }}>{l.reflection_prompt}</p>
            <textarea className="k-input" rows={4} value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="Write your reflection — only you can see it." style={{ background: 'rgba(255,255,255,.08)', color: '#fff', borderColor: 'rgba(255,255,255,.2)' }} />
            <button className="k-btn k-btn--gold k-btn--sm" style={{ justifySelf: 'start' }} onClick={saveReflection} disabled={!reflection.trim()}>Save to my journal</button>
            {saved && <p className="ds-muted" style={{ color: 'var(--gold-hi)' }}>{saved}</p>}
          </article>
        )}
        <div className="k-actions" style={{ justifyContent: 'space-between' }}>
          <button className={`k-btn ${done ? 'k-btn--ghost' : 'k-btn--gold'}`} onClick={toggle}>
            {done ? <><CheckCircle2 size={18} /> Completed</> : <>Mark complete</>}
          </button>
          <div className="k-actions">
            {prev && <button className="k-btn k-btn--ghost k-btn--sm" onClick={() => navigate(`../${prev.id}`, { relative: 'path' })}><ArrowLeft size={16} /> Previous</button>}
            {next && <button className="k-btn k-btn--plum k-btn--sm" onClick={() => navigate(`../${next.id}`, { relative: 'path' })}>Next <ArrowRight size={16} /></button>}
          </div>
        </div>
      </div>
    </>
  );
};

// ── Sessions ─────────────────────────────────────────────────
export const StudentSessions = () => {
  const { program, user } = useAcademy();
  const sessions = useSessions(program, user);
  const upcoming = sessions.data.filter((s) => sessionEnd(s) > new Date());
  const past = sessions.data.filter((s) => sessionEnd(s) <= new Date()).reverse();
  return (
    <>
      <DashHead eyebrow={program.title} title="Your" accent="sessions" lead={isBusiness(program) ? 'Private 60-minute sessions, conducted virtually. Join links appear here.' : 'Gatherings and one-on-one time with your mentor.'}
        actions={<button className="k-btn k-btn--gold" onClick={() => bookSession(user)}><CalendarPlus size={16} /> Book a private session</button>} />
      {upcoming.length ? <div className="ds-grid ds-grid--2">{upcoming.map((s) => <SessionCard key={s.id} s={s} />)}</div>
        : <DashEmpty Icon={CalendarDays} title="No upcoming sessions">Your mentor will schedule your next session here. Need to reschedule? Send a message.</DashEmpty>}
      {past.length > 0 && <section className="ds-section"><h2>Past sessions</h2><div className="ds-grid ds-grid--2">{past.map((s) => <SessionCard key={s.id} s={s} />)}</div></section>}
    </>
  );
};

// ── Action plans (business) ──────────────────────────────────
export const StudentPlans = () => {
  const { program, user } = useAcademy();
  const plans = useRows(() => supabase.from('academy_action_plans').select('*, items:academy_action_items(*)').eq('program_id', program.id).eq('student_id', user.id).order('created_at', { ascending: false }), [program.id, user?.id]);
  const toggle = async (it) => { await write(supabase.from('academy_action_items').update({ is_done: !it.is_done }).eq('id', it.id)); plans.reload(); };
  return (
    <>
      <DashHead eyebrow={program.title} title="Action" accent="plans" lead="After each session you receive a plan with clear, measurable next steps. Tick them off as you go." />
      {plans.data.length ? (
        <div className="ds-grid">
          {plans.data.map((p) => {
            const items = [...(p.items || [])].sort((a, b) => a.position - b.position);
            const n = items.filter((i) => i.is_done).length;
            return (
              <section key={p.id} className="ds-card">
                <div className="ds-card__head"><h2>{p.title}</h2><span className="ds-pill">{n}/{items.length} done</span></div>
                <p className="ds-muted">{fmtDate(p.created_at)}</p>
                {p.summary && <RichText text={p.summary} />}
                <div className="ds-progress"><span style={{ width: `${items.length ? (n / items.length) * 100 : 0}%` }} /></div>
                <ul className="ds-list">
                  {items.map((it) => (
                    <li key={it.id} className={`ds-row ${it.is_done ? 'is-done' : ''}`}>
                      <input type="checkbox" className="ds-check" checked={it.is_done} onChange={() => toggle(it)} aria-label={it.text} />
                      <div><strong>{it.text}</strong>{it.due_date && <small>Due {fmtDate(it.due_date)}</small>}</div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : <DashEmpty Icon={ClipboardCheck} title="Your first action plan is coming">After your first session, your mentor will post your next steps here.</DashEmpty>}
    </>
  );
};

// ── Goals (business) ─────────────────────────────────────────
export const StudentGoals = () => {
  const { program, user } = useAcademy();
  const goals = useRows(() => supabase.from('academy_goals').select('*').eq('program_id', program.id).eq('user_id', user.id).order('is_done').order('due_date', { nullsFirst: false }), [program.id, user?.id]);
  const [form, setForm] = useState({ title: '', due: '' });
  const [error, setError] = useState('');
  const add = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const { error: err } = await write(supabase.from('academy_goals').insert({ program_id: program.id, title: form.title.trim(), due_date: form.due || null }));
    if (err) return setError(err);
    setForm({ title: '', due: '' }); goals.reload();
  };
  const toggle = async (g) => { await write(supabase.from('academy_goals').update({ is_done: !g.is_done }).eq('id', g.id)); goals.reload(); };
  const remove = async (g) => { await write(supabase.from('academy_goals').delete().eq('id', g.id)); goals.reload(); };
  return (
    <>
      <DashHead eyebrow={program.title} title="Goals &" accent="milestones" lead="Name what you’re building toward. Your mentor will help you adjust the strategy as you go." />
      <form className="ds-card ds-form" onSubmit={add}>
        <div className="k-row">
          <label className="k-field"><span>Goal or milestone</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Launch my signature offer" /></label>
          <label className="k-field"><span>Target date (optional)</span><input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></label>
        </div>
        {error && <p className="k-error">{error}</p>}
        <button className="k-btn k-btn--plum k-btn--sm" style={{ justifySelf: 'start' }}><Plus size={16} /> Add goal</button>
      </form>
      <section className="ds-section">
        {goals.data.length ? (
          <ul className="ds-list">
            {goals.data.map((g) => (
              <li key={g.id} className={`ds-row ${g.is_done ? 'is-done' : ''}`}>
                <input type="checkbox" className="ds-check" checked={g.is_done} onChange={() => toggle(g)} aria-label={g.title} />
                <div><strong>{g.title}</strong>{g.due_date && <small><Flag size={12} /> {fmtDate(g.due_date)}</small>}</div>
                <button className="ds-icon-btn" style={{ color: 'var(--ink-3)', borderColor: 'var(--line)' }} onClick={() => remove(g)} aria-label="Delete goal"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        ) : <DashEmpty Icon={Target} title="No goals yet">Start with one clear goal for this season.</DashEmpty>}
      </section>
    </>
  );
};

// ── Submit work for feedback (business) ─────────────────────
export const StudentWork = () => {
  const { program, user } = useAcademy();
  const subs = useRows(() => supabase.from('academy_submissions').select('*').eq('program_id', program.id).eq('student_id', user.id).order('created_at', { ascending: false }), [program.id, user?.id]);
  const [form, setForm] = useState({ title: '', note: '', link: '', file: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || (!form.file && !form.link.trim())) return setError('Add a title and a file or a link.');
    setBusy(true); setError('');
    try {
      const file = form.file ? await uploadAcademyFile(program.slug, `submissions/${user.id}`, form.file) : {};
      const { error: err } = await write(supabase.from('academy_submissions').insert({
        program_id: program.id, title: form.title.trim(), note: form.note.trim() || null, link_url: form.link.trim() || null, ...file,
      }));
      if (err) throw new Error(err);
      setForm({ title: '', note: '', link: '', file: null }); subs.reload();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };
  const withdraw = async (s) => {
    if (!window.confirm('Withdraw this submission?')) return;
    if (s.file_path) await supabase.storage.from('academy').remove([s.file_path]);
    await write(supabase.from('academy_submissions').delete().eq('id', s.id)); subs.reload();
  };
  return (
    <>
      <DashHead eyebrow={program.title} title="Submit for" accent="feedback" lead="Send your offers, funnels, marketing plans or proposals. Your mentor will review them and reply here." />
      <form className="ds-card ds-form" onSubmit={submit}>
        <label className="k-field"><span>What is it?</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Signature offer — sales page draft" /></label>
        <label className="k-field"><span>What would you like feedback on? (optional)</span><textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        <div className="k-row">
          <label className="k-field"><span>Upload a file (up to 50 MB)</span><input type="file" onChange={(e) => setForm({ ...form, file: e.target.files[0] || null })} /></label>
          <label className="k-field"><span>…or share a link</span><input type="url" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://" /></label>
        </div>
        {error && <p className="k-error">{error}</p>}
        <button className="k-btn k-btn--gold k-btn--sm" style={{ justifySelf: 'start' }} disabled={busy}><Upload size={16} /> {busy ? 'Sending…' : 'Send to my mentor'}</button>
      </form>
      <section className="ds-section">
        <h2>Your submissions</h2>
        {subs.data.length ? (
          <div className="ds-grid">
            {subs.data.map((s) => (
              <article key={s.id} className="ds-card">
                <div className="ds-card__head"><h3>{s.title}</h3><span className={`ds-pill ${s.status === 'reviewed' ? 'ds-pill--green' : 'ds-pill--gold'}`}>{s.status === 'reviewed' ? 'Reviewed' : 'Waiting for review'}</span></div>
                <p className="ds-muted">{fmtDate(s.created_at)}</p>
                {s.note && <p>{s.note}</p>}
                <div className="k-actions">
                  {s.file_path && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => openFile(s.file_path)}><Download size={16} /> {s.file_name}</button>}
                  {s.link_url && <a className="k-btn k-btn--sm k-btn--ghost" href={s.link_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Link</a>}
                  {s.status === 'submitted' && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => withdraw(s)}><Trash2 size={16} /> Withdraw</button>}
                </div>
                {s.feedback && <div className="ds-card ds-card--night"><p className="k-eyebrow" style={{ margin: 0 }}>Mentor feedback</p><RichText text={s.feedback} /></div>}
              </article>
            ))}
          </div>
        ) : <p className="ds-muted">Nothing submitted yet.</p>}
      </section>
    </>
  );
};

// ── Journal (faith) ──────────────────────────────────────────
const KINDS = [['prayer', 'Prayer'], ['reflection', 'Reflection'], ['gratitude', 'Gratitude']];
export const StudentJournal = () => {
  const { program, user } = useAcademy();
  const [filter, setFilter] = useState('all');
  const entries = useRows(() => supabase.from('academy_journal').select('*').eq('program_id', program.id).eq('user_id', user.id).order('created_at', { ascending: false }).limit(200), [program.id, user?.id]);
  const [form, setForm] = useState({ kind: 'prayer', title: '', body: '' });
  const [error, setError] = useState('');
  const [ref, verse] = verseOfTheDay();
  const shown = useMemo(() => entries.data.filter((e) => filter === 'all' || e.kind === filter), [entries.data, filter]);

  const add = async (e) => {
    e.preventDefault();
    if (!form.body.trim()) return;
    const { error: err } = await write(supabase.from('academy_journal').insert({ program_id: program.id, kind: form.kind, title: form.title.trim() || null, body: form.body.trim() }));
    if (err) return setError(err);
    setForm({ ...form, title: '', body: '' }); entries.reload();
  };
  const answered = async (en) => { await write(supabase.from('academy_journal').update({ is_answered: !en.is_answered, updated_at: new Date().toISOString() }).eq('id', en.id)); entries.reload(); };
  const remove = async (en) => { if (window.confirm('Delete this entry?')) { await write(supabase.from('academy_journal').delete().eq('id', en.id)); entries.reload(); } };

  return (
    <>
      <DashHead eyebrow={program.title} title="Prayer &" accent="reflection" lead="A private journal — only you can see it." />
      <article className="ds-card ds-card--night" style={{ marginBottom: 14 }}>
        <p className="k-eyebrow" style={{ margin: 0 }}>Today’s verse</p>
        <p style={{ fontFamily: 'var(--font-heading)', fontStyle: 'italic', fontSize: '1.25rem', color: '#fff' }}>“{verse}”</p>
        <p className="ds-muted" style={{ color: 'var(--gold-hi)' }}>{ref} KJV</p>
      </article>
      <form className="ds-card ds-form" onSubmit={add}>
        <div className="k-segs" role="group" aria-label="Entry type">
          {KINDS.map(([v, l]) => <button key={v} type="button" aria-pressed={form.kind === v} onClick={() => setForm({ ...form, kind: v })}>{l}</button>)}
        </div>
        <label className="k-field"><span>Title (optional)</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label className="k-field"><span>{form.kind === 'prayer' ? 'Your prayer' : form.kind === 'gratitude' ? 'What you’re thankful for' : 'Your reflection'}</span>
          <textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
        {error && <p className="k-error">{error}</p>}
        <button className="k-btn k-btn--plum k-btn--sm" style={{ justifySelf: 'start' }}><Heart size={16} /> Save entry</button>
      </form>
      <section className="ds-section">
        <div className="ds-tabs-inline" role="tablist">
          {[['all', 'All'], ...KINDS].map(([v, l]) => <button key={v} role="tab" aria-selected={filter === v} onClick={() => setFilter(v)}>{l}</button>)}
        </div>
        {shown.length ? (
          <div className="ds-grid ds-grid--2">
            {shown.map((en) => (
              <article key={en.id} className="ds-card">
                <div className="ds-card__head">
                  <span className={`ds-pill ${en.kind === 'prayer' && en.is_answered ? 'ds-pill--green' : ''}`}>{en.kind === 'prayer' && en.is_answered ? 'Answered prayer' : KINDS.find(([v]) => v === en.kind)?.[1]}</span>
                  <span className="ds-muted">{fmtDate(en.created_at)}</span>
                </div>
                {en.title && <h3>{en.title}</h3>}
                <p style={{ whiteSpace: 'pre-wrap' }}>{en.body}</p>
                <div className="k-actions">
                  {en.kind === 'prayer' && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => answered(en)}><Sparkles size={16} /> {en.is_answered ? 'Mark unanswered' : 'Mark answered'}</button>}
                  <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => remove(en)}><Trash2 size={16} /> Delete</button>
                </div>
              </article>
            ))}
          </div>
        ) : <DashEmpty Icon={Heart} title="Your journal is waiting">Write your first prayer or reflection above.</DashEmpty>}
      </section>
    </>
  );
};

// ── Library ──────────────────────────────────────────────────
export const StudentLibrary = () => {
  const { program } = useAcademy();
  const files = useRows(() => supabase.from('academy_resources').select('*').eq('program_id', program.id).order('created_at', { ascending: false }), [program.id]);
  const [error, setError] = useState('');
  const open = async (f) => { setError(''); try { await openFile(f.file_path); } catch { setError('That file couldn’t be opened — try again in a moment.'); } };
  return (
    <>
      <DashHead eyebrow={program.title} title="Resource" accent="library" lead="Guides, worksheets and downloads from your mentor." />
      {error && <p className="k-error">{error}</p>}
      {files.data.length ? (
        <ul className="ds-list">
          {files.data.map((f) => (
            <li key={f.id}><button className="ds-row" onClick={() => open(f)}>
              <FileText size={22} /><div><strong>{f.title}</strong><small>{[f.description, f.file_name, fileSize(f.size_bytes)].filter(Boolean).join(' · ')}</small></div><Download size={18} />
            </button></li>
          ))}
        </ul>
      ) : <DashEmpty Icon={Library} title="No resources yet">Downloads your mentor shares will be collected here.</DashEmpty>}
    </>
  );
};

// ── Messages ─────────────────────────────────────────────────
export const StudentMessages = () => {
  const { program, user } = useAcademy();
  return (
    <>
      <DashHead eyebrow={program.title} title="Your" accent="member line" lead={isBusiness(program) ? 'Direct access for support, feedback and quick guidance between sessions.' : 'Questions, prayer requests and encouragement between sessions.'} />
      <div style={{ maxWidth: 820 }}>
        <Thread programId={program.id} studentId={user?.id} meId={user?.id} emptyText="Say hello — your mentor reads every message." />
      </div>
    </>
  );
};

// ── Billing ──────────────────────────────────────────────────
export const StudentBilling = () => {
  const { program, user } = useAcademy();
  const enr = useRows(() => supabase.from('academy_enrollments').select('*, plan:academy_plans(label, billing, price_cents)').eq('program_id', program.id).eq('user_id', user.id).maybeSingle(), [program.id, user?.id], { initial: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const e = enr.data;
  const manage = async () => {
    setBusy(true); setError('');
    const { data, error: err } = await supabase.functions.invoke('academy-billing', { body: { program: program.slug } });
    let msg = data?.error;
    if (err) { try { msg = (await err.context?.json?.())?.error; } catch { /* keep */ } }
    if (data?.url) { window.location.href = data.url; return; }
    setError(msg || 'Billing isn’t available right now.'); setBusy(false);
  };
  return (
    <>
      <DashHead eyebrow={program.title} title="Membership &" accent="billing" />
      {e ? (
        <article className="ds-card" style={{ maxWidth: 640 }}>
          <div className="ds-card__head"><h2><CreditCard size={18} /> {e.plan?.label || 'Your membership'}</h2>
            <span className={`ds-pill ${e.status === 'active' ? 'ds-pill--green' : e.status === 'past_due' ? 'ds-pill--red' : ''}`}>{e.status.replace('_', ' ')}</span></div>
          {e.plan?.billing && <p className="ds-muted">{BILLING[e.plan.billing]?.label}</p>}
          <p>{e.access_until ? `${e.status === 'canceled' ? 'Access ends' : e.plan?.billing === 'one_time' || e.source !== 'stripe' ? 'Access through' : 'Renews around'} ${fmtDate(e.access_until)}.` : 'Your access is open-ended.'}</p>
          {e.status === 'past_due' && <p className="k-error">Your last payment didn’t go through. Update your card to keep your access.</p>}
          {e.source === 'stripe' && e.stripe_customer_id
            ? <button className="k-btn k-btn--plum" onClick={manage} disabled={busy} style={{ justifySelf: 'start' }}><CreditCard size={18} /> {busy ? 'Opening…' : 'Manage card & receipts'}</button>
            : <p className="ds-muted">Questions about your membership? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>}
          {error && <p className="k-error">{error}</p>}
        </article>
      ) : <DashEmpty Icon={CreditCard} title="Membership details">Your membership details will appear here. Questions? Email {CONTACT_EMAIL}.</DashEmpty>}
    </>
  );
};
