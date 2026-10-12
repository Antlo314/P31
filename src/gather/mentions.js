// @mentions in The Gathering: "@Melanie JC" in a message points at a member by her full name.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const END = '(?![\\p{L}\\p{N}_])';

/** One pattern for every member's name, longest first so "@Melanie JC" wins over "@Melanie". */
export function mentionPattern(names) {
  const list = [...new Set(names.filter((n) => n && n.trim().length > 1))].sort((a, b) => b.length - a.length).map(esc);
  return list.length ? new RegExp(`(@(?:${list.join('|')}))${END}`, 'giu') : null;
}

/** Does this message mention this person? */
export const mentions = (body, name) => !!(body && name && new RegExp(`@${esc(name)}${END}`, 'iu').test(body));

/** The @name being typed just before the caret: { start, q }, or null. Allows one space ("@Melanie J"). */
export function mentionAt(text, caret) {
  const m = text.slice(0, caret).match(/(?:^|\s)@([\p{L}\p{N}'’.-]*(?: [\p{L}\p{N}'’.-]*)?)$/u);
  return m ? { start: caret - m[1].length - 1, q: m[1] } : null;
}

/** Up to six members whose name (or any word of it) starts with what was typed. */
export function suggestPeople(people, q, meId) {
  const ql = q.toLowerCase().trim();
  return people
    .filter((p) => p.id !== meId && p.name && (!ql || p.name.toLowerCase().startsWith(ql) || p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(ql))))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 6);
}

/** A short piece of a long message, around the first place the search words appear. */
export function snippet(text, q, size = 150) {
  const body = (text || '').replace(/\*\*?/g, '').replace(/\s+/g, ' ').trim();
  if (body.length <= size) return body;
  const at = q ? body.toLowerCase().indexOf(q.toLowerCase()) : -1;
  const start = Math.max(0, Math.min(body.length - size, at - 40));
  return `${start > 0 ? '…' : ''}${body.slice(start, start + size).trim()}${start + size < body.length ? '…' : ''}`;
}
