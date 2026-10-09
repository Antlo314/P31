// Mentors can open a student's classroom exactly as that student sees it (read-only).
const key = (slug) => `p31_view_as:${slug}`;

export function readViewAs(slug) {
  try { return JSON.parse(sessionStorage.getItem(key(slug)) || 'null'); } catch { return null; }
}
export function startViewAs(slug, student) {
  try { sessionStorage.setItem(key(slug), JSON.stringify(student)); } catch { /* storage blocked */ }
  window.location.assign(`/academy/${slug}`);
}
export function stopViewAs(slug, back) {
  try { sessionStorage.removeItem(key(slug)); } catch { /* storage blocked */ }
  window.location.assign(back || `/academy/${slug}/teach/students`);
}
