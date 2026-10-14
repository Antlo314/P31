// Which database scripts have landed, checked from the site itself. Every script leaves something
// behind (a table, a column, a function); asking for it shows whether it is there:
//   a missing table or column comes back as an error code (42P01 / PGRST205, 42703),
//   a missing function as PGRST202. Only read-only checks are used.
// From v42 on, each script also records itself in schema_versions (with the date it ran).
import { supabase } from './supabase';

export const SCRIPTS = [
  { v: 44, file: 'storefront_v44_design_studio.sql', title: 'Design studio', what: 'Designs saved from Content Studio > Design are shared with the whole Studio team, and songs uploaded for reels go into a team music library.',
    expect: 'designs_ready true · tracks_ready true · shared_file_rules 3 · team_photos_ok true',
    checks: [['table', 'studio_designs'], ['table', 'studio_tracks']] },
  { v: 43, file: 'storefront_v43_staff_powers.sql', title: 'Full admin control', what: 'Each team dashboard can read, edit and delete in its own room; admins can change and delete orders; full product editing and deleting shops.',
    expect: 'has_tool_ready true · staff_policies 21 · shop_tools_ready true · orders_editable true · intro_emails_ready true',
    checks: [['rpc', 'has_tool', { p_tool: 'orders' }]] },
  { v: 42, file: 'storefront_v42_operations.sql', title: 'Operations', what: 'Database status, the activity log, storefront billing, class reminders, welcome emails and the Luncheon follow-up ideas.',
    expect: 'versions_ok true · activity_ready true · billing_ready true · reminders_ready true · welcome_ready true · jobs 8',
    checks: [['table', 'schema_versions'], ['table', 'admin_activity'], ['column', 'curator_data', 'subscription_status'], ['column', 'leads', 'welcome_step'], ['table', 'academy_session_reminders']] },
  { v: 41, file: 'storefront_v41_team_dashboards.sql', title: 'Team dashboards', what: 'Dashboards per login, the team directory logins, Curators & shops controls, and uploaded lesson videos and recordings.',
    expect: 'team_logins 11 · melanie_admin true · shops_ready true · media_ready true',
    checks: [['column', 'team_access', 'role_title'], ['column', 'academy_lessons', 'video_path'], ['rpc', 'can_run_shops']] },
  { v: 40, file: 'storefront_catchup_v38_v40.sql', title: 'Direct-message alerts', what: 'Email when a direct message in The Gathering goes unread.', checks: [['table', 'chat_prefs']] },
  { v: 39, file: 'storefront_catchup_v38_v40.sql', title: 'The Gathering', what: 'Channels, messages, badges, media and the Daily Word.', checks: [['table', 'chat_channels'], ['table', 'chat_scriptures']] },
  { v: 38, file: 'storefront_catchup_v38_v40.sql', title: 'Automation', what: 'One admin list, markets with or without vendors, My markets, the morning digest and the scheduler.', checks: [['column', 'market_events', 'has_vendors'], ['table', 'team_digests']] },
  { v: 37, file: 'storefront_v37_forms.sql', title: 'Vendor forms', what: 'The forms that replaced JotForm.', checks: [['table', 'vendor_agreements']] },
];

const MISSING = /42P01|PGRST205|42703|PGRST202|PGRST204/;
const missing = (error) => !!error && (MISSING.test(error.code || '') || /does not exist|could not find/i.test(error.message || ''));

async function probe([kind, a, b]) {
  // A normal read, not head: true (supabase-js reports a head request to a missing table as success).
  if (kind === 'table') { const { error } = await supabase.from(a).select('*').limit(1); return !missing(error); }
  if (kind === 'column') { const { error } = await supabase.from(a).select(b).limit(1); return !missing(error); }
  // A function with arguments is called with harmless ones; `exists` means any answer but "missing" counts.
  if (kind === 'rpc') { const { error } = await supabase.rpc(a, b || undefined); return !missing(error); }
  return false;
}

/** [{ ...script, landed, applied_at }] newest first. */
export async function dbStatus() {
  const [versions, ...results] = await Promise.all([
    supabase.from('schema_versions').select('version, applied_at'),
    ...SCRIPTS.map((s) => Promise.all(s.checks.map(probe))),
  ]);
  const at = Object.fromEntries((versions.data || []).map((r) => [r.version, r.applied_at]));
  return SCRIPTS.map((s, i) => ({ ...s, landed: results[i].every(Boolean), applied_at: at[s.v] || null }));
}

/** The newest scripts that have not landed (oldest first, the order to run them). */
export const pending = (status) => status.filter((s) => !s.landed).sort((a, b) => a.v - b.v);
