// Badges from what someone actually is at P31 (chat_roles): an overseer's title first, then
// Overseer, P31 Team, Mentor, mentorship student or alumna, Vendor.
import { Crown, ShieldCheck, GraduationCap, BookOpen, Store, Sparkles, Award } from 'lucide-react';

const PROGRAM = { business: 'Business', faith: 'Faith' };

export function badgesFor(roles) {
  if (!roles) return [];
  const out = [];
  if (roles.title) out.push({ key: 'title', label: roles.title, tone: 'gold', Icon: Sparkles });
  if (roles.admin) out.push({ key: 'overseer', label: 'Overseer', tone: 'gold', Icon: Crown });
  if (roles.team) out.push({ key: 'team', label: 'P31 Team', tone: 'plum', Icon: ShieldCheck });
  (roles.mentor || []).length && out.push({ key: 'mentor', label: 'Mentor', tone: 'deep', Icon: GraduationCap });
  (roles.student || []).forEach((s) => out.push(s.alum
    ? { key: `alum-${s.program}`, label: `Alumna · ${PROGRAM[s.program] || s.program}`, tone: 'lav', Icon: Award }
    : { key: `student-${s.program}`, label: `${PROGRAM[s.program] || s.program} Mentorship`, tone: 'lav', Icon: BookOpen }));
  if (roles.vendor) out.push({ key: 'vendor', label: 'Vendor', tone: 'rose', Icon: Store });
  return out;
}

/** Which group someone sits in on the members list. */
export function groupOf(roles) {
  if (!roles) return 'members';
  if (roles.admin) return 'overseers';
  if (roles.team) return 'team';
  if ((roles.mentor || []).length) return 'mentors';
  if (roles.vendor) return 'vendors';
  if ((roles.student || []).length) return 'students';
  return 'members';
}

export const GROUPS = [
  ['overseers', 'Overseers'], ['team', 'P31 Team'], ['mentors', 'Mentors'], ['vendors', 'Vendors'], ['students', 'Students & alumnae'], ['members', 'Members'],
];

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'P';
