// Student preview: mentors see the classroom through a student's eyes in a frame inside
// the mentor console. The frame's window.name marks it (it survives navigation inside
// the frame and never puts a student's details in the address bar):
//   p31-student-preview:new      — a brand-new student (what everyone in the program sees)
//   p31-student-preview:<userId> — one specific student
export const PREVIEW_PREFIX = 'p31-student-preview:';

export const framePreviewWho = () => {
  try {
    return typeof window !== 'undefined' && window.name?.startsWith(PREVIEW_PREFIX) ? window.name.slice(PREVIEW_PREFIX.length) : null;
  } catch { return null; }
};

// Where to open the preview, based on the mentor page you're on.
const MATCH = [
  [/\/teach\/curriculum/, 'learn'], [/\/teach\/assignments/, 'assignments'], [/\/teach\/gradebook/, 'assignments'],
  [/\/teach\/quizzes/, 'quizzes'], [/\/teach\/sessions/, 'sessions'], [/\/teach\/discussions/, 'discussions'],
  [/\/teach\/inbox/, 'messages'], [/\/teach\/completion/, 'progress'], [/\/teach\/announcements/, ''],
];
export const previewPageFor = (pathname) => (MATCH.find(([re]) => re.test(pathname)) || [null, ''])[1];

/**
 * While previewing, nothing the viewer clicks may change data — not as the student, and
 * not as the mentor. Form submits, action buttons and checkboxes are stopped (links,
 * tabs and expanders still work). Returns a cleanup function.
 */
export function installPreviewGuard(onBlocked) {
  const allowed = (btn) => btn.matches('[role="tab"], [aria-expanded], [data-preview-ok], [aria-label="Close"], [aria-label="Close dialog"]');
  const onClick = (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    const control = t.closest('button, [role="button"], [role="checkbox"], input[type="checkbox"], input[type="radio"], label');
    if (!control || control.closest('a[href]')) return;
    if (control.tagName === 'LABEL' && !control.querySelector('input[type="checkbox"], input[type="radio"]')) return;
    if ((control.tagName === 'BUTTON' || control.getAttribute('role') === 'button') && allowed(control)) return;
    e.preventDefault();
    e.stopPropagation();
    onBlocked();
  };
  const onSubmit = (e) => { e.preventDefault(); e.stopPropagation(); onBlocked(); };
  document.addEventListener('click', onClick, true);
  document.addEventListener('submit', onSubmit, true);
  return () => {
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('submit', onSubmit, true);
  };
}
