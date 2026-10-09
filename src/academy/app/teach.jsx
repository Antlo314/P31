import React, { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Inbox, Megaphone, Send, Users, ArrowLeft, Plus, Trash2, Pencil, Eye, EyeOff, ClipboardList, Download, Link2,
  ListChecks, X, Check, Award, FileText, Target, UserCheck, StickyNote, BarChart3, HelpCircle, ArrowUp, ArrowDown, ExternalLink, Radio, Video, Upload,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fmtDate, fmtDateTime, fileSize, openFile, uploadAcademyFile } from '../../lib/academy';
import { DashHead, DashEmpty } from '../../apps/DashShell';
import Thread from './Thread';
import { useAcademy, useNow, useRealtime, useRows, write } from './data';
import { Bar, Modal } from './ui';
import { REQ_KINDS, fromLocalInput, pct, requirementStatus, toLocalInput, useRoster } from './helpers';

const SUB_TYPES = [['any', 'File, link or written'], ['file', 'File upload'], ['link', 'Link'], ['text', 'Written answer']];
const ATTEND = [['present', 'Present'], ['late', 'Late'], ['absent', 'Absent'], ['excused', 'Excused']];

// ── Inbox & broadcasts ───────────────────────────────────────
const BroadcastModal = ({ onClose, onSent }) => {
  const { program } = useAcademy();
  const roster = useRoster(program);
  const active = roster.data.filter((r) => ['active', 'past_due'].includes(r.status));
  const [body, setBody] = useState('');
  const [mode, setMode] = useState('all');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const send = async (e) => {
    e.preventDefault();
    if (mode === 'some' && !picked.length) return setError('Choose at least one student.');
    setBusy(true); setError('');
    const { data, error: err } = await write(supabase.rpc('academy_broadcast', { p_program: program.id, p_body: body, p_students: mode === 'all' ? null : picked }));
    setBusy(false);
    if (err) return setError(err);
    setResult(`Sent to ${data} student${data === 1 ? '' : 's'}. Each got it in their private thread.`);
    onSent?.();
  };
  return (
    <Modal title="Message your students" onClose={onClose}>
      {result ? (
        <div className="ds-form"><p>{result}</p><button className="k-btn k-btn--gold" onClick={onClose}>Done</button></div>
      ) : (
        <form className="ds-form" onSubmit={send}>
          <div className="ds-tabs-inline" role="tablist">
            <button type="button" role="tab" aria-selected={mode === 'all'} onClick={() => setMode('all')}>Everyone ({active.length})</button>
            <button type="button" role="tab" aria-selected={mode === 'some'} onClick={() => setMode('some')}>Choose students</button>
          </div>
          {mode === 'some' && (
            <div className="ds-list cl-pick">
              {active.map((r) => (
                <label key={r.user_id} className="ds-row" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" className="ds-check" checked={picked.includes(r.user_id)}
                    onChange={(e) => setPicked(e.target.checked ? [...picked, r.user_id] : picked.filter((x) => x !== r.user_id))} />
                  <div><strong>{r.full_name}</strong><small>{r.email}</small></div>
                </label>
              ))}
            </div>
          )}
          <label className="k-field"><span>Message</span><textarea required rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Encouragement, a reminder, a link…" /></label>
          {error && <p className="k-error">{error}</p>}
          <button className="k-btn k-btn--gold" disabled={busy || !body.trim()}><Send size={16} /> {busy ? 'Sending…' : 'Send privately to each student'}</button>
          <p className="ds-muted">For news everyone should see in one place, post an announcement instead.</p>
        </form>
      )}
    </Modal>
  );
};

export const MentorInbox = () => {
  const { program, user } = useAcademy();
  const { studentId } = useParams();
  const navigate = useNavigate();
  const roster = useRoster(program);
  const inbox = useRows(() => supabase.rpc('academy_inbox', { p_program: program.id }), [program.id]);
  useRealtime('academy_messages', 'program_id', program.id, inbox.reload);
  const [broadcast, setBroadcast] = useState(false);
  const [q, setQ] = useState('');
  const quiet = roster.data.filter((r) => !inbox.data.some((t) => t.student_id === r.user_id));
  const name = (id) => inbox.data.find((t) => t.student_id === id)?.full_name || roster.data.find((r) => r.user_id === id)?.full_name || 'Student';
  const threads = inbox.data.filter((t) => !q || `${t.full_name} ${t.email}`.toLowerCase().includes(q.toLowerCase()));
  const unread = inbox.data.reduce((n, t) => n + (t.unread || 0), 0);

  return (
    <>
      <DashHead eyebrow={`${program.title} · Mentor`} title="Inbox" lead={unread ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'Every private conversation with your students.'}
        actions={<button className="k-btn k-btn--gold" onClick={() => setBroadcast(true)}><Megaphone size={16} /> Message students</button>} />
      <div className={`cl-inbox ${studentId ? 'has-open' : ''}`}>
        <aside className="cl-inbox__list">
          <input className="k-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" aria-label="Search conversations" />
          <ul className="ds-list">
            {threads.map((t) => (
              <li key={t.student_id}>
                <Link to={studentId ? `../${t.student_id}` : t.student_id} relative="path" className={`ds-row cl-convo ${t.student_id === studentId ? 'is-active' : ''}`}>
                  <span className="cl-avatar">{(t.full_name || '?').charAt(0)}</span>
                  <div><strong>{t.full_name}</strong><small>{t.last_from_student ? '' : 'You: '}{t.last_body}</small></div>
                  {t.unread > 0 ? <span className="ds-badge">{t.unread}</span> : <small className="ds-muted">{fmtDate(t.last_at, { month: 'short', day: 'numeric' })}</small>}
                </Link>
              </li>
            ))}
          </ul>
          {!inbox.data.length && <p className="ds-muted">No conversations yet.</p>}
          {quiet.length > 0 && (
            <label className="k-field"><span>Start a conversation</span>
              <select value="" onChange={(e) => e.target.value && navigate(studentId ? `../${e.target.value}` : e.target.value, { relative: 'path' })}>
                <option value="">Choose a student…</option>
                {quiet.map((r) => <option key={r.user_id} value={r.user_id}>{r.full_name}</option>)}
              </select>
            </label>
          )}
        </aside>
        <section className="cl-inbox__thread">
          {studentId ? (
            <>
              <div className="cl-inbox__head">
                <Link to=".." relative="path" className="k-link cl-only-phone"><ArrowLeft size={16} /> All</Link>
                <h2>{name(studentId)}</h2>
                <Link to={`../../students/${studentId}`} relative="path" className="k-link">Profile</Link>
              </div>
              <Thread key={studentId} programId={program.id} studentId={studentId} meId={user?.id} mentorView emptyText="Start the conversation." />
            </>
          ) : <DashEmpty Icon={Inbox} title="Choose a conversation">Pick a student on the left, or message everyone at once.</DashEmpty>}
        </section>
      </div>
      {broadcast && <BroadcastModal onClose={() => setBroadcast(false)} onSent={inbox.reload} />}
    </>
  );
};

