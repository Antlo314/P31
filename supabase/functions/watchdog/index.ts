// Supabase Edge Function: watchdog
// Every hour (v45 schedules it at :07) it checks the whole system, fixes what is safe to fix on its
// own, and keeps an alert open for everything else until the check passes again:
//   social   Instagram and Facebook connected in Zernio; login tokens not about to expire
//   posts    failed posts (retried once automatically, then alerted); days ahead with no post
//   forms    form emails that did not go out (it runs join-notify again); requests waiting > 2 days
//   site     bursts of site errors; scheduled jobs failing or stopped; database updates waiting;
//            email and Zernio keys present
// Alerts live in ops_alerts (Systems > Health, Today). Email: at once for a new failure, and one
// summary in the 8 AM Eastern hour while anything is still open (snoozed alerts stay quiet).
//
// Body: { source?: 'cron' } — or { action: 'run' } from a signed-in admin (Run checks now).
// Secrets: SUPABASE_SERVICE_ROLE_KEY, ZERNIO_API_KEY, RESEND_API_KEY, EMAIL_FROM,
//          OPS_ALERT_TO (comma list; falls back to DIGEST_TO, then ceo@p31market.com)
// Deploy: supabase functions deploy watchdog --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, layout, esc, emailConfigured } from '../_shared/email.ts';

const env = (k: string) => Deno.env.get(k) || '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
type Problem = { key: string; severity: 'warn' | 'fail'; area: string; title: string; detail?: string; fix?: string; link?: string; meta?: Row };

const LATEST_DB = 46; // the newest storefront_vNN.sql in the repo
const SYSTEMS = 'https://www.thep31collective.org/systems';
const STUDIO = 'https://www.thep31collective.org/studio';
const ZERNIO = 'https://zernio.com/api/v1';
const TZ = 'America/New_York';
const HOUR = 3600e3;
const etParts = (d = new Date()) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(d).map((p) => [p.type, p.value]));
const etDate = (d = new Date()) => { const p = etParts(d); return `${p.year}-${p.month}-${p.day}`; };
const etHour = (d = new Date()) => Number(etParts(d).hour) % 24;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const recipients = () => (env('OPS_ALERT_TO') || env('DIGEST_TO') || 'ceo@p31market.com').split(',').map((s) => s.trim()).filter(Boolean);

async function zernio(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ZERNIO}${path}`, { ...init, headers: { Authorization: `Bearer ${env('ZERNIO_API_KEY')}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`Zernio ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

// ── The checks ───────────────────────────────────────────────────────────────
// Each returns the problems it found; healing actions are pushed to `healed`.

async function checkSocial(): Promise<Problem[]> {
  if (!env('ZERNIO_API_KEY')) return [{ key: 'config.zernio', severity: 'fail', area: 'social', title: 'Zernio is not connected to the site', fix: 'Add the ZERNIO_API_KEY secret in Supabase (Edge Functions > Secrets).' }];
  const out: Problem[] = [];
  const { accounts = [] } = await zernio('/accounts');
  for (const platform of ['instagram', 'facebook']) {
    const a = accounts.find((x: Row) => x.platform === platform);
    const name = platform === 'instagram' ? 'Instagram' : 'Facebook';
    if (!a) { out.push({ key: `social.missing.${platform}`, severity: 'fail', area: 'social', title: `${name} is not connected in Zernio`, fix: `Connect the P31 ${name} account in Zernio (Accounts > Connect).`, link: 'https://zernio.com' }); continue; }
    if (a.needsReconnection || a.isActive === false || a.enabled === false) {
      out.push({ key: `social.reconnect.${platform}`, severity: 'fail', area: 'social', title: `${name} needs reconnecting in Zernio`, detail: 'Scheduled posts to it will not go out until it is reconnected.', fix: `Zernio > Accounts > ${name} > Reconnect${platform === 'instagram' ? ' (choose Facebook Login, which also unlocks trending music for reels)' : ''}.`, link: 'https://zernio.com' });
    }
    if (a.tokenExpiresAt) {
      const days = Math.floor((new Date(a.tokenExpiresAt).getTime() - Date.now()) / (24 * HOUR));
      if (days <= 14) out.push({ key: `social.token.${platform}`, severity: days <= 3 ? 'fail' : 'warn', area: 'social', title: days < 0 ? `${name} login has expired` : `${name} login expires in ${plural(Math.max(0, days), 'day')}`, detail: `Zernio's access to ${name} ends ${new Date(a.tokenExpiresAt).toLocaleDateString('en-US', { timeZone: TZ, month: 'long', day: 'numeric' })}; posts stop going out after that.`, fix: `Reconnect ${name} in Zernio before then (Accounts > ${name} > Reconnect).`, link: 'https://zernio.com' });
    }
  }
  return out;
}

