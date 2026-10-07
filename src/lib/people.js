import { supabase } from './supabase';

// Account emails are private (v19). These helpers cover the two places the
// site still needs them, without exposing the column.

let adminIdsPromise = null;

// Profile ids of P31 admins — for the "P31" badge. Cached for the session.
export const fetchAdminIds = () => {
  if (!adminIdsPromise) {
    adminIdsPromise = supabase
      .rpc('admin_profile_ids')
      .then(({ data }) => new Set((data || []).map((r) => (typeof r === 'string' ? r : r.admin_profile_ids))))
      .catch(() => new Set());
  }
  return adminIdsPromise;
};

// id → email for curators. Admins and Systems operators only; everyone else
// gets an empty map.
export const fetchCuratorEmails = async () => {
  const { data, error } = await supabase.rpc('curator_contacts');
  if (error || !data) return new Map();
  return new Map(data.map((r) => [r.id, r.email]));
};

// Attach .profiles.email to curator rows for admin screens.
export const withEmails = async (rows) => {
  const emails = await fetchCuratorEmails();
  return (rows || []).map((r) => ({ ...r, profiles: { ...(r.profiles || {}), email: emails.get(r.id) || null } }));
};