// ── Assignments & grading criteria ───────────────────────────
const AssignmentForm = ({ assignment, criteria, presetStudent, onClose, onSaved }) => {
  const { program } = useAcademy();
  const roster = useRoster(program);
  const [assignTo, setAssignTo] = useState(assignment?.assigned_to || (presetStudent ? [presetStudent] : null)); // null = everyone
  const lessons = useRows(() => supabase.from('academy_lessons').select('id, title').eq('program_id', program.id).order('position'), [program.id]);
  const [form, setForm] = useState({
    title: assignment?.title || '', instructions: assignment?.instructions || '', due_at: toLocalInput(assignment?.due_at),
    submission_type: assignment?.submission_type || 'any', pass_pct: assignment?.pass_pct ?? 70, lesson_id: assignment?.lesson_id || '',
    is_published: assignment?.is_published ?? false,
  });
  const [rows, setRows] = useState(criteria.length ? criteria.map((c) => ({ ...c })) : [{ title: 'Completeness', description: 'Every part of the brief is addressed.', max_points: 10 }]);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = rows.reduce((n, r) => n + (Number(r.max_points) || 0), 0);
  const setRow = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i, d) => { const next = [...rows]; const [x] = next.splice(i, 1); next.splice(i + d, 0, x); setRows(next); };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (assignTo && !assignTo.length) throw new Error('Choose at least one student, or give it to everyone.');
      const row = { ...form, due_at: fromLocalInput(form.due_at), pass_pct: Number(form.pass_pct), lesson_id: form.lesson_id || null, assigned_to: assignTo, updated_at: new Date().toISOString() };
      if (file) Object.assign(row, await uploadAcademyFile(program.slug, 'files', file));
      delete row.mime_type;
      const { data, error: err } = await write(assignment
        ? supabase.from('academy_assignments').update(row).eq('id', assignment.id).select('id').single()
        : supabase.from('academy_assignments').insert({ ...row, program_id: program.id, position: Date.now() % 1e9 }).select('id').single());
      if (err) throw new Error(err);
      const id = data.id;
      const keep = rows.filter((r) => r.title.trim());
      const removed = criteria.filter((c) => !keep.some((r) => r.id === c.id)).map((c) => c.id);
      if (removed.length) await write(supabase.from('academy_criteria').delete().in('id', removed));
      const shape = (r, i) => ({ assignment_id: id, program_id: program.id, title: r.title.trim(), description: r.description?.trim() || null, max_points: Number(r.max_points) || 1, position: i });
      const existing = keep.map((r, i) => ({ r, i })).filter(({ r }) => r.id);
      const fresh = keep.map((r, i) => ({ r, i })).filter(({ r }) => !r.id);
      for (const { r, i } of existing) {
        const { error: e2 } = await write(supabase.from('academy_criteria').update(shape(r, i)).eq('id', r.id));
        if (e2) throw new Error(e2);
      }
      if (fresh.length) {
        const { error: e3 } = await write(supabase.from('academy_criteria').insert(fresh.map(({ r, i }) => shape(r, i))));
        if (e3) throw new Error(e3);
      }
      onSaved(); onClose();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <form className="ds-form" onSubmit={save}>
      <label className="k-field"><span>Title</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Write your one-page business plan" /></label>
      <label className="k-field"><span>Instructions (# heading, - bullets, **bold**, links)</span><textarea rows={6} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></label>
      <div className="k-row">
        <label className="k-field"><span>Due</span><input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></label>
        <label className="k-field"><span>Students hand in</span>
          <select value={form.submission_type} onChange={(e) => setForm({ ...form, submission_type: e.target.value })}>{SUB_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
      </div>
      <div className="k-row">
        <label className="k-field"><span>Passing score (%)</span><input type="number" min="0" max="100" value={form.pass_pct} onChange={(e) => setForm({ ...form, pass_pct: e.target.value })} /></label>
        <label className="k-field"><span>Linked lesson (optional)</span>
          <select value={form.lesson_id} onChange={(e) => setForm({ ...form, lesson_id: e.target.value })}>
            <option value="">None</option>{lessons.data.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </label>
      </div>
      <label className="k-field"><span>{assignment?.file_name ? `Attachment: ${assignment.file_name} — choose a file to replace it` : 'Attachment for students (template, worksheet — optional)'}</span>
        <input type="file" onChange={(e) => setFile(e.target.files[0] || null)} />
      </label>

      <div className="cl-criteria">
        <div className="cl-criteria__head"><strong><ListChecks size={17} /> Grading criteria</strong><span className="ds-pill">{total} points</span></div>
        {rows.map((r, i) => (
          <div key={r.id || `new-${i}`} className="cl-criterion">
            <div className="k-row" style={{ gridTemplateColumns: '1fr 110px' }}>
              <input value={r.title} onChange={(e) => setRow(i, { title: e.target.value })} placeholder={`Criterion ${i + 1}`} aria-label="Criterion" />
              <input type="number" min="1" max="1000" value={r.max_points} onChange={(e) => setRow(i, { max_points: e.target.value })} aria-label="Points" />
            </div>
            <input value={r.description || ''} onChange={(e) => setRow(i, { description: e.target.value })} placeholder="What earns full points (optional)" aria-label="Description" />
            <div className="cl-criterion__tools">
              <button type="button" className="k-btn k-btn--icon k-btn--ghost" disabled={!i} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={14} /></button>
              <button type="button" className="k-btn k-btn--icon k-btn--ghost" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={14} /></button>
              <button type="button" className="k-btn k-btn--icon k-btn--ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove criterion"><X size={14} /></button>
            </div>
          </div>
        ))}
        <button type="button" className="k-btn k-btn--sm k-btn--ghost" style={{ justifySelf: 'start' }} onClick={() => setRows([...rows, { title: '', description: '', max_points: 10 }])}><Plus size={15} /> Add criterion</button>
        {!rows.length && <p className="ds-muted">No criteria: you’ll give written feedback only, without a score.</p>}
      </div>

      <div className="k-field"><span>Who gets this</span>
        <div className="ds-tabs-inline" role="tablist">
          <button type="button" role="tab" aria-selected={!assignTo} onClick={() => setAssignTo(null)}>Everyone</button>
          <button type="button" role="tab" aria-selected={!!assignTo} onClick={() => setAssignTo(assignTo || [])}>Chosen students (personal task)</button>
        </div>
        {assignTo && (
          <div className="ds-list cl-pick">
            {roster.data.filter((r) => r.status !== 'expired').map((r) => (
              <label key={r.user_id} className="ds-row" style={{ cursor: 'pointer' }}>
                <input type="checkbox" className="ds-check" checked={assignTo.includes(r.user_id)}
                  onChange={(e) => setAssignTo(e.target.checked ? [...assignTo, r.user_id] : assignTo.filter((x) => x !== r.user_id))} />
                <div><strong>{r.full_name}</strong><small>{r.email}</small></div>
              </label>
            ))}
          </div>
        )}
      </div>
      <label className="ds-row" style={{ cursor: 'pointer' }}><input type="checkbox" className="ds-check" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /><div><strong>Published</strong><small>{assignTo ? 'Only the chosen students see it and get a notification' : 'Students see it and get a notification'}</small></div></label>
      {error && <p className="k-error">{error}</p>}
      <button className="k-btn k-btn--gold" disabled={busy}>{busy ? 'Saving…' : 'Save assignment'}</button>
    </form>
  );
};

export const AssignmentModal = ({ assignment, presetStudent, onClose, onSaved }) => {
  const crit = useRows(() => supabase.from('academy_criteria').select('*').eq('assignment_id', assignment.id).order('position'), [assignment?.id]);
  return (
    <Modal title={assignment ? 'Edit assignment' : 'New assignment'} onClose={onClose} wide>
      {assignment && crit.loading ? <p className="ds-muted">Loading…</p>
        : <AssignmentForm assignment={assignment} criteria={assignment ? crit.data : []} presetStudent={presetStudent} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
};

export const MentorAssignments = () => {
  const { program } = useAcademy();
  const now = useNow();
  const list = useRows(() => supabase.from('academy_assignments').select('*, criteria:academy_criteria(max_points)').eq('program_id', program.id).order('position'), [program.id]);
  const subs = useRows(() => supabase.from('academy_submissions').select('id, assignment_id, status, student_id').eq('program_id', program.id).not('assignment_id', 'is', null), [program.id]);
  const [modal, setModal] = useState(null);
  const toggle = async (a) => { await write(supabase.from('academy_assignments').update({ is_published: !a.is_published }).eq('id', a.id)); list.reload(); };
  const remove = async (a) => { if (window.confirm(`Delete “${a.title}” and its submissions’ scores?`)) { await write(supabase.from('academy_assignments').delete().eq('id', a.id)); list.reload(); } };

  return (
    <>
      <DashHead eyebrow={`${program.title} · Mentor`} title="Assignments" lead="Give real work with clear criteria. Students see the rubric, hand it in, and get scored feedback."
        actions={<button className="k-btn k-btn--gold" onClick={() => setModal('new')}><Plus size={16} /> New assignment</button>} />
      {list.data.length ? (
        <div className="ds-grid ds-grid--2">
          {list.data.map((a) => {
            const mine = subs.data.filter((s) => s.assignment_id === a.id);
            const waiting = mine.filter((s) => s.status === 'submitted').length;
            const handedIn = new Set(mine.map((s) => s.student_id)).size;
            const points = (a.criteria || []).reduce((n, c) => n + c.max_points, 0);
            const late = a.due_at && new Date(a.due_at).getTime() < now;
            return (
              <article key={a.id} className="ds-card">
                <div className="ds-card__head"><h3>{a.title}</h3><span className={`ds-pill ${a.is_published ? 'ds-pill--green' : ''}`}>{a.is_published ? 'Published' : 'Draft'}</span></div>
                {a.assigned_to && <span className="ds-pill ds-pill--gold" style={{ justifySelf: 'start' }}>Personal · {a.assigned_to.length} student{a.assigned_to.length === 1 ? '' : 's'}</span>}
                <p className="ds-muted">{a.due_at ? `${late ? 'Was due' : 'Due'} ${fmtDateTime(a.due_at)}` : 'No due date'} · {points ? `${points} points · pass at ${a.pass_pct}%` : 'Feedback only'}{a.file_name ? ' · attachment' : ''}</p>
                <div className="cl-stats-row">
                  <span><strong>{handedIn}</strong> handed in</span>
                  <span className={waiting ? 'is-hot' : ''}><strong>{waiting}</strong> to grade</span>
                </div>
                <div className="k-actions">
                  <Link to={`../gradebook?assignment=${a.id}`} relative="path" className="k-btn k-btn--sm k-btn--plum"><ClipboardList size={15} /> Grade</Link>
                  <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => setModal({ a })}><Pencil size={15} /> Edit</button>
                  <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => toggle(a)}>{a.is_published ? <><EyeOff size={15} /> Unpublish</> : <><Eye size={15} /> Publish</>}</button>
                  <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => remove(a)} aria-label="Delete"><Trash2 size={15} /></button>
                </div>
              </article>
            );
          })}
        </div>
      ) : <DashEmpty Icon={ClipboardList} title="No assignments yet" action={<button className="k-btn k-btn--gold" onClick={() => setModal('new')}><Plus size={16} /> Create the first one</button>}>
        A business plan, an offer page, a testimony to write — set the criteria and students hand it in here.
      </DashEmpty>}
      {modal === 'new' && <AssignmentModal onClose={() => setModal(null)} onSaved={list.reload} />}
      {modal?.a && <AssignmentModal assignment={modal.a} onClose={() => setModal(null)} onSaved={list.reload} />}
    </>
  );
};