// deno-lint-ignore no-explicit-any
async function checkPosts(db: any, healed: string[]): Promise<Problem[]> {
  if (!env('ZERNIO_API_KEY')) return [];
  const out: Problem[] = [];
  // Failed posts from the last week: retry each once, then alert if it is still failing.
  const failed = (await zernio('/posts?status=failed&limit=100')).posts || [];
  const recent = failed.filter((p: Row) => Date.now() - new Date(p.scheduledFor || p.updatedAt || p.createdAt || 0).getTime() < 7 * 24 * HOUR);
  const { data: openPost } = await db.from('ops_alerts').select('key, meta').like('key', 'post.failed.%').is('resolved_at', null);
  const retried = new Map((openPost || []).map((a: Row) => [a.key, a.meta]));
  for (const p of recent) {
    const id = p._id || p.id;
    const key = `post.failed.${id}`;
    const err = (p.platforms || []).map((x: Row) => x.errorMessage || x.error).filter(Boolean)[0] || '';
    const when = p.scheduledFor ? new Date(p.scheduledFor).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
    const title = String(p.title || p.content || 'A post').split('\n')[0].slice(0, 80);
    if (!retried.has(key)) {
      try { await zernio(`/posts/${id}/retry`, { method: 'POST' }); healed.push(`Retried the failed post "${title}"`); } catch { /* alert below either way */ }
      out.push({ key, severity: 'warn', area: 'posts', title: `A post failed and was retried: ${title}`, detail: `${when ? `${when} ET. ` : ''}${err}`.trim(), fix: 'Nothing to do unless it fails again; then open it in Content Studio > Calendar > Studio history.', link: `${STUDIO}/calendar`, meta: { retried: true, postId: id } });
    } else {
      out.push({ key, severity: 'fail', area: 'posts', title: `A post keeps failing: ${title}`, detail: `${when ? `${when} ET. ` : ''}${err || 'It failed again after an automatic retry.'}`.trim(), fix: 'Open it in Content Studio > Calendar > Studio history: try again, or edit the media or caption (a reconnect in Zernio fixes most).', link: `${STUDIO}/calendar`, meta: { retried: true, postId: id } });
    }
  }
  // Autopilot batches waiting more than a day for someone's yes.
  const { data: waiting } = await db.from('autopilot_batches').select('id, first_day').eq('status', 'awaiting').lt('created_at', new Date(Date.now() - 24 * HOUR).toISOString()).limit(1);
  if (waiting?.[0]) out.push({ key: `autopilot.waiting.${waiting[0].id}`, severity: 'warn', area: 'posts', title: 'Drafted posts are waiting for approval', detail: `The autopilot's batch starting ${new Date(`${waiting[0].first_day}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} needs a yes before any of it can go out.`, fix: 'Open the review link in the email, or Content Studio > Auto-create > Autopilot > Review.', link: `${STUDIO}/autocreate?tab=autopilot` });
  // Days ahead with nothing booked (every page; Zernio does not sort, so sort here).
  const scheduled: Row[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const r = await zernio(`/posts?status=scheduled&limit=100&page=${page}`);
    scheduled.push(...(r.posts || []));
    if (page >= (r.pagination?.pages || 1)) break;
  }
  scheduled.sort((a, b) => new Date(a.scheduledFor || 0).getTime() - new Date(b.scheduledFor || 0).getTime());
  const days = new Set(scheduled.map((p: Row) => p.scheduledFor && etDate(new Date(p.scheduledFor))).filter(Boolean));
  const next = Array.from({ length: 7 }, (_, i) => etDate(new Date(Date.now() + (i + 1) * 24 * HOUR)));
  const empty = next.filter((d) => !days.has(d));
  if (empty.length >= 3 || (empty.includes(next[0]) && empty.includes(next[1]))) {
    const last = scheduled.length ? etDate(new Date(scheduled[scheduled.length - 1].scheduledFor)) : null;
    out.push({ key: 'posts.queue', severity: empty.length >= 5 ? 'fail' : 'warn', area: 'posts', title: `${plural(empty.length, 'day')} of the next 7 have no post`, detail: `Booked through ${last || 'nothing yet'}. Empty: ${empty.map((d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })).join(', ')}.`, fix: 'Content Studio > Auto-create, or the Design studio\'s Batch, fills the gaps in a few minutes.', link: `${STUDIO}/autocreate` });
  }
  return out;
}

const FORM_TABLES: [string, string, string][] = [
  ['vendor_applications', 'vendor applications', `${SYSTEMS}/vendors`],
  ['collective_applications', 'Collective applications', `${SYSTEMS}/applications`],
  ['vendor_agreements', 'storefront agreements', `${SYSTEMS}/forms`],
  ['vendor_registrations', 'market registrations', `${SYSTEMS}/forms`],
  ['vendor_feedback', 'feedback surveys', `${SYSTEMS}/forms`],
  ['volunteer_signups', 'volunteer forms', `${SYSTEMS}/forms`],
  ['academy_inquiries', 'mentorship intro-call requests', `${SYSTEMS}/academy`],
];

// deno-lint-ignore no-explicit-any
async function countUnsent(db: any) {
  const from = new Date(Date.now() - 48 * HOUR).toISOString();
  const to = new Date(Date.now() - 0.5 * HOUR).toISOString();
  const res = await Promise.all(FORM_TABLES.map(async ([t]) => {
    const { count, error } = await db.from(t).select('id', { count: 'exact', head: true }).is('notified_at', null).gte('created_at', from).lte('created_at', to);
    return [t, error ? 0 : count || 0] as const;
  }));
  return Object.fromEntries(res) as Record<string, number>;
}

// deno-lint-ignore no-explicit-any
async function checkForms(db: any, healed: string[]): Promise<Problem[]> {
  const out: Problem[] = [];
  // Form emails (to the team, ceo@ and the person) that should have gone out by now.
  let unsent = await countUnsent(db);
  if (Object.values(unsent).some((n) => n > 0)) {
    try {
      await fetch(`${env('SUPABASE_URL')}/functions/v1/join-notify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'watchdog' }) });
      healed.push('Ran the form emails again');
      unsent = await countUnsent(db);
    } catch { /* report below */ }
  }
  for (const [t, label, link] of FORM_TABLES) {
    if (unsent[t] > 0) out.push({ key: `forms.unsent.${t}`, severity: 'fail', area: 'forms', title: `${plural(unsent[t], 'form email')} did not go out (${label})`, detail: 'The submissions are saved; the emails to the team and to the person did not send, even after a retry.', fix: 'Check that join-notify is deployed and RESEND_API_KEY is set (Supabase > Edge Functions > Secrets).', link });
  }
  // Requests nobody has picked up in two days.
  const old = new Date(Date.now() - 48 * HOUR).toISOString();
  for (const [t, label, link] of FORM_TABLES) {
    if (['vendor_feedback', 'volunteer_signups'].includes(t)) continue;
    const { count, error } = await db.from(t).select('id', { count: 'exact', head: true }).eq('status', 'new').lte('created_at', old);
    if (!error && count) out.push({ key: `forms.waiting.${t}`, severity: 'warn', area: 'forms', title: `${plural(count, label.replace(/s$/, ''), label)} waiting more than 2 days`, fix: 'Open them and approve, decline or reply; the person is waiting to hear back.', link });
  }
  return out;
}

