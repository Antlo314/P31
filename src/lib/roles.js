import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../context/AuthContext';

const EMPTY = { signed_in: false, admin: false, operator: false, curator: false, studio: false, mentor: [], student: [] };

// Dev-only layout previews, compiled out of production: add ?devRole=student:business,
// mentor:faith, studio or admin to a URL once; it sticks for the browser tab
// (?devRole=off clears it). The database still treats the visitor as signed out.
export const devRole = () => {
  if (!import.meta.env.DEV) return null;
  const q = new URLSearchParams(window.location.search).get('devRole');
  try {
    if (q === 'off') sessionStorage.removeItem('p31_dev_role');
    else if (q) sessionStorage.setItem('p31_dev_role', q);
    return sessionStorage.getItem('p31_dev_role');
  } catch { return q && q !== 'off' ? q : null; }
};

const previewRoles = (r) => {
  const [kind, program = 'business'] = r.split(':');
  return {
    ...EMPTY, signed_in: true,
    admin: kind === 'admin',
    studio: kind === 'studio' || kind === 'admin',
    mentor: kind === 'mentor' ? [program] : kind === 'admin' ? ['business', 'faith'] : [],
    student: kind === 'student' ? [{ program, title: program === 'faith' ? 'Faith-Based Mentorship' : 'Business Mentorship', status: 'active', has_access: true }] : [],
    preview: true,
  };
};

/** Which dashboards can the signed-in person open? status: loading | signed-out | ready */
export function useRoles() {
  const { user, loading } = useAuth();
  const [state, setState] = useState({ status: 'loading', roles: EMPTY });
  const preview = devRole();

  const load = useCallback(async () => {
    if (preview) return setState({ status: 'ready', roles: previewRoles(preview) });
    if (!user) return setState({ status: 'signed-out', roles: EMPTY });
    const { data, error } = await supabase.rpc('my_roles');
    setState({ status: 'ready', roles: error || !data ? { ...EMPTY, signed_in: true } : data });
  }, [user, preview]);

  useEffect(() => {
    if (loading) return;
    Promise.resolve().then(load);
  }, [loading, load]);

  return { ...state, reload: load, user };
}

/** Team members (mentors, Studio, Systems) get the "Today" home that gathers their dashboards. */
export const isTeam = (roles) => !!(roles.admin || roles.operator || roles.studio || roles.mentor?.length);

const PROGRAM_NAMES = { business: 'Business Mentorship', faith: 'Faith-Based Mentorship' };

/** Every dashboard this person may open, most specific first. */
export function dashboardsFor(roles) {
  const out = [];
  (roles.student || []).forEach((s) => out.push({
    to: `/academy/${s.program}`, kind: 'student', title: s.title || PROGRAM_NAMES[s.program] || s.program,
    note: s.has_access ? 'Your classroom' : 'Your access has ended — renew to continue', locked: !s.has_access,
  }));
  (roles.mentor || []).forEach((slug) => out.push({
    to: `/academy/${slug}/teach`, kind: 'mentor', program: slug, title: PROGRAM_NAMES[slug] || slug,
    note: 'Mentor console · lessons, assignments, grading, messages',
  }));
  if (roles.studio) out.push({ to: '/studio', kind: 'studio', title: 'Content Studio', note: 'Instagram & Facebook · plan, create, schedule, reply' });
  if (roles.operator || roles.admin) out.push({ to: '/systems', kind: 'systems', title: 'Systems', note: 'P31 operations console' });
  if (roles.curator) out.push({ to: '/dashboard', kind: 'curator', title: 'Curator Studio', note: 'Your shop, products and orders' });
  return out;
}