// ── Grading ──────────────────────────────────────────────────
const GradeForm = ({ submission, criteria, scores, onClose, onSaved }) => {
  const [marks, setMarks] = useState(() => Object.fromEntries(criteria.map((c) => {
    const s = scores.find((x) => x.criterion_id === c.id);
    return [c.id, { points: s ? Number(s.points) : '', comment: s?.comment || '' }];
  })));
  const [feedback, setFeedback] = useState(submission.feedback || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const total = criteria.reduce((n, c) => n + (Number(marks[c.id]?.points) || 0), 0);
  const max = criteria.reduce((n, c) => n + c.max_points, 0);

  const save = async (status) => {
    if (status === 'reviewed' && criteria.some((c) => marks[c.id].points === '')) return setError('Score every criterion, or ask for a revision.');
    setBusy(true); setError('');
    const { error: err } = await write(supabase.rpc('academy_grade_submission', {
      p_submission: submission.id, p_feedback: feedback, p_status: status,
      p_scores: criteria.filter((c) => marks[c.id].points !== '').map((c) => ({ criterion_id: c.id, points: Number(marks[c.id].points), comment: marks[c.id].comment })),
    }));
    setBusy(false);
    if (err) return setError(err);
    onSaved(); onClose();
  };

  return (
    <div className="ds-form">
      <div className="cl-submission">
        <p className="ds-muted">Handed in {fmtDateTime(submission.created_at)}</p>
        {submission.body && <div className="cl-submission__body">{submission.body}</div>}
        {submission.note && <p><strong>Note:</strong> {submission.note}</p>}
        <div className="k-actions">
          {submission.file_path && <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => openFile(submission.file_path)}><Download size={15} /> {submission.file_name} {fileSize(submission.size_bytes)}</button>}
          {submission.link_url && <a className="k-btn k-btn--sm k-btn--ghost" href={submission.link_url} target="_blank" rel="noopener noreferrer"><Link2 size={15} /> Open link</a>}
        </div>
      </div>
      {criteria.length > 0 && (
        <div className="cl-criteria">
          <div className="cl-criteria__head"><strong><ListChecks size={17} /> Score</strong><span className="ds-pill ds-pill--gold">{total}/{max} · {pct(total, max)}%</span></div>
          {criteria.map((c) => (
            <div key={c.id} className="cl-criterion">
              <div className="k-row" style={{ gridTemplateColumns: '1fr 120px', alignItems: 'center' }}>
                <div><strong>{c.title}</strong>{c.description && <small className="ds-muted" style={{ display: 'block' }}>{c.description}</small>}</div>
                <label className="cl-points"><input type="number" min="0" max={c.max_points} step="0.5" value={marks[c.id].points}
                  onChange={(e) => setMarks({ ...marks, [c.id]: { ...marks[c.id], points: e.target.value } })} aria-label={`${c.title} points`} /> / {c.max_points}</label>
              </div>
              <input value={marks[c.id].comment} onChange={(e) => setMarks({ ...marks, [c.id]: { ...marks[c.id], comment: e.target.value } })} placeholder="Comment on this criterion (optional)" aria-label="Comment" />
            </div>
          ))}
        </div>
      )}
      <label className="k-field"><span>Overall feedback</span><textarea rows={5} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="What’s strong, what to strengthen, the next step…" /></label>
      {error && <p className="k-error">{error}</p>}
      <div className="k-actions">
        <button className="k-btn k-btn--gold" disabled={busy} onClick={() => save('reviewed')}><Check size={16} /> Return {criteria.length ? 'grade' : 'feedback'}</button>
        <button className="k-btn k-btn--ghost" disabled={busy} onClick={() => save('revise')}>Ask for a revision</button>
      </div>
    </div>
  );
};

const GradeModal = ({ submission, studentName, onClose, onSaved }) => {
  const crit = useRows(() => supabase.from('academy_criteria').select('*').eq('assignment_id', submission.assignment_id).order('position'), [submission.assignment_id]);
  const scores = useRows(() => supabase.from('academy_scores').select('*').eq('submission_id', submission.id), [submission.id]);
  const ready = (!submission.assignment_id || !crit.loading) && !scores.loading;
  return (
    <Modal title={`${submission.title} — ${studentName}`} onClose={onClose} wide>
      {ready ? <GradeForm submission={submission} criteria={submission.assignment_id ? crit.data : []} scores={scores.data} onClose={onClose} onSaved={onSaved} /> : <p className="ds-muted">Loading…</p>}
    </Modal>
  );
};

