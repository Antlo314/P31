// Which database scripts have landed, checked from the site itself. Every script leaves something
// behind (a table, a column, a function); asking for it shows whether it is there:
//   a missing table or column comes back as an error code (42P01 / PGRST205, 42703),
//   a missing function as PGRST202; a row a script adds (['row', table, [column, value]]) by reading it.
//   Only read-only checks are used.
// No prices here: this file is part of the public site, and mentorship prices are private.
// From v42 on, each script also records itself in schema_versions (with the date it ran).
import { supabase } from './supabase';

export const SCRIPTS = [
  { v: 59, file: 'storefront_v59_faith_six_months.sql', title: 'Faith 6-Month plans', what: 'The two Private Faith-Based Mentorship 6-Month Commitments from the October 2026 pricing sheet (bi-weekly and weekly), on Melanie’s Stripe Payment Links, offered on the private forms page.',
    expect: 'faith_six_month_plans 2 · faith_six_month_linked 2 · package_keys_unique true · version_recorded true',
    checks: [['row', 'academy_plans', ['package', 'Faith 2 6M']]] },
  { v: 58, file: 'storefront_v58_couples_mentorship.sql', title: 'Couples Private Mentorship', what: 'Couples Private Mentorship becomes its own program, with its four plans (bi-weekly or weekly 90-minute sessions, monthly or a 6-month commitment) on Melanie’s Stripe Payment Links. A couples client signs the three forms with the couples packages, chooses a couples plan and checks out.',
    expect: 'couples_program true · couples_plans 4 · couples_linked 4 · functions_ready true · version_recorded true',
    checks: [['row', 'academy_programs', ['slug', 'couples']]] },
  { v: 57, file: 'storefront_v57_dm_handoffs.sql', title: 'DM hand-offs by brand', what: 'Each question Carla passes to the team (Studio > Messages) shows whether it came in for the Marketplace or the Collective, and an info request from a DM keeps the email address the person gave.',
    expect: 'site_ready true · email_ready true · lead_ready true · market_rows_tagged true · version_recorded true',
    checks: [['column', 'dm_handoffs', 'site']] },
  { v: 56, file: 'storefront_v56_dm_agent.sql', title: 'Smarter DM assistant', what: 'Carla answers each message once, never repeats herself, and lists every question she passes to the team under Studio > Messages.',
    expect: 'claims_ready true · handoffs_ready true',
    checks: [['table', 'dm_handoffs']] },
  { v: 55, file: 'storefront_v55_stripe_payment_links.sql', title: 'Mentorship plans from Stripe', what: 'Each mentorship and coaching plan uses Melanie’s own Stripe Payment Link: checkout charges her product and price, and the site copies her prices daily. Adds the two 6-month Business Coaching plans.',
    expect: 'linked_plans 9 · six_month_plans 2 · packages_month_only true · sync_job_ready true',
    checks: [['column', 'academy_plans', 'stripe_payment_link']] },
  { v: 54, file: 'storefront_v54_admin_products.sql', title: 'Admin product & pricing controls', what: 'Create products for any shop, live marketplace pricing editor, bulk product adjustments, and staff product management.',
    expect: 'create_product_ready true · set_product_ready true · all_products_ready true · staff_policy_ready true',
    checks: [['rpc', 'shop_admin_all_products']] },
  { v: 53, file: 'storefront_v53_shop_addons.sql', title: 'Storefront add-ons', what: 'Product slot packs, Featured vendors (CEO pick and paid social posts), Google reviews on storefronts, and Stripe-only shop payments.',
    expect: 'addons_ready true · limit_ready true · featured_ready true · google_ready true · links_retired true · google_job_ready true',
    checks: [['rpc', 'featured_capacity']] },
  { v: 52, file: 'storefront_v52_enrollment_flow.sql', title: 'Enrollment workflow', what: 'After the three forms, the client chooses her program and plan and checks out on Stripe; payment marks her enrolled.',
    expect: 'choose_ready true · details_ready true · enrolled_status_ready true',
    checks: [['rpc', 'coaching_choose_plan', { p_token: 'probe', p_plan: '00000000-0000-0000-0000-000000000000' }]] },
  { v: 51, file: 'storefront_v51_merch_photos.sql', title: 'Merch photo galleries', what: 'Several Printful photos for each merch product (model, lifestyle, flat).',
    expect: 'gallery_ready true',
    checks: [['column', 'merch_mockups', 'gallery']] },
  { v: 50, file: 'storefront_v50_merch.sql', title: 'P31 merch', what: 'p31market.com/merch: orders paid on Stripe and printed and shipped by Printful, and the product photos.',
    expect: 'orders_ready true · mockups_ready true · bucket_ready true',
    checks: [['table', 'merch_orders'], ['table', 'merch_mockups']] },
  { v: 49, file: 'storefront_v49_new_pricing.sql', title: 'New pricing', what: 'October 2026 prices: the four business coaching packages and three faith mentorship packages, monthly; the earlier single monthly plans retired for new clients.',
    expect: 'business_prices (four prices) · faith_prices (three prices) · old_plans_retired true',
    checks: [['column', 'academy_plans', 'package']] },
  { v: 48, file: 'storefront_v48_shop_emails.sql', title: 'Shop emails', what: 'The team is emailed when a new shop signs up, and the vendor is emailed the moment her shop is approved.',
    expect: 'signup_column true · live_column true',
    checks: [['column', 'curator_data', 'live_notified_at']] },
  { v: 47, file: 'storefront_v47_coaching_forms.sql', title: 'Coaching intake forms', what: 'The Business Coaching Agreement, Confidentiality Agreement and Client Safety form on one private page (sent from the mentor console), signed in order, with PDF copies emailed.',
    expect: 'intakes_ready true · forms_ready true · sign_ready true · details_ready true',
    checks: [['table', 'coaching_intakes'], ['table', 'coaching_forms'], ['rpc', 'coaching_intake_details', { p_token: 'probe' }]] },
  { v: 46, file: 'storefront_v46_autopilot.sql', title: 'Content autopilot', what: 'When the posting calendar runs low, the Studio drafts the next two weeks of posts and emails the approvers a review link; nothing posts until someone approves.',
    expect: 'settings_ready true · batches_ready true · items_ready true · autopilot_scheduled true',
    checks: [['table', 'autopilot_settings'], ['table', 'autopilot_batches'], ['table', 'autopilot_items']] },
  { v: 45, file: 'storefront_v45_watchdog.sql', title: 'Watchdog', what: 'An hourly check of the whole system (social accounts, posts, forms, emails, scheduled jobs, site errors) that fixes what it safely can and alerts on the rest.',
    expect: 'alerts_ready true · runs_ready true · cron_health_ready true · watchdog_scheduled true',
    checks: [['table', 'ops_alerts'], ['table', 'ops_runs']] },
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
  // A row the script adds (e.g. a program): there only once the script has run.
  if (kind === 'row') { const { data, error } = await supabase.from(a).select(b[0]).eq(b[0], b[1]).limit(1); return !error && !!data?.length; }
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