// deno-lint-ignore no-explicit-any
async function checkSite(db: any): Promise<Problem[]> {
  const out: Problem[] = [];
  if (!emailConfigured()) out.push({ key: 'config.email', severity: 'fail', area: 'site', title: 'Email sending is not set up', detail: 'Form emails, receipts, reminders and this watchdog cannot send.', fix: 'Add RESEND_API_KEY (and EMAIL_FROM) in Supabase > Edge Functions > Secrets.' });
  // Site errors in the last day.
  const since = new Date(Date.now() - 24 * HOUR).toISOString();
  const { data: errs } = await db.from('app_errors').select('message, path, count').is('resolved_at', null).gte('last_seen', since).order('count', { ascending: false }).limit(20);
  const total = (errs || []).reduce((a: number, e: Row) => a + (e.count || 0), 0);
  if ((errs || []).some((e: Row) => e.count >= 10) || total >= 25) {
    out.push({ key: 'site.errors', severity: 'warn', area: 'site', title: `Site errors: ${total} in the last day`, detail: (errs || []).slice(0, 3).map((e: Row) => `${e.message} (${e.path || 'page'} ×${e.count})`).join(' · '), fix: 'Open Systems > Health to see each one; send the top one to the developer.', link: `${SYSTEMS}/health` });
  }
  // Scheduled jobs: failed runs, or a job that has stopped.
  const { data: jobs, error } = await db.rpc('ops_cron_health');
  if (!error) {
    const NAMES: Record<string, string> = { 'p31-join-notify': 'Form emails', 'p31-team-digest': 'The morning email', 'p31-studio-autocreate': 'Monthly post drafts', 'p31-daily-word': 'The Daily Word', 'p31-chat-notify': 'Gathering notifications', 'p31-vendor-billing': 'Storefront billing', 'p31-class-reminders': 'Class reminders', 'p31-welcome-series': 'Welcome emails', 'p31-watchdog': 'The watchdog' };
    for (const j of (jobs || []) as Row[]) {
      if (!j.active) continue;
      const name = NAMES[j.jobname] || j.jobname;
      const [, hour, dom] = String(j.schedule).split(/\s+/);
      const maxGap = dom && dom !== '*' ? 32 * 24 * HOUR : hour === '*' || hour.includes('/') ? 3 * HOUR : 26 * HOUR;
      const last = j.last_start ? new Date(j.last_start).getTime() : 0;
      if (last && Date.now() - last > maxGap) out.push({ key: `cron.stopped.${j.jobname}`, severity: 'fail', area: 'site', title: `${name} has stopped running`, detail: `Last ran ${new Date(last).toLocaleString('en-US', { timeZone: TZ })} ET (schedule ${j.schedule}).`, fix: 'Supabase > Integrations > Cron: check the job is active; rerun the latest storefront_vNN.sql if it is missing.' });
      else if (j.failed_24h > 0) out.push({ key: `cron.failed.${j.jobname}`, severity: j.last_status === 'failed' ? 'fail' : 'warn', area: 'site', title: `${name}: ${plural(j.failed_24h, 'run')} failed today`, detail: j.last_message || '', fix: 'Supabase > Integrations > Cron > the job > history shows the error.' });
    }
  }
  // Database updates waiting.
  const { data: v } = await db.from('schema_versions').select('version').order('version', { ascending: false }).limit(1);
  const have = v?.[0]?.version || 0;
  if (have && have < LATEST_DB) out.push({ key: 'db.version', severity: 'warn', area: 'site', title: `Database update ${have + 1 === LATEST_DB ? `v${LATEST_DB}` : `v${have + 1} to v${LATEST_DB}`} waiting`, detail: `The database is at v${have}; the site's code expects v${LATEST_DB}.`, fix: 'Systems > Health lists each script with the command to run it.', link: `${SYSTEMS}/health` });
  return out;
}

