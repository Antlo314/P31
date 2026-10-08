import { supabase } from '../../lib/supabase';
import { useRows } from './data';

// Shared helpers for the mentor and student classrooms.
export const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export const useRoster = (program) => useRows(() => supabase.rpc('academy_roster', { p_program: program.id }), [program.id]);

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/** Does a student meet one completion requirement? → { done, have, need } */
export function requirementStatus(req, s) {
  if (!s) return { done: false, have: 0, need: req.target || 0 };
  const pair = {
    lessons: [s.lessons_done, s.lessons_total],
    assignments: [s.assignments_passed, s.assignments_total],
    quizzes: [s.quizzes_passed, s.quizzes_total],
    sessions: [s.sessions_attended, s.sessions_total],
  }[req.kind];
  if (!pair) {
    const done = (s.custom_checked || []).includes(req.id);
    return { done, have: done ? 1 : 0, need: 1 };
  }
  const [have, total] = pair;
  const need = req.target || total;
  return { done: need > 0 && have >= need, have, need };
}

export const REQ_KINDS = [
  ['lessons', 'Complete lessons'],
  ['assignments', 'Pass assignments'],
  ['quizzes', 'Pass quizzes'],
  ['sessions', 'Attend sessions'],
  ['custom', 'Mentor checks it off'],
];

/** "8/10 · 80%" for a graded submission, or null. */
export const scoreLabel = (s) => (s?.max_score ? `${Number(s.score)}/${Number(s.max_score)} · ${pct(Number(s.score), Number(s.max_score))}%` : null);