export const MentorGradebook = () => {
  const { program } = useAcademy();
  const [params, setParams] = useSearchParams();
  const roster = useRoster(program);
  const assignments = useRows(() => supabase.from('academy_assignments').select('id, title, pass_pct, due_at, is_published').eq('program_id', program.id).order('position'), [program.id]);
  const subs = useRows(() => supabase.from('academy_submissions').select('*').eq('program_id', program.id).order('created_at', { ascending: false }), [program.id]);
  const quizzes = useRows(() => supabase.from('academy_quizzes').select('id, title').eq('program_id', program.id).order('position'), [program.id]);
  const attempts = useRows(() => supabase.from('academy_quiz_attempts').select('quiz_id, user_id, score_pct, passed').eq('program_id', program.id), [program.id]);
  const [grading, setGrading] = useState(null);
  const focus = params.get('assignment');
  const shownAssignments = focus ? assignments.data.filter((a) => a.id === focus) : assignments.data;
  const name = (id) => roster.data.find((r) => r.user_id === id)?.full_name || 'Student';
  const latest = (sid, aid) => subs.data.find((s) => s.student_id === sid && s.assignment_id === aid);
  const waiting = subs.data.filter((s) => s.status === 'submitted' && (!focus || s.assignment_id === focus));
  const best = (uid, qid) => attempts.data.filter((x) => x.user_id === uid && x.quiz_id === qid).reduce((m, x) => Math.max(m, Number(x.score_pct)), -1);
  const students = roster.data.filter((r) => r.status !== 'expired');

  const exportCsv = () => {
    const head = ['Student', 'Email', ...assignments.data.map((a) => a.title), ...quizzes.data.map((q) => `Quiz: ${q.title}`)];
    const lines = students.map((r) => [r.full_name, r.email,
      ...assignments.data.map((a) => { const s = latest(r.user_id, a.id); return s ? (s.max_score ? `${pct(Number(s.score), Number(s.max_score))}%` : s.status) : ''; }),
      ...quizzes.data.map((q) => { const b = best(r.user_id, q.id); return b >= 0 ? `${b}%` : ''; })]);
    const csv = [head, ...lines].map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${program.slug}-gradebook.csv`;
    a.click();
  };

  return (
    <>
      <DashHead eyebrow={`${program.title} · Mentor`} title="Gradebook" lead="Everything handed in, scored against your criteria."
        actions={<button className="k-btn k-btn--ghost" onClick={exportCsv}><Download size={16} /> Export CSV</button>} />
      {focus && <p style={{ marginTop: -10 }}><button className="k-link" onClick={() => setParams({})}><ArrowLeft size={15} /> All assignments</button></p>}

      <section>
        <h2 className="cl-h2">Waiting for you {waiting.length > 0 && <span className="ds-badge">{waiting.length}</span>}</h2>
        {waiting.length ? (
          <ul className="ds-list">
            {waiting.map((s) => (
              <li key={s.id}><button className="ds-row" onClick={() => setGrading(s)}>
                <FileText size={18} /><div><strong>{s.title}</strong><small>{name(s.student_id)} · {fmtDateTime(s.created_at)}{s.assignment_id ? '' : ' · general work'}</small></div>
                <span className="ds-pill ds-pill--gold">Grade</span>
              </button></li>
            ))}
          </ul>
        ) : <p className="ds-muted">You’re all caught up.</p>}
      </section>

      <section className="ds-section">
        <h2 className="cl-h2">All grades</h2>
        {students.length && (shownAssignments.length || quizzes.data.length) ? (
          <div className="cl-table-wrap">
            <table className="cl-table">
              <thead><tr><th>Student</th>{shownAssignments.map((a) => <th key={a.id}>{a.title}</th>)}{!focus && quizzes.data.map((q) => <th key={q.id}><HelpCircle size={13} /> {q.title}</th>)}</tr></thead>
              <tbody>
                {students.map((r) => (
                  <tr key={r.user_id}>
                    <th scope="row"><Link to={`../students/${r.user_id}`} relative="path">{r.full_name}</Link></th>
                    {shownAssignments.map((a) => {
                      const s = latest(r.user_id, a.id);
                      if (!s) return <td key={a.id} className="is-empty">—</td>;
                      const p = s.max_score ? pct(Number(s.score), Number(s.max_score)) : null;
                      const cls = s.status === 'submitted' ? 'is-todo' : s.status === 'revise' ? 'is-revise' : p !== null && p < a.pass_pct ? 'is-low' : 'is-done';
                      return (
                        <td key={a.id} className={cls}>
                          <button onClick={() => setGrading(s)}>{s.status === 'submitted' ? 'Grade' : s.status === 'revise' ? 'Revising' : p !== null ? `${p}%` : '✓'}</button>
                        </td>
                      );
                    })}
                    {!focus && quizzes.data.map((q) => { const b = best(r.user_id, q.id); return <td key={q.id} className={b < 0 ? 'is-empty' : 'is-done'}>{b >= 0 ? `${Math.round(b)}%` : '—'}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <DashEmpty Icon={BarChart3} title="Nothing to grade yet">Grades appear once you have students and assignments or quizzes.</DashEmpty>}
      </section>
      {grading && <GradeModal submission={grading} studentName={name(grading.student_id)} onClose={() => setGrading(null)} onSaved={subs.reload} />}
    </>
  );
};

// ── Quizzes ──────────────────────────────────────────────────
const blankQuestion = () => ({ prompt: '', kind: 'single', options: ['', ''], correct: [0], points: 1 });

const QuizForm = ({ quiz, questions, keys, onClose, onSaved }) => {
  const { program } = useAcademy();
  const lessons = useRows(() => supabase.from('academy_lessons').select('id, title').eq('program_id', program.id).order('position'), [program.id]);
  const [form, setForm] = useState({ title: quiz?.title || '', description: quiz?.description || '', pass_pct: quiz?.pass_pct ?? 70,
    max_attempts: quiz?.max_attempts ?? '', lesson_id: quiz?.lesson_id || '', is_published: quiz?.is_published ?? false });
  const [qs, setQs] = useState(questions.length
    ? questions.map((q) => ({ ...q, options: q.options || [], correct: keys.find((k) => k.question_id === q.id)?.correct || [] }))
    : [blankQuestion()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const setQ = (i, patch) => setQs(qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const toggleCorrect = (i, o) => {
    const q = qs[i];
    if (q.kind === 'single') return setQ(i, { correct: [o] });
    setQ(i, { correct: q.correct.includes(o) ? q.correct.filter((x) => x !== o) : [...q.correct, o] });
  };

  const save = async (e) => {
    e.preventDefault();
    const keep = qs.filter((q) => q.prompt.trim());
    for (const q of keep) {
      if (q.kind !== 'text' && (q.options.filter((o) => o.trim()).length < 2 || !q.correct.length)) return setError(`“${q.prompt.slice(0, 40)}” needs at least two options and a correct answer.`);
    }
    setBusy(true); setError('');
    try {
      const row = { ...form, pass_pct: Number(form.pass_pct), max_attempts: form.max_attempts ? Number(form.max_attempts) : null, lesson_id: form.lesson_id || null };
      const { data, error: err } = await write(quiz
        ? supabase.from('academy_quizzes').update(row).eq('id', quiz.id).select('id').single()
        : supabase.from('academy_quizzes').insert({ ...row, program_id: program.id, position: Date.now() % 1e9 }).select('id').single());
      if (err) throw new Error(err);
      const removed = questions.filter((q) => !keep.some((k) => k.id === q.id)).map((q) => q.id);
      if (removed.length) await write(supabase.from('academy_quiz_questions').delete().in('id', removed));
      for (const [i, q] of keep.entries()) {
        const options = q.kind === 'text' ? [] : q.options.map((o) => o.trim()).filter(Boolean);
        const shape = { quiz_id: data.id, program_id: program.id, prompt: q.prompt.trim(), kind: q.kind, options, points: Number(q.points) || 1, position: i };
        const res = q.id
          ? await write(supabase.from('academy_quiz_questions').update(shape).eq('id', q.id).select('id').single())
          : await write(supabase.from('academy_quiz_questions').insert(shape).select('id').single());
        if (res.error) throw new Error(res.error);
        if (q.kind !== 'text') {
          const { error: kErr } = await write(supabase.from('academy_quiz_keys').upsert({ question_id: res.data.id, program_id: program.id, correct: q.correct.filter((c) => c < options.length) }));
          if (kErr) throw new Error(kErr);
        }
      }
      onSaved(); onClose();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <form className="ds-form" onSubmit={save}>
      <label className="k-field"><span>Title</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Module 1 check-in" /></label>
      <label className="k-field"><span>Description (optional)</span><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
      <div className="k-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <label className="k-field"><span>Pass at (%)</span><input type="number" min="0" max="100" value={form.pass_pct} onChange={(e) => setForm({ ...form, pass_pct: e.target.value })} /></label>
        <label className="k-field"><span>Attempts allowed</span><input type="number" min="1" value={form.max_attempts} onChange={(e) => setForm({ ...form, max_attempts: e.target.value })} placeholder="Unlimited" /></label>
        <label className="k-field"><span>Linked lesson</span>
          <select value={form.lesson_id} onChange={(e) => setForm({ ...form, lesson_id: e.target.value })}><option value="">None</option>{lessons.data.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>
        </label>
      </div>

      {qs.map((q, i) => (
        <div key={q.id || `n${i}`} className="cl-question">
          <div className="cl-question__head">
            <strong>Question {i + 1}</strong>
            <select value={q.kind} onChange={(e) => setQ(i, { kind: e.target.value, correct: e.target.value === 'single' ? q.correct.slice(0, 1) : q.correct })} aria-label="Question type">
              <option value="single">One answer</option><option value="multi">Several answers</option><option value="text">Written (you review)</option>
            </select>
            <input type="number" min="1" max="100" value={q.points} onChange={(e) => setQ(i, { points: e.target.value })} aria-label="Points" style={{ width: 70 }} />
            <button type="button" className="k-btn k-btn--icon k-btn--ghost" onClick={() => setQs(qs.filter((_, j) => j !== i))} aria-label="Remove question"><Trash2 size={14} /></button>
          </div>
          <textarea rows={2} value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} placeholder="Ask your question" aria-label="Question" />
          {q.kind !== 'text' && (
            <div className="cl-options">
              {q.options.map((o, oi) => (
                <div key={oi} className="cl-option">
                  <input type={q.kind === 'single' ? 'radio' : 'checkbox'} checked={q.correct.includes(oi)} onChange={() => toggleCorrect(i, oi)} aria-label="Correct answer" title="Correct answer" />
                  <input value={o} onChange={(e) => setQ(i, { options: q.options.map((x, j) => (j === oi ? e.target.value : x)) })} placeholder={`Option ${oi + 1}`} aria-label={`Option ${oi + 1}`} />
                  <button type="button" className="k-btn k-btn--icon k-btn--ghost" onClick={() => setQ(i, { options: q.options.filter((_, j) => j !== oi), correct: q.correct.filter((c) => c !== oi).map((c) => (c > oi ? c - 1 : c)) })} aria-label="Remove option"><X size={13} /></button>
                </div>
              ))}
              <button type="button" className="k-btn k-btn--sm k-btn--ghost" style={{ justifySelf: 'start' }} onClick={() => setQ(i, { options: [...q.options, ''] })}><Plus size={14} /> Option</button>
              <small className="ds-muted">Tick the correct answer{q.kind === 'multi' ? 's' : ''}. Students never see the key.</small>
            </div>
          )}
        </div>
      ))}
      <button type="button" className="k-btn k-btn--sm k-btn--ghost" style={{ justifySelf: 'start' }} onClick={() => setQs([...qs, blankQuestion()])}><Plus size={15} /> Add question</button>
      <label className="ds-row" style={{ cursor: 'pointer' }}><input type="checkbox" className="ds-check" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /><div><strong>Published</strong><small>Students can take it</small></div></label>
      {error && <p className="k-error">{error}</p>}
      <button className="k-btn k-btn--gold" disabled={busy}>{busy ? 'Saving…' : 'Save quiz'}</button>
    </form>
  );
};

const QuizModal = ({ quiz, onClose, onSaved }) => {
  const questions = useRows(() => supabase.from('academy_quiz_questions').select('*').eq('quiz_id', quiz.id).order('position'), [quiz?.id]);
  const keys = useRows(() => supabase.from('academy_quiz_keys').select('*').in('question_id', questions.data.map((q) => q.id)), [quiz?.id, questions.data.length || null]);
  const ready = !quiz || (!questions.loading && (!questions.data.length || !keys.loading));
  return (
    <Modal title={quiz ? 'Edit quiz' : 'New quiz'} onClose={onClose} wide>
      {ready ? <QuizForm quiz={quiz} questions={quiz ? questions.data : []} keys={quiz ? keys.data : []} onClose={onClose} onSaved={onSaved} /> : <p className="ds-muted">Loading…</p>}
    </Modal>
  );
};

const QuizResults = ({ quiz, onClose }) => {
  const { program } = useAcademy();
  const roster = useRoster(program);
  const questions = useRows(() => supabase.from('academy_quiz_questions').select('id, prompt, kind').eq('quiz_id', quiz.id).order('position'), [quiz.id]);
  const attempts = useRows(() => supabase.from('academy_quiz_attempts').select('*').eq('quiz_id', quiz.id).order('created_at', { ascending: false }), [quiz.id]);
  const name = (id) => roster.data.find((r) => r.user_id === id)?.full_name || 'Student';
  const written = questions.data.filter((q) => q.kind === 'text');
  return (
    <Modal title={`Results — ${quiz.title}`} onClose={onClose} wide>
      {attempts.data.length ? (
        <ul className="ds-list">
          {attempts.data.map((a) => (
            <li key={a.id} className="ds-card" style={{ padding: 14 }}>
              <div className="ds-card__head"><strong>{name(a.user_id)}</strong><span className={`ds-pill ${a.passed ? 'ds-pill--green' : 'ds-pill--red'}`}>{Math.round(a.score_pct)}% · {a.passed ? 'Passed' : 'Not yet'}</span></div>
              <small className="ds-muted">{fmtDateTime(a.created_at)}{a.needs_review ? ' · has written answers' : ''}</small>
              {written.map((q) => a.answers?.[q.id] ? <div key={q.id}><strong style={{ fontSize: '0.86rem' }}>{q.prompt}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{a.answers[q.id]}</p></div> : null)}
            </li>
          ))}
        </ul>
      ) : <p className="ds-muted">No one has taken this quiz yet.</p>}
    </Modal>
  );
};

export const MentorQuizzes = () => {
  const { program } = useAcademy();
  const list = useRows(() => supabase.from('academy_quizzes').select('*, questions:academy_quiz_questions(id)').eq('program_id', program.id).order('position'), [program.id]);
  const attempts = useRows(() => supabase.from('academy_quiz_attempts').select('quiz_id, score_pct, passed').eq('program_id', program.id), [program.id]);
  const [modal, setModal] = useState(null);
  const toggle = async (q) => { await write(supabase.from('academy_quizzes').update({ is_published: !q.is_published }).eq('id', q.id)); list.reload(); };
  const remove = async (q) => { if (window.confirm(`Delete “${q.title}” and all attempts?`)) { await write(supabase.from('academy_quizzes').delete().eq('id', q.id)); list.reload(); } };
  return (
    <>
      <DashHead eyebrow={`${program.title} · Mentor`} title="Quizzes" lead="Quick knowledge checks, graded instantly. Written answers come to you to read."
        actions={<button className="k-btn k-btn--gold" onClick={() => setModal('new')}><Plus size={16} /> New quiz</button>} />
      {list.data.length ? (
        <div className="ds-grid ds-grid--2">
          {list.data.map((q) => {
            const mine = attempts.data.filter((a) => a.quiz_id === q.id);
            const avg = mine.length ? Math.round(mine.reduce((n, a) => n + Number(a.score_pct), 0) / mine.length) : null;
            return (
              <article key={q.id} className="ds-card">
                <div className="ds-card__head"><h3>{q.title}</h3><span className={`ds-pill ${q.is_published ? 'ds-pill--green' : ''}`}>{q.is_published ? 'Published' : 'Draft'}</span></div>
                <p className="ds-muted">{q.questions?.length || 0} questions · pass at {q.pass_pct}% · {q.max_attempts ? `${q.max_attempts} attempt${q.max_attempts === 1 ? '' : 's'}` : 'unlimited attempts'}</p>
                <div className="cl-stats-row"><span><strong>{mine.length}</strong> attempts</span><span><strong>{avg ?? '—'}{avg !== null ? '%' : ''}</strong> average</span><span><strong>{mine.filter((a) => a.passed).length}</strong> passed</span></div>
                <div className="k-actions">
                  <button className="k-btn k-btn--sm k-btn--plum" onClick={() => setModal({ results: q })}><BarChart3 size={15} /> Results</button>
                  <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => setModal({ q })}><Pencil size={15} /> Edit</button>
                  <button className="k-btn k-btn--sm k-btn--ghost" onClick={() => toggle(q)}>{q.is_published ? <><EyeOff size={15} /> Unpublish</> : <><Eye size={15} /> Publish</>}</button>
                  <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => remove(q)} aria-label="Delete"><Trash2 size={15} /></button>
                </div>
              </article>
            );
          })}
        </div>
      ) : <DashEmpty Icon={HelpCircle} title="No quizzes yet" action={<button className="k-btn k-btn--gold" onClick={() => setModal('new')}><Plus size={16} /> Create a quiz</button>}>Check understanding after a lesson — multiple choice is graded for you.</DashEmpty>}
      {modal === 'new' && <QuizModal onClose={() => setModal(null)} onSaved={list.reload} />}
      {modal?.q && <QuizModal quiz={modal.q} onClose={() => setModal(null)} onSaved={list.reload} />}
      {modal?.results && <QuizResults quiz={modal.results} onClose={() => setModal(null)} />}
    </>
  );
};

// ── Completion: requirements, progress, certificates ─────────
const useSummaries = (program, roster) => useRows(
  async () => {
    const rows = await Promise.all(roster.map((r) => supabase.rpc('academy_progress_summary', { p_program: program.id, p_user: r.user_id })
      .then(({ data }) => [r.user_id, data])));
    return { data: Object.fromEntries(rows), error: null };
  },
  [program.id, roster.map((r) => r.user_id).join(',') || null],
  { initial: {} },
);

const CertificateModal = ({ student, onClose, onSaved }) => {
  const { program } = useAcademy();
  const [form, setForm] = useState({ title: 'Certificate of Completion', recipient_name: student.full_name, note: '' });
  const [error, setError] = useState('');
  const issue = async (e) => {
    e.preventDefault();
    const { error: err } = await write(supabase.from('academy_certificates').insert({ ...form, note: form.note || null, program_id: program.id, user_id: student.user_id }));
    if (err) return setError(err);
    onSaved(); onClose();
  };
  return (
    <Modal title={`Certificate for ${student.full_name}`} onClose={onClose}>
      <form className="ds-form" onSubmit={issue}>
        <label className="k-field"><span>Certificate title</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <label className="k-field"><span>Name as it appears</span><input required value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} /></label>
        <label className="k-field"><span>Line of honor (optional)</span><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. With distinction" /></label>
        {error && <p className="k-error">{error}</p>}
        <button className="k-btn k-btn--gold"><Award size={16} /> Issue certificate</button>
        <p className="ds-muted">The student is notified and can view, print and share it. Anyone can verify it by its serial number.</p>
      </form>
    </Modal>
  );
};

export const MentorCompletion = () => {
  const { program } = useAcademy();
  const roster = useRoster(program);
  const students = roster.data.filter((r) => r.status !== 'expired');
  const reqs = useRows(() => supabase.from('academy_requirements').select('*').eq('program_id', program.id).order('position'), [program.id]);
  const certs = useRows(() => supabase.from('academy_certificates').select('*').eq('program_id', program.id).order('issued_at', { ascending: false }), [program.id]);
  const sums = useSummaries(program, students);
  const [form, setForm] = useState({ title: '', kind: 'lessons', target: '', description: '' });
  const [cert, setCert] = useState(null);

  const add = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await write(supabase.from('academy_requirements').insert({ ...form, title: form.title.trim(), target: form.target ? Number(form.target) : null, description: form.description || null, program_id: program.id, position: reqs.data.length }));
    setForm({ title: '', kind: 'lessons', target: '', description: '' }); reqs.reload();
  };
  const remove = async (r) => { if (window.confirm(`Remove “${r.title}”?`)) { await write(supabase.from('academy_requirements').delete().eq('id', r.id)); reqs.reload(); } };
  const check = async (req, uid, on) => {
    await write(on ? supabase.from('academy_requirement_checks').insert({ requirement_id: req.id, user_id: uid, program_id: program.id })
      : supabase.from('academy_requirement_checks').delete().eq('requirement_id', req.id).eq('user_id', uid));
    sums.reload();
  };

  return (
    <>
      <DashHead eyebrow={`${program.title} · Mentor`} title="Completion &" accent="certificates" lead="Set what finishing the program means, watch each student’s progress, and honor them when they get there." />
      <div className="ds-grid ds-grid--2">
        <article className="ds-card">
          <div className="ds-card__head"><h2><Target size={18} /> Requirements</h2></div>
          {reqs.data.length ? (
            <ul className="ds-list">{reqs.data.map((r) => (
              <li key={r.id} className="ds-row"><Check size={17} /><div><strong>{r.title}</strong><small>{REQ_KINDS.find(([k]) => k === r.kind)?.[1]}{r.target ? ` · ${r.target}` : r.kind !== 'custom' ? ' · all' : ''}{r.description ? ` · ${r.description}` : ''}</small></div>
                <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => remove(r)} aria-label="Remove"><Trash2 size={14} /></button></li>
            ))}</ul>
          ) : <p className="ds-muted">No requirements yet — add the milestones that make up a finished program.</p>}
        </article>
        <form className="ds-card ds-form" onSubmit={add}>
          <h2 style={{ margin: 0 }}><Plus size={18} /> Add a requirement</h2>
          <label className="k-field"><span>Title</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Finish every lesson" /></label>
          <div className="k-row">
            <label className="k-field"><span>Type</span><select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{REQ_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            {form.kind !== 'custom' && <label className="k-field"><span>How many</span><input type="number" min="1" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="All" /></label>}
          </div>
          <label className="k-field"><span>Details (optional)</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <button className="k-btn k-btn--gold k-btn--sm" style={{ justifySelf: 'start' }}><Plus size={15} /> Add</button>
        </form>
      </div>

      <section className="ds-section">
        <h2>Student progress</h2>
        {students.length ? (
          <div className="ds-grid">
            {students.map((s) => {
              const sum = sums.data[s.user_id];
              const statuses = reqs.data.map((r) => [r, requirementStatus(r, sum)]);
              const met = statuses.filter(([, st]) => st.done).length;
              const theirs = certs.data.filter((c) => c.user_id === s.user_id);
              return (
                <article key={s.user_id} className="ds-card">
                  <div className="ds-card__head">
                    <h3><Link to={`../students/${s.user_id}`} relative="path">{s.full_name}</Link></h3>
                    {reqs.data.length > 0 && <span className={`ds-pill ${met === reqs.data.length ? 'ds-pill--green' : ''}`}>{met}/{reqs.data.length} met</span>}
                  </div>
                  {sum ? (
                    <div className="cl-mini-stats">
                      <span>Lessons <strong>{sum.lessons_done}/{sum.lessons_total}</strong></span>
                      <span>Assignments <strong>{sum.assignments_passed}/{sum.assignments_total}</strong></span>
                      <span>Quizzes <strong>{sum.quizzes_passed}/{sum.quizzes_total}</strong></span>
                      <span>Sessions <strong>{sum.sessions_attended}/{sum.sessions_total}</strong></span>
                    </div>
                  ) : <p className="ds-muted">Loading…</p>}
                  {statuses.length > 0 && (
                    <ul className="cl-reqs">
                      {statuses.map(([r, st]) => (
                        <li key={r.id} className={st.done ? 'is-done' : ''}>
                          {r.kind === 'custom'
                            ? <label><input type="checkbox" checked={st.done} onChange={(e) => check(r, s.user_id, e.target.checked)} /> {r.title}</label>
                            : <><span>{st.done ? <Check size={14} /> : null} {r.title}</span><small>{st.have}/{st.need || '—'}</small></>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="k-actions">
                    <button className="k-btn k-btn--sm k-btn--gold" onClick={() => setCert(s)}><Award size={15} /> Issue certificate</button>
                    {theirs.map((c) => <Link key={c.id} to={`../../certificate/${c.id}`} relative="path" className="k-btn k-btn--sm k-btn--ghost"><ExternalLink size={14} /> {c.title}</Link>)}
                  </div>
                </article>
              );
            })}
          </div>
        ) : <DashEmpty Icon={Users} title="No students yet">Progress shows up here once students enroll.</DashEmpty>}
      </section>
      {cert && <CertificateModal student={cert} onClose={() => setCert(null)} onSaved={certs.reload} />}
    </>
  );
};

// ── Attendance ───────────────────────────────────────────────
export const AttendanceModal = ({ session, onClose }) => {
  const { program } = useAcademy();
  const roster = useRoster(program);
  const rows = useRows(() => supabase.from('academy_attendance').select('*').eq('session_id', session.id), [session.id]);
  const people = roster.data.filter((r) => (session.student_id ? r.user_id === session.student_id : r.status !== 'expired'));
  const [marks, setMarks] = useState({});
  const [saved, setSaved] = useState(false);
  const value = (uid) => marks[uid] ?? rows.data.find((x) => x.user_id === uid)?.status ?? '';
  const save = async () => {
    const list = people.filter((p) => value(p.user_id)).map((p) => ({ session_id: session.id, user_id: p.user_id, program_id: program.id, status: value(p.user_id), marked_at: new Date().toISOString() }));
    if (list.length) await write(supabase.from('academy_attendance').upsert(list));
    setSaved(true); rows.reload();
  };
  return (
    <Modal title={`Attendance — ${session.title}`} onClose={onClose}>
      <p className="ds-muted">{fmtDateTime(session.starts_at)}</p>
      {people.length ? (
        <div className="ds-list">
          {people.map((p) => (
            <div key={p.user_id} className="ds-row cl-attend">
              <UserCheck size={17} /><div><strong>{p.full_name}</strong></div>
              <div className="cl-seg" role="radiogroup" aria-label={`${p.full_name} attendance`}>
                {ATTEND.map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={value(p.user_id) === v} className={value(p.user_id) === v ? `is-${v}` : ''}
                    onClick={() => { setMarks({ ...marks, [p.user_id]: v }); setSaved(false); }}>{l}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : <p className="ds-muted">No students to mark.</p>}
      <div className="k-actions" style={{ marginTop: 14 }}>
        <button className="k-btn k-btn--gold" onClick={save}>{saved ? <><Check size={16} /> Saved</> : 'Save attendance'}</button>
        <button className="k-btn k-btn--ghost" onClick={() => { setMarks(Object.fromEntries(people.map((p) => [p.user_id, 'present']))); setSaved(false); }}>Everyone present</button>
      </div>
    </Modal>
  );
};

// ── On a student's page: progress and private notes ──────────
export const StudentProgressPanel = ({ studentId }) => {
  const { program } = useAcademy();
  const sum = useRows(() => supabase.rpc('academy_progress_summary', { p_program: program.id, p_user: studentId }), [program.id, studentId], { initial: null });
  const reqs = useRows(() => supabase.from('academy_requirements').select('*').eq('program_id', program.id).order('position'), [program.id]);
  const attempts = useRows(() => supabase.from('academy_quiz_attempts').select('*, quiz:academy_quizzes(title)').eq('program_id', program.id).eq('user_id', studentId).order('created_at', { ascending: false }).limit(20), [program.id, studentId]);
  const attendance = useRows(() => supabase.from('academy_attendance').select('status, session:academy_sessions(title, starts_at)').eq('program_id', program.id).eq('user_id', studentId), [program.id, studentId]);
  const certs = useRows(() => supabase.from('academy_certificates').select('*').eq('program_id', program.id).eq('user_id', studentId), [program.id, studentId]);
  const s = sum.data;
  return (
    <div className="ds-grid ds-grid--2">
      <article className="ds-card">
        <div className="ds-card__head"><h3><BarChart3 size={17} /> Progress</h3></div>
        {s ? <>
          <Bar value={s.lessons_done} max={s.lessons_total} label={`Lessons ${s.lessons_done}/${s.lessons_total}`} />
          <Bar value={s.assignments_passed} max={s.assignments_total} label={`Assignments passed ${s.assignments_passed}/${s.assignments_total}`} />
          <Bar value={s.quizzes_passed} max={s.quizzes_total} label={`Quizzes passed ${s.quizzes_passed}/${s.quizzes_total}`} />
          <Bar value={s.sessions_attended} max={s.sessions_total} label={`Sessions attended ${s.sessions_attended}/${s.sessions_total}`} />
        </> : <p className="ds-muted">Loading…</p>}
        {reqs.data.length > 0 && s && (
          <ul className="cl-reqs">{reqs.data.map((r) => { const st = requirementStatus(r, s); return <li key={r.id} className={st.done ? 'is-done' : ''}><span>{st.done ? <Check size={14} /> : null} {r.title}</span><small>{r.kind === 'custom' ? (st.done ? 'checked' : '—') : `${st.have}/${st.need || '—'}`}</small></li>; })}</ul>
        )}
        {certs.data.map((c) => <Link key={c.id} to={`../../../certificate/${c.id}`} relative="path" className="k-link"><Award size={15} /> {c.title} · {fmtDate(c.issued_at)}</Link>)}
      </article>
      <article className="ds-card">
        <div className="ds-card__head"><h3><HelpCircle size={17} /> Quizzes & attendance</h3></div>
        {attempts.data.length ? <ul className="ds-list">{attempts.data.map((a) => <li key={a.id} className="ds-row"><HelpCircle size={16} /><div><strong>{a.quiz?.title}</strong><small>{fmtDateTime(a.created_at)}</small></div><span className={`ds-pill ${a.passed ? 'ds-pill--green' : 'ds-pill--red'}`}>{Math.round(a.score_pct)}%</span></li>)}</ul> : <p className="ds-muted">No quiz attempts.</p>}
        {attendance.data.length > 0 && <ul className="ds-list">{attendance.data.map((a, i) => <li key={i} className="ds-row"><UserCheck size={16} /><div><strong>{a.session?.title}</strong><small>{a.session ? fmtDateTime(a.session.starts_at) : ''}</small></div><span className="ds-pill">{a.status}</span></li>)}</ul>}
      </article>
    </div>
  );
};

export const StudentNotes = ({ studentId }) => {
  const { program } = useAcademy();
  const notes = useRows(() => supabase.from('academy_student_notes').select('*').eq('program_id', program.id).eq('student_id', studentId).order('created_at', { ascending: false }), [program.id, studentId]);
  const [body, setBody] = useState('');
  const add = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    await write(supabase.from('academy_student_notes').insert({ program_id: program.id, student_id: studentId, body: body.trim() }));
    setBody(''); notes.reload();
  };
  return (
    <div style={{ maxWidth: 820 }} className="ds-grid">
      <form className="ds-card ds-form" onSubmit={add}>
        <label className="k-field"><span><StickyNote size={14} /> Private note (only mentors see these)</span><textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Goals she shared, prayer requests, what to follow up on…" /></label>
        <button className="k-btn k-btn--plum k-btn--sm" style={{ justifySelf: 'start' }} disabled={!body.trim()}><Plus size={15} /> Save note</button>
      </form>
      {notes.data.map((n) => (
        <article key={n.id} className="ds-card">
          <p style={{ whiteSpace: 'pre-wrap' }}>{n.body}</p>
          <div className="ds-card__head"><small className="ds-muted">{fmtDateTime(n.created_at)}</small>
            <button className="k-btn k-btn--icon k-btn--ghost" onClick={async () => { await write(supabase.from('academy_student_notes').delete().eq('id', n.id)); notes.reload(); }} aria-label="Delete note"><Trash2 size={14} /></button></div>
        </article>
      ))}
    </div>
  );
};

/** Overview tile row for the mentor home. */
export const MentorPulse = () => {
  const { program } = useAcademy();
  const inbox = useRows(() => supabase.rpc('academy_inbox', { p_program: program.id }), [program.id]);
  const assignments = useRows(() => supabase.from('academy_assignments').select('id', { count: 'exact', head: false }).eq('program_id', program.id).eq('is_published', true), [program.id]);
  const quizzes = useRows(() => supabase.from('academy_quizzes').select('id').eq('program_id', program.id).eq('is_published', true), [program.id]);
  const threads = useRows(() => supabase.from('academy_threads').select('id').eq('program_id', program.id), [program.id]);
  const unread = inbox.data.reduce((n, t) => n + (t.unread || 0), 0);
  return (
    <div className="ds-grid ds-grid--4 ds-section">
      <Link to="inbox" className="ds-stat"><strong>{unread}</strong><span>Unread in your inbox</span></Link>
      <Link to="assignments" className="ds-stat"><strong>{assignments.data.length}</strong><span>Published assignments</span></Link>
      <Link to="quizzes" className="ds-stat"><strong>{quizzes.data.length}</strong><span>Published quizzes</span></Link>
      <Link to="discussions" className="ds-stat"><strong>{threads.data.length}</strong><span>Discussions</span></Link>
    </div>
  );
};


// ── Live calls: start one now, and the report afterwards ─────
const fnInvoke = async (fn, body) => {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context?.json())?.error || msg; } catch { /* keep message */ }
    return { error: msg };
  }
  return data;
};

/** "Go live now": an instant live class for everyone, chosen students, or one student. */
export const GoLiveModal = ({ studentId, onClose }) => {
  const { program } = useAcademy();
  const navigate = useNavigate();
  const roster = useRoster(program);
  const active = roster.data.filter((r) => ['active', 'past_due'].includes(r.status));
  const one = studentId ? roster.data.find((r) => r.user_id === studentId) : null;
  const [form, setForm] = useState({ title: studentId ? '1:1 call' : `Live with your mentor`, minutes: 60, record: false });
  const [who, setWho] = useState(studentId ? 'one' : 'all');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const start = async (e) => {
    e.preventDefault();
    if (who === 'some' && !picked.length) return setError('Choose at least one student.');
    setBusy(true); setError('');
    const row = {
      program_id: program.id, title: form.title.trim() || 'Live class', starts_at: new Date().toISOString(),
      duration_minutes: Number(form.minutes), is_instant: true, record: form.record,
      student_id: who === 'one' ? studentId : null, invitees: who === 'some' ? picked : null,
    };
    const { data, error: err } = await write(supabase.from('academy_sessions').insert(row).select('id').single());
    if (err) { setBusy(false); return setError(err); }
    const res = await fnInvoke('daily-room', { action: 'create', session_id: data.id });
    if (res?.error) {
      await supabase.from('academy_sessions').delete().eq('id', data.id); // don't leave an empty class behind
      setBusy(false);
      return setError(`The room didn’t open: ${res.error}`);
    }
    if (res?.note) window.alert(res.note);
    navigate(`/academy/${program.slug}/live/${data.id}`);
  };

  return (
    <Modal title={one ? `Call ${one.full_name} now` : 'Go live now'} onClose={onClose}>
      <form className="ds-form" onSubmit={start}>
        <label className="k-field"><span>What’s it called?</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        {!studentId && (
          <div className="k-field"><span>Who’s invited</span>
            <div className="ds-tabs-inline" role="tablist">
              <button type="button" role="tab" aria-selected={who === 'all'} onClick={() => setWho('all')}>Everyone ({active.length})</button>
              <button type="button" role="tab" aria-selected={who === 'some'} onClick={() => setWho('some')}>Choose students</button>
            </div>
            {who === 'some' && (
              <div className="ds-list cl-pick">
                {active.map((r) => (
                  <label key={r.user_id} className="ds-row" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" className="ds-check" checked={picked.includes(r.user_id)}
                      onChange={(e) => setPicked(e.target.checked ? [...picked, r.user_id] : picked.filter((x) => x !== r.user_id))} />
                    <div><strong>{r.full_name}</strong><small>{r.email}</small></div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        <label className="k-field"><span>About how long</span>
          <select value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })}>{[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}</select>
        </label>
        <label className="ds-row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" className="ds-check" checked={form.record} onChange={(e) => setForm({ ...form, record: e.target.checked })} />
          <div><strong>Allow recording</strong><small>You’ll get a Record button in the call. Recordings are saved to the session for students to rewatch (about $0.81 per recorded hour).</small></div>
        </label>
        {error && <p className="k-error">{error}</p>}
        <button className="k-btn k-btn--gold k-btn--lg" disabled={busy}><Radio size={18} /> {busy ? 'Opening the room…' : 'Go live'}</button>
        <p className="ds-muted">{who === 'one' ? 'They get a notification with a button straight into the call.' : 'Invited students get a “Live now” notification that takes them straight into the call.'}</p>
      </form>
    </Modal>
  );
};

/** After a call: who came, when, how long, and the recordings. */
export const CallReportModal = ({ session, onClose }) => {
  const report = useRows(() => supabase.rpc('academy_call_report', { p_session: session.id }), [session.id]);
  const [recs, setRecs] = useState(null);
  const loadRecs = async () => { const res = await fnInvoke('daily-room', { action: 'recording', session_id: session.id }); setRecs(res?.recordings || []); };
  const total = report.data.reduce((n, r) => n + Number(r.minutes || 0), 0);
  return (
    <Modal title={`Call report — ${session.title}`} onClose={onClose} wide>
      <p className="ds-muted">
        {fmtDateTime(session.started_at || session.starts_at)}{session.ended_at ? ` → ${fmtDateTime(session.ended_at)}` : ''} · {report.data.length} people · {Math.round(total)} total minutes
      </p>
      {report.data.length ? (
        <div className="cl-table-wrap" style={{ margin: '12px 0' }}>
          <table className="cl-table">
            <thead><tr><th>Person</th><th>Joined</th><th>Left</th><th>Minutes</th><th>Times joined</th><th>Attendance</th></tr></thead>
            <tbody>{report.data.map((r) => (
              <tr key={r.user_id}><th scope="row">{r.full_name}<small className="ds-muted" style={{ display: 'block' }}>{r.email}</small></th>
                <td>{r.first_join ? fmtDateTime(r.first_join) : '—'}</td><td>{r.last_leave ? fmtDateTime(r.last_leave) : '—'}</td>
                <td>{Number(r.minutes) || '—'}</td><td>{r.joins || '—'}</td><td>{r.attendance || '—'}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="ds-muted">No one has joined yet. Call tracking fills this in as people come and go.</p>}
      {session.has_recording && (recs === null
        ? <button className="k-btn k-btn--plum k-btn--sm" onClick={loadRecs}><Video size={15} /> Show recordings</button>
        : recs.length ? <ul className="ds-list">{recs.map((r, i) => <li key={i}><a className="ds-row" href={r.url} target="_blank" rel="noopener noreferrer"><Video size={16} /><div><strong>Recording {i + 1}</strong><small>{r.minutes} min · link works for 3 hours</small></div></a></li>)}</ul>
        : <p className="ds-muted">No recordings found.</p>)}
    </Modal>
  );
};

// ── On a student's page: their personal tasks and private files ─
export const StudentTasksPanel = ({ studentId }) => {
  const { program } = useAcademy();
  const tasks = useRows(() => supabase.from('academy_assignments').select('*').eq('program_id', program.id).contains('assigned_to', [studentId]).order('created_at', { ascending: false }), [program.id, studentId]);
  const subs = useRows(() => supabase.from('academy_submissions').select('assignment_id, status, score, max_score').eq('program_id', program.id).eq('student_id', studentId), [program.id, studentId]);
  const [modal, setModal] = useState(null);
  const state = (a) => {
    const s = subs.data.find((x) => x.assignment_id === a.id);
    return s ? (s.status === 'submitted' ? ['Handed in', 'ds-pill--gold'] : s.status === 'revise' ? ['Revising', 'ds-pill--red'] : ['Graded', 'ds-pill--green']) : a.is_published ? ['To do', ''] : ['Draft', ''];
  };
  return (
    <>
      <button className="k-btn k-btn--gold k-btn--sm" style={{ marginBottom: 14 }} onClick={() => setModal('new')}><Plus size={15} /> New personal task</button>
      {tasks.data.length ? (
        <ul className="ds-list">{tasks.data.map((a) => {
          const [label, cls] = state(a);
          return (
            <li key={a.id}><button className="ds-row" onClick={() => setModal({ a })}>
              <ClipboardList size={18} /><div><strong>{a.title}</strong><small>{a.due_at ? `Due ${fmtDateTime(a.due_at)}` : 'No due date'}{a.assigned_to.length > 1 ? ` · shared with ${a.assigned_to.length - 1} other${a.assigned_to.length > 2 ? 's' : ''}` : ' · just for them'}</small></div>
              <span className={`ds-pill ${cls}`}>{label}</span>
            </button></li>
          );
        })}</ul>
      ) : <p className="ds-muted">No personal tasks yet. Tasks for the whole class are under Assignments.</p>}
      {modal === 'new' && <AssignmentModal presetStudent={studentId} onClose={() => setModal(null)} onSaved={tasks.reload} />}
      {modal?.a && <AssignmentModal assignment={modal.a} onClose={() => setModal(null)} onSaved={tasks.reload} />}
    </>
  );
};

export const StudentFilesPanel = ({ studentId }) => {
  const { program } = useAcademy();
  const files = useRows(() => supabase.from('academy_student_files').select('*').eq('program_id', program.id).eq('student_id', studentId).order('created_at', { ascending: false }), [program.id, studentId]);
  const [form, setForm] = useState({ title: '', note: '', file: null, busy: false, error: '' });
  const upload = async (e) => {
    e.preventDefault();
    if (!form.file) return setForm({ ...form, error: 'Choose a file.' });
    setForm({ ...form, busy: true, error: '' });
    try {
      const meta = await uploadAcademyFile(program.slug, `messages/${studentId}`, form.file);
      const { error } = await write(supabase.from('academy_student_files').insert({
        program_id: program.id, student_id: studentId, title: form.title.trim() || form.file.name.replace(/\.[^.]+$/, ''), note: form.note.trim() || null, ...meta,
      }));
      if (error) throw new Error(error);
      setForm({ title: '', note: '', file: null, busy: false, error: '' }); e.target.reset(); files.reload();
    } catch (err) { setForm((f) => ({ ...f, busy: false, error: err.message })); }
  };
  const remove = async (f) => {
    if (!window.confirm(`Remove “${f.title}”?`)) return;
    await supabase.storage.from('academy').remove([f.file_path]);
    await write(supabase.from('academy_student_files').delete().eq('id', f.id));
    files.reload();
  };
  return (
    <div className="ds-grid" style={{ maxWidth: 820 }}>
      <form className="ds-card ds-form" onSubmit={upload}>
        <strong><Upload size={16} /> Share a private file</strong>
        <p className="ds-muted" style={{ margin: 0 }}>Only this student (and mentors) can open it. They get a notification.</p>
        <label className="k-field"><span>File (PDF, worksheet, audio, video — up to 50 MB)</span><input type="file" onChange={(e) => setForm({ ...form, file: e.target.files[0] || null })} /></label>
        <div className="k-row">
          <label className="k-field"><span>Title</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Defaults to the file name" /></label>
          <label className="k-field"><span>Note (optional)</span><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Read before Thursday" /></label>
        </div>
        {form.error && <p className="k-error">{form.error}</p>}
        <button className="k-btn k-btn--gold k-btn--sm" style={{ justifySelf: 'start' }} disabled={form.busy}><Upload size={15} /> {form.busy ? 'Uploading…' : 'Share with them'}</button>
      </form>
      {files.data.length ? (
        <ul className="ds-list">{files.data.map((f) => (
          <li key={f.id} className="ds-row">
            <FileText size={18} /><div><strong>{f.title}</strong><small>{[f.note, f.file_name, fileSize(f.size_bytes), fmtDate(f.created_at)].filter(Boolean).join(' · ')}</small></div>
            <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => openFile(f.file_path)} aria-label="Download"><Download size={15} /></button>
            <button className="k-btn k-btn--icon k-btn--ghost" onClick={() => remove(f)} aria-label="Remove"><Trash2 size={15} /></button>
          </li>
        ))}</ul>
      ) : <p className="ds-muted">Nothing shared privately yet.</p>}
    </div>
  );
};
