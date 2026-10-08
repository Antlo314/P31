import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ClipboardList, Download, Link2, Send, ArrowLeft, ListChecks, Check, X, HelpCircle, RotateCcw, Award, Target, BarChart3,
  CalendarClock, FileText, Upload, ArrowRight,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fileSize, fmtDate, fmtDateTime, openFile, uploadAcademyFile } from '../../lib/academy';
import { DashHead, DashEmpty } from '../../apps/DashShell';
import RichText from '../RichText';
import { useAcademy, useNow, useRows, write } from './data';
import { Bar } from './ui';
import { pct, requirementStatus, scoreLabel } from './helpers';

const STATUS = {
  submitted: ['Handed in · awaiting feedback', 'ds-pill--gold'],
  reviewed: ['Graded', 'ds-pill--green'],
  revise: ['Revision requested', 'ds-pill--red'],
};

// ── Assignments ──────────────────────────────────────────────
export const StudentAssignments = () => {
  const { program, user } = useAcademy();
  const now = useNow();
  const list = useRows(() => supabase.from('academy_assignments').select('*, criteria:academy_criteria(max_points)').eq('program_id', program.id).eq('is_published', true).order('due_at', { ascending: true, nullsFirst: false }), [program.id]);
  const subs = useRows(() => supabase.from('academy_submissions').select('id, assignment_id, status, score, max_score, created_at').eq('program_id', program.id).eq('student_id', user.id).order('created_at', { ascending: false }), [program.id, user?.id]);
  const mine = (id) => subs.data.find((s) => s.assignment_id === id);
  const todo = list.data.filter((a) => !mine(a.id) || mine(a.id).status === 'revise');
  const done = list.data.filter((a) => mine(a.id) && mine(a.id).status !== 'revise');

  const card = (a) => {
    const s = mine(a.id);
    const late = a.due_at && new Date(a.due_at).getTime() < now && !s;
    const [label, cls] = s ? STATUS[s.status] : late ? ['Past due', 'ds-pill--red'] : ['To do', ''];
    return (
      <li key={a.id}>
        <Link to={a.id} className="ds-row">
          <ClipboardList size={18} />
          <div><strong>{a.title}</strong><small>{a.due_at ? `Due ${fmtDateTime(a.due_at)}` : 'No due date'}{s?.max_score ? ` · ${scoreLabel(s)}` : ''}</small></div>
          <span className={`ds-pill ${cls}`}>{label}</span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <DashHead eyebrow={program.title} title="Assignments" lead="Real work, clear criteria, and feedback from your mentor." />
      {list.data.length ? <>
        <section><h2 className="cl-h2">To do</h2>{todo.length ? <ul className="ds-list">{todo.map(card)}</ul> : <p className="ds-muted">You’re all caught up. Well done.</p>}</section>
        {done.length > 0 && <section className="ds-section"><h2 className="cl-h2">Handed in</h2><ul className="ds-list">{done.map(card)}</ul></section>}
      </> : <DashEmpty Icon={ClipboardList} title="No assignments yet">When your mentor sets one, it shows up here — and you’ll get a notification.</DashEmpty>}
    </>
  );
};

export const StudentAssignment = () => {
  const { assignmentId } = useParams();
  const { program, user } = useAcademy();
  const now = useNow();
  const a = useRows(() => supabase.from('academy_assignments').select('*').eq('id', assignmentId).maybeSingle(), [assignmentId], { initial: null });
  const crit = useRows(() => supabase.from('academy_criteria').select('*').eq('assignment_id', assignmentId).order('position'), [assignmentId]);
  const subs = useRows(() => supabase.from('academy_submissions').select('*').eq('assignment_id', assignmentId).eq('student_id', user.id).order('created_at', { ascending: false }), [assignmentId, user?.id]);
  const scores = useRows(() => supabase.from('academy_scores').select('*').in('submission_id', subs.data.map((s) => s.id)), [assignmentId, subs.data.length || null]);
  const [form, setForm] = useState({ body: '', link_url: '', note: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const as = a.data;
  if (a.loading) return <p className="ds-muted">Loading…</p>;
  if (!as) return <DashEmpty Icon={ClipboardList} title="Assignment not found" action={<Link to=".." relative="path" className="k-btn k-btn--ghost">All assignments</Link>} />;

  const latest = subs.data[0];
  const canSubmit = !latest || latest.status === 'revise';
  const type = as.submission_type;
  const total = crit.data.reduce((n, c) => n + c.max_points, 0);
  const late = as.due_at && new Date(as.due_at).getTime() < now;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.body.trim() && !form.link_url.trim() && !file) return setError('Add your work — a file, a link or a written answer.');
    setBusy(true); setError('');
    try {
      const meta = file ? await uploadAcademyFile(program.slug, `submissions/${user.id}`, file) : {};
      const { error: err } = await write(supabase.from('academy_submissions').insert({
        program_id: program.id, assignment_id: as.id, title: as.title, body: form.body.trim() || null,
        link_url: form.link_url.trim() || null, note: form.note.trim() || null, ...meta,
      }));
      if (err) throw new Error(err);
      setForm({ body: '', link_url: '', note: '' }); setFile(null); subs.reload();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  return (
    <>
      <Link to=".." relative="path" className="k-link" style={{ marginBottom: 12 }}><ArrowLeft size={16} /> All assignments</Link>
      <DashHead eyebrow={`${program.title} · Assignment`} title={as.title}
        lead={`${as.due_at ? `${late ? 'Was due' : 'Due'} ${fmtDateTime(as.due_at)}` : 'No due date'}${total ? ` · ${total} points · pass at ${as.pass_pct}%` : ''}`} />
      <div className="cl-two">
        <div className="ds-grid">
          {as.instructions && <article className="ds-card"><RichText text={as.instructions} /></article>}
          {as.file_path && <button className="ds-row" onClick={() => openFile(as.file_path)}><Download size={18} /><div><strong>{as.file_name}</strong><small>{fileSize(as.size_bytes)} · from your mentor</small></div></button>}

          {canSubmit ? (
            <form className="ds-card ds-form" onSubmit={submit}>
              <h3 style={{ margin: 0 }}>{latest?.status === 'revise' ? 'Hand in your revision' : 'Hand in your work'}</h3>
              {(type === 'any' || type === 'text') && <label className="k-field"><span>Written answer</span><textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>}
              {(type === 'any' || type === 'file') && <label className="k-field"><span>File (up to 50 MB)</span><input type="file" onChange={(e) => setFile(e.target.files[0] || null)} /></label>}
              {(type === 'any' || type === 'link') && <label className="k-field"><span>Link (Google Doc, Canva, website…)</span><input type="url" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://" /></label>}
              <label className="k-field"><span>Note to your mentor (optional)</span><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
              {error && <p className="k-error">{error}</p>}
              <button className="k-btn k-btn--gold" disabled={busy}><Upload size={16} /> {busy ? 'Sending…' : 'Hand it in'}</button>
            </form>
          ) : <div className="ds-banner"><Check size={18} /> {latest.status === 'submitted' ? 'Handed in — your mentor will send feedback.' : 'Graded — see your feedback below.'}</div>}

          {subs.data.map((s, i) => {
            const mine = scores.data.filter((x) => x.submission_id === s.id);
            return (
              <article key={s.id} className="ds-card">
                <div className="ds-card__head"><h3>{i === 0 ? 'Your latest' : 'Earlier attempt'}</h3><span className={`ds-pill ${STATUS[s.status][1]}`}>{STATUS[s.status][0]}</span></div>
                <p className="ds-muted">{fmtDateTime(s.created_at)}{s.max_score ? ` · ${scoreLabel(s)}` : ''}</p>
                {s.body && <div className="cl-submission__body">{s.body}</div>}
                <div className="k-actions">
                  {s.file_path && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => openFile(s.file_path)}><FileText size={15} /> {s.file_name}</button>}
                  {s.link_url && <a className="k-btn k-btn--sm k-btn--ghost" href={s.link_url} target="_blank" rel="noopener noreferrer"><Link2 size={15} /> Your link</a>}
                </div>
                {mine.length > 0 && (
                  <ul className="cl-reqs">{crit.data.map((c) => { const x = mine.find((m) => m.criterion_id === c.id); return x ? <li key={c.id}><span>{c.title}{x.comment ? <small className="ds-muted" style={{ display: 'block' }}>{x.comment}</small> : null}</span><small>{Number(x.points)}/{c.max_points}</small></li> : null; })}</ul>
                )}
                {s.feedback && <div className="cl-feedback"><p className="k-eyebrow" style={{ margin: 0 }}>Mentor feedback</p><p style={{ whiteSpace: 'pre-wrap' }}>{s.feedback}</p></div>}
              </article>
            );
          })}
        </div>
        {crit.data.length > 0 && (
          <aside className="ds-card cl-rubric">
            <div className="ds-card__head"><h3><ListChecks size={17} /> How it’s graded</h3><span className="ds-pill">{total} pts</span></div>
            <ul className="cl-reqs">{crit.data.map((c) => <li key={c.id}><span>{c.title}{c.description && <small className="ds-muted" style={{ display: 'block' }}>{c.description}</small>}</span><small>{c.max_points}</small></li>)}</ul>
          </aside>
        )}
      </div>
    </>
  );
};

// ── Quizzes ──────────────────────────────────────────────────
export const StudentQuizzes = () => {
  const { program, user } = useAcademy();
  const list = useRows(() => supabase.from('academy_quizzes').select('*, questions:academy_quiz_questions(id)').eq('program_id', program.id).eq('is_published', true).order('position'), [program.id]);
  const attempts = useRows(() => supabase.from('academy_quiz_attempts').select('quiz_id, score_pct, passed').eq('program_id', program.id).eq('user_id', user.id), [program.id, user?.id]);
  return (
    <>
      <DashHead eyebrow={program.title} title="Quizzes" lead="Quick checks to lock in what you’ve learned. Most are graded the moment you finish." />
      {list.data.length ? (
        <ul className="ds-list">
          {list.data.map((q) => {
            const mine = attempts.data.filter((a) => a.quiz_id === q.id);
            const best = mine.reduce((m, a) => Math.max(m, Number(a.score_pct)), -1);
            const passed = mine.some((a) => a.passed);
            return (
              <li key={q.id}><Link to={q.id} className="ds-row">
                <HelpCircle size={18} />
                <div><strong>{q.title}</strong><small>{q.questions?.length || 0} questions · pass at {q.pass_pct}%{best >= 0 ? ` · best ${Math.round(best)}%` : ''}</small></div>
                <span className={`ds-pill ${passed ? 'ds-pill--green' : mine.length ? 'ds-pill--gold' : ''}`}>{passed ? 'Passed' : mine.length ? 'Try again' : 'Start'}</span>
              </Link></li>
            );
          })}
        </ul>
      ) : <DashEmpty Icon={HelpCircle} title="No quizzes yet">Your mentor’s quizzes show up here.</DashEmpty>}
    </>
  );
};

export const StudentQuiz = () => {
  const { quizId } = useParams();
  const { program, user } = useAcademy();
  const quiz = useRows(() => supabase.from('academy_quizzes').select('*').eq('id', quizId).maybeSingle(), [quizId], { initial: null });
  const questions = useRows(() => supabase.from('academy_quiz_questions').select('*').eq('quiz_id', quizId).order('position'), [quizId]);
  const attempts = useRows(() => supabase.from('academy_quiz_attempts').select('*').eq('quiz_id', quizId).eq('user_id', user.id).order('created_at', { ascending: false }), [quizId, user?.id]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const q = quiz.data;
  if (quiz.loading) return <p className="ds-muted">Loading…</p>;
  if (!q) return <DashEmpty Icon={HelpCircle} title="Quiz not found" action={<Link to=".." relative="path" className="k-btn k-btn--ghost">All quizzes</Link>} />;

  const left = q.max_attempts ? q.max_attempts - attempts.data.length : null;
  const pick = (question, i) => {
    const cur = answers[question.id] || [];
    setAnswers({ ...answers, [question.id]: question.kind === 'single' ? [i] : cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] });
  };
  const submit = async (e) => {
    e.preventDefault();
    const missing = questions.data.filter((x) => !answers[x.id] || (Array.isArray(answers[x.id]) && !answers[x.id].length) || (typeof answers[x.id] === 'string' && !answers[x.id].trim()));
    if (missing.length && !window.confirm(`${missing.length} question${missing.length === 1 ? ' is' : 's are'} unanswered. Submit anyway?`)) return;
    setBusy(true); setError('');
    const { data, error: err } = await write(supabase.rpc('academy_submit_quiz', { p_quiz: q.id, p_answers: answers }));
    setBusy(false);
    if (err) return setError(err);
    setResult(data); attempts.reload();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const retry = () => { setResult(null); setAnswers({}); };

  return (
    <>
      <Link to=".." relative="path" className="k-link" style={{ marginBottom: 12 }}><ArrowLeft size={16} /> All quizzes</Link>
      <DashHead eyebrow={`${program.title} · Quiz`} title={q.title} lead={`${questions.data.length} questions · pass at ${q.pass_pct}%${left !== null ? ` · ${Math.max(0, left)} attempt${left === 1 ? '' : 's'} left` : ''}`} />
      {q.description && <p className="ds-lead" style={{ marginTop: -10, marginBottom: 18 }}>{q.description}</p>}

      {result && (
        <div className={`cl-result ${result.passed ? 'is-pass' : 'is-fail'}`}>
          <strong>{Math.round(result.score_pct)}%</strong>
          <div><h3>{result.passed ? 'You passed — beautifully done.' : 'Not quite yet.'}</h3>
            <p>{result.needs_review ? 'Your written answers go to your mentor to read.' : result.passed ? 'This quiz counts toward your progress.' : 'Review the lesson and try again.'}</p></div>
          {!result.passed && (left === null || left > 0) && <button className="k-btn k-btn--plum" onClick={retry}><RotateCcw size={16} /> Try again</button>}
        </div>
      )}

      {(!result && (left === null || left > 0)) ? (
        <form className="ds-grid" onSubmit={submit}>
          {questions.data.map((x, i) => (
            <fieldset key={x.id} className="ds-card cl-q">
              <legend><span className="k-num">{String(i + 1).padStart(2, '0')}</span> {x.prompt} <small className="ds-muted">· {x.points} pt{x.points === 1 ? '' : 's'}</small></legend>
              {x.kind === 'text' ? (
                <textarea rows={4} value={answers[x.id] || ''} onChange={(e) => setAnswers({ ...answers, [x.id]: e.target.value })} aria-label="Your answer" />
              ) : (
                <div className="cl-choices">
                  {(x.options || []).map((o, oi) => (
                    <label key={oi} className={`cl-choice ${(answers[x.id] || []).includes(oi) ? 'is-on' : ''}`}>
                      <input type={x.kind === 'single' ? 'radio' : 'checkbox'} name={x.id} checked={(answers[x.id] || []).includes(oi)} onChange={() => pick(x, oi)} />
                      <span>{o}</span>
                    </label>
                  ))}
                  {x.kind === 'multi' && <small className="ds-muted">Choose every answer that applies.</small>}
                </div>
              )}
            </fieldset>
          ))}
          {error && <p className="k-error">{error}</p>}
          <button className="k-btn k-btn--gold k-btn--lg" style={{ justifySelf: 'start' }} disabled={busy || !questions.data.length}><Send size={17} /> {busy ? 'Grading…' : 'Submit answers'}</button>
        </form>
      ) : !result && <div className="ds-banner">You’ve used every attempt for this quiz.</div>}

      {result && (
        <ul className="ds-list ds-section">
          {questions.data.map((x) => {
            const r = result.results?.[x.id];
            return <li key={x.id} className="ds-row">{r === 'correct' ? <Check size={18} color="#17A673" /> : r === 'review' ? <FileText size={18} /> : <X size={18} color="#b42318" />}<div><strong>{x.prompt}</strong><small>{r === 'correct' ? 'Correct' : r === 'review' ? 'Your mentor will read this' : 'Not quite'}</small></div></li>;
          })}
        </ul>
      )}

      {attempts.data.length > 0 && (
        <section className="ds-section"><h2 className="cl-h2">Your attempts</h2>
          <ul className="ds-list">{attempts.data.map((t) => <li key={t.id} className="ds-row"><HelpCircle size={16} /><div><strong>{Math.round(t.score_pct)}%</strong><small>{fmtDateTime(t.created_at)}</small></div><span className={`ds-pill ${t.passed ? 'ds-pill--green' : ''}`}>{t.passed ? 'Passed' : 'Not yet'}</span></li>)}</ul>
        </section>
      )}
    </>
  );
};

// ── Progress & certificates ──────────────────────────────────
export const StudentProgress = () => {
  const { program, user } = useAcademy();
  const sum = useRows(() => supabase.rpc('academy_progress_summary', { p_program: program.id }), [program.id, user?.id], { initial: null });
  const reqs = useRows(() => supabase.from('academy_requirements').select('*').eq('program_id', program.id).order('position'), [program.id]);
  const certs = useRows(() => supabase.from('academy_certificates').select('*').eq('program_id', program.id).eq('user_id', user.id).order('issued_at', { ascending: false }), [program.id, user?.id]);
  const graded = useRows(() => supabase.from('academy_submissions').select('id, title, score, max_score, status, reviewed_at').eq('program_id', program.id).eq('student_id', user.id).eq('status', 'reviewed').order('reviewed_at', { ascending: false }), [program.id, user?.id]);
  const s = sum.data;
  const statuses = reqs.data.map((r) => [r, requirementStatus(r, s)]);
  const met = statuses.filter(([, st]) => st.done).length;
  const overall = reqs.data.length ? pct(met, reqs.data.length)
    : s ? pct(s.lessons_done + s.assignments_passed + s.quizzes_passed, s.lessons_total + s.assignments_total + s.quizzes_total) : 0;

  return (
    <>
      <DashHead eyebrow={program.title} title="Your" accent="progress" lead="How far you’ve come — and what’s left to finish the program." />
      <div className="cl-hero-progress">
        <div className="cl-ring" style={{ '--p': overall }}><strong>{overall}%</strong><small>complete</small></div>
        {s && (
          <div className="cl-hero-progress__bars">
            <Bar value={s.lessons_done} max={s.lessons_total} label={`Lessons · ${s.lessons_done} of ${s.lessons_total}`} />
            <Bar value={s.assignments_passed} max={s.assignments_total} label={`Assignments passed · ${s.assignments_passed} of ${s.assignments_total}`} />
            <Bar value={s.quizzes_passed} max={s.quizzes_total} label={`Quizzes passed · ${s.quizzes_passed} of ${s.quizzes_total}`} />
            <Bar value={s.sessions_attended} max={s.sessions_total} label={`Sessions attended · ${s.sessions_attended} of ${s.sessions_total}`} />
          </div>
        )}
      </div>

      <div className="ds-grid ds-grid--2 ds-section">
        <article className="ds-card">
          <div className="ds-card__head"><h2><Target size={18} /> To finish the program</h2>{reqs.data.length > 0 && <span className="ds-pill">{met}/{reqs.data.length}</span>}</div>
          {statuses.length ? (
            <ul className="cl-reqs">{statuses.map(([r, st]) => (
              <li key={r.id} className={st.done ? 'is-done' : ''}><span>{st.done ? <Check size={14} /> : null} {r.title}{r.description && <small className="ds-muted" style={{ display: 'block' }}>{r.description}</small>}</span>
                <small>{r.kind === 'custom' ? (st.done ? 'Done' : 'Mentor checks') : `${st.have}/${st.need || '—'}`}</small></li>
            ))}</ul>
          ) : <p className="ds-muted">Your mentor hasn’t set completion steps yet. Keep going through your lessons.</p>}
        </article>
        <article className="ds-card">
          <div className="ds-card__head"><h2><Award size={18} /> Certificates</h2></div>
          {certs.data.length ? <ul className="ds-list">{certs.data.map((c) => (
            <li key={c.id}><Link to={`../certificate/${c.id}`} relative="path" className="ds-row cl-cert-row"><Award size={18} /><div><strong>{c.title}</strong><small>Issued {fmtDate(c.issued_at)} · #{c.serial}</small></div><ArrowRight size={16} /></Link></li>
          ))}</ul> : <p className="ds-muted">Your certificate appears here when you complete the program.</p>}
        </article>
      </div>

      {graded.data.length > 0 && (
        <section className="ds-section"><h2 className="cl-h2"><BarChart3 size={18} /> Grades</h2>
          <ul className="ds-list">{graded.data.map((g) => <li key={g.id} className="ds-row"><ClipboardList size={16} /><div><strong>{g.title}</strong><small>{fmtDate(g.reviewed_at)}</small></div>{g.max_score ? <span className="ds-pill ds-pill--green">{scoreLabel(g)}</span> : <span className="ds-pill">Feedback</span>}</li>)}</ul>
        </section>
      )}
    </>
  );
};

/** "Due soon" for the student home: assignments and quizzes still open. */
export const DueSoon = () => {
  const { program, user } = useAcademy();
  const assignments = useRows(() => supabase.from('academy_assignments').select('id, title, due_at').eq('program_id', program.id).eq('is_published', true).order('due_at', { ascending: true, nullsFirst: false }).limit(20), [program.id]);
  const subs = useRows(() => supabase.from('academy_submissions').select('assignment_id, status').eq('program_id', program.id).eq('student_id', user.id), [program.id, user?.id]);
  const quizzes = useRows(() => supabase.from('academy_quizzes').select('id, title').eq('program_id', program.id).eq('is_published', true), [program.id]);
  const passed = useRows(() => supabase.from('academy_quiz_attempts').select('quiz_id').eq('program_id', program.id).eq('user_id', user.id).eq('passed', true), [program.id, user?.id]);
  const open = assignments.data.filter((a) => !subs.data.some((s) => s.assignment_id === a.id && s.status !== 'revise')).slice(0, 4);
  const openQuizzes = quizzes.data.filter((q) => !passed.data.some((p) => p.quiz_id === q.id)).slice(0, 3);
  if (!open.length && !openQuizzes.length) return null;
  return (
    <article className="ds-card">
      <div className="ds-card__head"><h2><CalendarClock size={18} /> Due soon</h2><Link to="assignments" className="k-link">All work</Link></div>
      <ul className="ds-list">
        {open.map((a) => <li key={a.id}><Link to={`assignments/${a.id}`} className="ds-row"><ClipboardList size={17} /><div><strong>{a.title}</strong><small>{a.due_at ? `Due ${fmtDateTime(a.due_at)}` : 'Assignment'}</small></div></Link></li>)}
        {openQuizzes.map((q) => <li key={q.id}><Link to={`quizzes/${q.id}`} className="ds-row"><HelpCircle size={17} /><div><strong>{q.title}</strong><small>Quiz</small></div></Link></li>)}
      </ul>
    </article>
  );
};