// ── Run ──────────────────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function run(db: any, source: string) {
  const t0 = Date.now();
  const healed: string[] = [];
  const results: { area: string; ok: boolean; error?: string; found: number }[] = [];
  const problems: Problem[] = [];
  const steps: [string, () => Promise<Problem[]>][] = [
    ['social', () => checkSocial()], ['posts', () => checkPosts(db, healed)], ['forms', () => checkForms(db, healed)], ['site', () => checkSite(db)],
  ];
  for (const [area, fn] of steps) {
    try { const p = await fn(); problems.push(...p); results.push({ area, ok: !p.length, found: p.length }); }
    catch (e) {
      const msg = (e as Error).message;
      results.push({ area, ok: false, error: msg, found: 1 });
      problems.push({ key: `check.${area}`, severity: 'warn', area, title: `The ${area} check could not run`, detail: msg.slice(0, 300), fix: 'Usually a connection hiccup; if it repeats, check the Zernio key and the Supabase logs for the watchdog function.' });
    }
  }

  // Reconcile with the open alerts: new ones open, existing ones refresh, passing ones close.
  const now = new Date().toISOString();
  const { data: openRows } = await db.from('ops_alerts').select('*').is('resolved_at', null);
  const open = new Map((openRows || []).map((a: Row) => [a.key, a]));
  const seen = new Set<string>();
  const fresh: Row[] = [];
  for (const p of problems) {
    if (seen.has(p.key)) continue;
    seen.add(p.key);
    const prev = open.get(p.key) as Row | undefined;
    const row = { severity: p.severity, area: p.area, title: p.title, detail: p.detail || null, fix: p.fix || null, link: p.link || null, meta: p.meta || {}, last_seen: now };
    if (prev) {
      // A warning that became a failure gets emailed again.
      const escalated = prev.severity === 'warn' && p.severity === 'fail';
      await db.from('ops_alerts').update({ ...row, ...(escalated ? { notified_at: null } : {}) }).eq('id', prev.id);
      if (escalated) fresh.push({ ...prev, ...row });
    } else {
      const { data } = await db.from('ops_alerts').insert({ key: p.key, ...row, first_seen: now }).select().maybeSingle();
      if (data) fresh.push(data);
    }
  }
  const closed: Row[] = [];
  for (const [key, a] of open) {
    if (!seen.has(key as string)) { await db.from('ops_alerts').update({ resolved_at: now, resolved_by: 'watchdog' }).eq('id', (a as Row).id); closed.push(a as Row); }
  }

  // Email: new failures right away; a summary each morning while anything is open.
  let emailed: string | null = null;
  const { data: stillOpen } = await db.from('ops_alerts').select('*').is('resolved_at', null).order('severity').order('first_seen');
  const awake = (stillOpen || []).filter((a: Row) => !a.snoozed_until || new Date(a.snoozed_until) < new Date());
  const urgent = awake.filter((a: Row) => a.severity === 'fail' && !a.notified_at);
  const today = etDate();
  const { data: lastSummary } = await db.from('ops_runs').select('ran_at').eq('emailed', 'summary').order('ran_at', { ascending: false }).limit(1);
  const summaryDue = etHour() === 8 && awake.length > 0 && !(lastSummary?.[0] && etDate(new Date(lastSummary[0].ran_at)) === today);
  if (emailConfigured() && (urgent.length || summaryDue)) {
    const list = summaryDue ? awake : urgent;
    const item = (a: Row) => `<tr><td style="padding:12px 0;border-top:1px solid #eee">
      <p style="margin:0;font-size:12px;font-weight:bold;letter-spacing:1px;color:${a.severity === 'fail' ? '#B42318' : '#9A6700'}">${a.severity === 'fail' ? 'NEEDS ATTENTION' : 'HEADS UP'} · ${esc(a.area.toUpperCase())}</p>
      <p style="margin:4px 0 0;font-size:15px;font-weight:bold;color:#2A1526">${esc(a.title)}</p>
      ${a.detail ? `<p style="margin:4px 0 0;font-size:13px;color:#4E3A4B">${esc(a.detail)}</p>` : ''}
      ${a.fix ? `<p style="margin:6px 0 0;font-size:13px;color:#3A1C36"><b>Fix:</b> ${esc(a.fix)}</p>` : ''}
      ${a.link ? `<p style="margin:6px 0 0;font-size:12px"><a href="${esc(a.link)}" style="color:#3A1C36">Open</a></p>` : ''}
    </td></tr>`;
    const body = `<p style="margin:0 0 6px;color:#4E3A4B;font-size:14px">${summaryDue ? `${plural(awake.length, 'thing')} still open this morning.` : 'Something just broke. Everything else is running.'}${healed.length ? ` Fixed on its own: ${esc(healed.join('; '))}.` : ''}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${list.map(item).join('')}</table>
      <p style="margin:16px 0 0;font-size:12px;color:#74657A">All alerts: <a href="${SYSTEMS}/health" style="color:#3A1C36">Systems &gt; Health</a>. Snooze one there to stop these emails about it.</p>`;
    const subject = summaryDue ? `P31 system check: ${plural(awake.length, 'item')} open` : `P31 alert: ${urgent[0].title}${urgent.length > 1 ? ` (+${urgent.length - 1} more)` : ''}`;
    try {
      await sendEmail(recipients(), subject, layout(summaryDue ? 'This morning\'s system check' : 'Something needs attention', body, 'Sent by the P31 watchdog, which checks both sites every hour.'));
      emailed = summaryDue ? 'summary' : 'alert';
      const ids = list.map((a: Row) => a.id);
      if (ids.length) await db.from('ops_alerts').update({ notified_at: now }).in('id', ids);
    } catch (e) { console.error('watchdog email failed', (e as Error).message); }
  }

  await db.from('ops_runs').insert({ source, ok: !awake.length, open_alerts: (stillOpen || []).length, checks: results, healed, emailed, took_ms: Date.now() - t0 });
  await db.from('ops_runs').delete().lt('ran_at', new Date(Date.now() - 30 * 24 * HOUR).toISOString());
  return { ok: !awake.length, open: (stillOpen || []).length, new: fresh.length, closed: closed.length, healed, emailed, checks: results };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  let b: Row = {};
  try { b = await req.json(); } catch { /* empty body */ }

  // "Run checks now" from Systems: only for admins and Systems operators.
  if (b.action === 'run') {
    const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
    const [{ data: admin }, { data: operator }] = await Promise.all([asUser.rpc('is_academy_admin'), asUser.rpc('is_operator')]);
    if (!admin && !operator) return json({ error: 'Only admins can run the checks.' }, 403);
    try { return json(await run(db, 'admin')); } catch (e) { return json({ error: (e as Error).message }, 500); }
  }

  // The schedule (or anyone else): at most once every ten minutes.
  const { data: last } = await db.from('ops_runs').select('ran_at').order('ran_at', { ascending: false }).limit(1);
  if (last?.[0] && Date.now() - new Date(last[0].ran_at).getTime() < 10 * 60e3) return json({ skipped: 'ran less than ten minutes ago' });
  try { return json(await run(db, String(b.source || 'cron').slice(0, 20))); } catch (e) { console.error('watchdog failed', e); return json({ error: (e as Error).message }, 500); }
});
