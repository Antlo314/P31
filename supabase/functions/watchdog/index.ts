// Supabase Edge Function: watchdog
// Every hour (v45 schedules it at :07) it checks the whole system, fixes what is safe to fix on its
// own, and keeps an alert open for everything else until the check passes again:
//   social   both Zernio workspaces (Market and Collective keys): each key works; Instagram,
//            Facebook and TikTok connected, logins not about to expire; each workspace sends its
//            messages and comments to Carla (a dm-agent webhook, switched on, signed with our secret)
//   posts    failed posts in either workspace (retried once automatically, then alerted); days
//            ahead with no Marketplace post
//   forms    form emails that did not go out (it runs join-notify again); requests waiting > 2 days
//   site     bursts of site errors; scheduled jobs failing or stopped; database updates waiting;
//            email and Zernio keys present
// Alerts live in ops_alerts (Systems > Health, Today). Email: at once for a new failure, and one
// summary in the 8 AM Eastern hour while anything is still open (snoozed alerts stay quiet).
//
// Body: { source?: 'cron' } — or, from a signed-in admin or Systems operator:
//   { action: 'run' }              Run checks now
//   { action: 'socialSetup' }      read-only: per workspace, the key, the accounts (and the brand
//                                  each answers for), the webhook to Carla, Zernio automations that
//                                  would answer the same messages, and failed deliveries
//   { action: 'connectWebhooks' }  creates or completes the webhook to Carla in each workspace
//                                  (only adds: events, accounts, the secret when it does not match),
//                                  sends Zernio's test message, and returns the fresh setup
// Secrets: SUPABASE_SERVICE_ROLE_KEY, ZERNIO_API_KEY, ZERNIO_COLLECTIVE_API_KEY, ZERNIO_WEBHOOK_SECRET,
//          ZERNIO_COLLECTIVE_WEBHOOK_SECRET (optional; else the Collective webhook uses ZERNIO_WEBHOOK_SECRET),
//          RESEND_API_KEY, EMAIL_FROM, OPS_ALERT_TO (comma list; falls back to DIGEST_TO, then ceo@p31market.com)
// Webhook secrets are compared here and never returned.
// Deploy: supabase functions deploy watchdog --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, layout, esc, emailConfigured } from '../_shared/email.ts';
import { zcall, zernioAccounts, siteFor, workspaceKeys, ZernioError, type Workspace, type Site } from '../_shared/zernio.ts';

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

const LATEST_DB = 59; // the newest storefront_vNN.sql in the repo
const SYSTEMS = 'https://www.thep31collective.org/systems';
const STUDIO = 'https://www.thep31collective.org/studio';
const SOCIAL_SETUP = `${SYSTEMS}/social-accounts`;
const TZ = 'America/New_York';
const HOUR = 3600e3;
const etParts = (d = new Date()) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(d).map((p) => [p.type, p.value]));
const etDate = (d = new Date()) => { const p = etParts(d); return `${p.year}-${p.month}-${p.day}`; };
const etHour = (d = new Date()) => Number(etParts(d).hour) % 24;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const recipients = () => (env('OPS_ALERT_TO') || env('DIGEST_TO') || 'ceo@p31market.com').split(',').map((s) => s.trim()).filter(Boolean);

// ── Zernio: the two workspaces and the webhook to Carla ──────────────────────
const WS_LABEL: Record<Workspace, string> = { market: 'Marketplace', collective: 'Collective' };
const KEY_NAME: Record<Workspace, string> = { market: 'ZERNIO_API_KEY', collective: 'ZERNIO_COLLECTIVE_API_KEY' };
const BRAND: Record<Site, string> = { market: 'Marketplace', collective: 'Collective' };
const SOCIAL = ['instagram', 'facebook', 'tiktok'];
const PLATFORM: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };
// What Carla takes from each workspace: DMs (and replies sent from the apps, so she steps back),
// comments, and Google reviews. The first two are the ones she cannot work without.
const CARLA_EVENTS = ['message.received', 'message.sent', 'comment.received', 'review.new'];
const MUST_HAVE = ['message.received', 'comment.received'];
const carlaUrl = () => `${env('SUPABASE_URL')}/functions/v1/dm-agent`;
const toCarla = (u: unknown) => String(u || '').trim().replace(/\/+$/, '').toLowerCase() === carlaUrl().toLowerCase();
/** The secret a workspace's webhook should sign with: the Collective's own when it is set, else the shared one. */
const secretFor = (w: Workspace) => (w === 'collective' && env('ZERNIO_COLLECTIVE_WEBHOOK_SECRET')) || env('ZERNIO_WEBHOOK_SECRET');
/** Which of Carla's secrets a webhook signs with, by name (null when none). The value never leaves this function. */
const secretName = (s: unknown) => (!s ? null : s === env('ZERNIO_WEBHOOK_SECRET') ? 'ZERNIO_WEBHOOK_SECRET'
  : s === env('ZERNIO_COLLECTIVE_WEBHOOK_SECRET') ? 'ZERNIO_COLLECTIVE_WEBHOOK_SECRET' : null);
const idOf = (x: unknown) => String((x as Row)?._id || (x as Row)?.id || (typeof x === 'string' ? x : '') || '');
const ids = (xs: unknown) => [...new Set(((xs || []) as unknown[]).map(idOf).filter(Boolean))];
// Zernio's webhook listing shows each secret, so it is compared here. If it ever leaves the secret out
// (or masks it), the newest delivery decides instead: Carla answers a wrong signature with 401.
const hidden = (h: Row) => !('secret' in h) || (typeof h.secret === 'string' && !secretName(h.secret) && /[*•]/.test(h.secret));
/** Does a webhook sign with one of Carla's secrets? 'unknown' while the secret is hidden and nothing was turned away. */
const signs = (h: Row): 'yes' | 'no' | 'unknown' => (!hidden(h) ? (secretName(h.secret) ? 'yes' : 'no') : h._lastCode === 401 ? 'no' : 'unknown');
const errText = (e: unknown) => {
  if (!(e instanceof ZernioError)) return (e as Error)?.message || String(e);
  const said = e.body?.error || e.body?.message;
  return `${typeof said === 'string' && said ? said : 'no reason given'}${e.status ? ` (${e.status})` : ''}`;
};
const handle = (a: Row) => String(a.username || '').replace(/^@/, '');
/** An account in plain words: "@name on Instagram", or the Facebook page's name. */
const words = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] || '');
const nameOf = (a: Row) => (a.platform === 'facebook' ? `the Facebook page${a.displayName ? ` ${a.displayName}` : ''}` : `@${handle(a) || PLATFORM[a.platform] || a.platform} on ${PLATFORM[a.platform] || a.platform}`);

type WsRead = { workspace: Workspace; accounts: Row[] | null; accountsError: string | null; hooks: Row[] | null; hooksError: string | null };

/** The webhooks to Carla in one listing; one whose secret is hidden gets its newest delivery's answer (_lastCode). */
async function carlaHooks(workspace: Workspace, webhooks: Row[]) {
  const ours = webhooks.filter((h) => toCarla(h.url));
  await Promise.all(ours.filter(hidden).map(async (h) => {
    const logs = await zcall(workspace, `/webhooks/logs?webhookId=${encodeURIComponent(idOf(h))}&limit=1`).catch(() => null);
    const code = logs?.logs?.[0]?.statusCode;
    h._lastCode = typeof code === 'number' ? code : null;
  }));
  return ours;
}

/** One workspace's accounts and its webhooks to Carla, read with its own key. */
async function readWorkspace(workspace: Workspace): Promise<WsRead> {
  const [acc, hooks] = await Promise.allSettled([zcall(workspace, '/accounts'), zcall(workspace, '/webhooks/settings')]);
  return {
    workspace,
    accounts: acc.status === 'fulfilled' ? ((acc.value.accounts || []) as Row[]) : null,
    accountsError: acc.status === 'rejected' ? errText(acc.reason) : null,
    hooks: hooks.status === 'fulfilled' ? await carlaHooks(workspace, (hooks.value.webhooks || []) as Row[]) : null,
    hooksError: hooks.status === 'rejected' ? errText(hooks.reason) : null,
  };
}

/** Every workspace with a key, read side by side. Accounts both keys see mean one shared Zernio team. */
async function readAll() {
  const reads = await Promise.all(workspaceKeys().map(({ workspace }) => readWorkspace(workspace)));
  const count = new Map<string, number>();
  reads.forEach((r) => (r.accounts || []).forEach((a) => count.set(idOf(a), (count.get(idOf(a)) || 0) + 1)));
  const both = new Set([...count].filter(([, n]) => n > 1).map(([id]) => id));
  // The brand an account answers for (TikTok is always the Market's; see _shared/zernio.ts).
  const siteOf = (a: Row, w: Workspace) => siteFor({ id: idOf(a), workspace: both.has(idOf(a)) ? null : w, platform: a.platform, username: handle(a), displayName: a.displayName });
  return { reads, both, siteOf };
}

/** Does this webhook deliver this account's events? (No account or profile list means every one.) */
const covers = (h: Row, a: Row) => {
  const accounts = ids(h.accountIds);
  const profiles = ids(h.profileIds);
  return (!accounts.length || accounts.includes(idOf(a))) && (!profiles.length || profiles.includes(idOf(a.profileId)));
};

/** A webhook limited to certain accounts (or profiles) gets these accounts (or their profiles) added; an open one stays open. */
function widen(scope: { accountIds: string[]; profileIds: string[] }, accounts: Row[]) {
  const patch: Row = {};
  const changed: string[] = [];
  if (scope.accountIds.length) {
    const all = [...new Set([...scope.accountIds, ...accounts.map(idOf).filter(Boolean)])];
    if (all.length > scope.accountIds.length) { patch.accountIds = all; changed.push('accounts'); }
  }
  if (scope.profileIds.length) {
    const all = [...new Set([...scope.profileIds, ...accounts.map((a) => idOf(a.profileId)).filter(Boolean)])];
    if (all.length > scope.profileIds.length) { patch.profileIds = all; changed.push('profiles'); }
  }
  return { patch, changed };
}

/** What keeps a workspace's messages from reaching Carla, in plain words (empty when nothing does). */
function hookProblems(r: WsRead): string[] {
  if (!r.hooks) return [];
  if (!r.hooks.length) return ['No webhook sends its messages and comments to Carla'];
  const live = r.hooks.filter((h) => h.isActive !== false);
  if (!live.length) return ['The webhook to Carla is switched off (Zernio switches one off after three days of failed deliveries)'];
  const out: string[] = [];
  const events = new Set(live.flatMap((h) => (h.events || []) as string[]));
  const missing = MUST_HAVE.filter((e) => !events.has(e));
  if (missing.length) out.push(`The webhook does not send ${missing.map((e) => (e === 'comment.received' ? 'new comments' : 'new messages')).join(' or ')}`);
  if (live.some((h) => signs(h) === 'no')) out.push('Its signing secret does not match the one Carla checks, so she turns its deliveries away');
  const left = (r.accounts || []).filter((a) => SOCIAL.includes(a.platform) && !live.some((h) => covers(h, a)));
  if (left.length) out.push(`It leaves out ${words(left.map(nameOf))}`);
  return out;
}

// ── The checks ───────────────────────────────────────────────────────────────
// Each returns the problems it found; healing actions are pushed to `healed`.

async function checkSocial(): Promise<Problem[]> {
  if (!workspaceKeys().length) return [{ key: 'config.zernio', severity: 'fail', area: 'social', title: 'Zernio is not connected to the site', fix: 'Add the ZERNIO_API_KEY or ZERNIO_COLLECTIVE_API_KEY secret in Supabase (Edge Functions > Secrets).' }];

  const out: Problem[] = [];
  const seen = new Set<string>();
  const { reads, siteOf } = await readAll();

  for (const r of reads) {
    const label = WS_LABEL[r.workspace];
    if (!r.accounts) {
      out.push({ key: `social.key.${r.workspace}`, severity: 'fail', area: 'social', title: `The ${label} Zernio key isn’t working`, detail: `Zernio would not list its accounts: ${r.accountsError}. Until it works, posts, DMs and comments for those accounts are not handled.`, fix: `Check ${KEY_NAME[r.workspace]} in Supabase > Edge Functions > Secrets (a new key comes from Zernio > Settings > API keys), then open Systems > Social accounts.`, link: SOCIAL_SETUP });
      continue;
    }
    const social = r.accounts.filter((a) => SOCIAL.includes(a.platform));
    for (const a of social) {
      if (seen.has(idOf(a))) continue;
      seen.add(idOf(a));
      const name = a.platform === 'facebook' ? (a.displayName || 'Facebook') : `@${handle(a) || PLATFORM[a.platform]}`;
      const brand = BRAND[siteOf(a, r.workspace)];
      if (a.needsReconnection || a.isActive === false || a.enabled === false) {
        out.push({ key: `social.reconnect.${idOf(a)}`, severity: 'fail', area: 'social', title: `${name} (${brand}) needs reconnecting in Zernio`, detail: 'Scheduled posts to it will not go out, and Carla cannot answer it, until it is reconnected.', fix: `Zernio > Accounts > ${name} > Reconnect.`, link: 'https://zernio.com' });
      }
      if (a.tokenExpiresAt) {
        const days = Math.floor((new Date(a.tokenExpiresAt).getTime() - Date.now()) / (24 * HOUR));
        if (days <= 14) out.push({ key: `social.token.${idOf(a)}`, severity: days <= 3 ? 'fail' : 'warn', area: 'social', title: days < 0 ? `${name} login has expired` : `${name} login expires in ${plural(Math.max(0, days), 'day')}`, detail: `Zernio's access to ${name} (${brand}) ends ${new Date(a.tokenExpiresAt).toLocaleDateString('en-US', { timeZone: TZ, month: 'long', day: 'numeric' })}; posts stop going out after that.`, fix: `Reconnect ${name} in Zernio before then.`, link: 'https://zernio.com' });
      }
    }
    // The webhook that brings this workspace's DMs and comments to Carla.
    if (!social.length) continue;
    const who = words(social.map(nameOf));
    if (!r.hooks) {
      out.push({ key: `social.webhook.${r.workspace}`, severity: 'warn', area: 'social', title: `Could not check that Carla gets the ${label} messages`, detail: `Zernio would not list the webhooks for ${who}: ${r.hooksError}.`, fix: 'Open Systems > Social accounts. If it keeps happening, the key may not be allowed to read webhooks.', link: SOCIAL_SETUP });
      continue;
    }
    const problems = hookProblems(r);
    if (problems.length) out.push({ key: `social.webhook.${r.workspace}`, severity: 'fail', area: 'social', title: `Carla isn’t getting the messages for ${who}`, detail: `${problems.join('. ')}.`, fix: 'Systems > Social accounts: press “Connect Carla to both accounts”.', link: SOCIAL_SETUP });
  }
  return out;
}

// deno-lint-ignore no-explicit-any
async function checkPosts(db: any, healed: string[]): Promise<Problem[]> {
  const keys = workspaceKeys();
  if (!keys.length) return [];
  const out: Problem[] = [];
  const { data: openPost } = await db.from('ops_alerts').select('key, meta').like('key', 'post.failed.%').is('resolved_at', null);
  const retried = new Map((openPost || []).map((a: Row) => [a.key, a.meta]));
  // Each workspace with its own key: failed posts from the last week are retried there once, then
  // alerted if they still fail; its scheduled posts are gathered for the empty-days check.
  const scheduled: Row[] = [];
  const done = new Set<string>();
  const broken: Workspace[] = [];
  for (const { workspace } of keys) {
    try {
      const failed = (await zcall(workspace, '/posts?status=failed&limit=100')).posts || [];
      const recent = failed.filter((p: Row) => Date.now() - new Date(p.scheduledFor || p.updatedAt || p.createdAt || 0).getTime() < 7 * 24 * HOUR);
      for (const p of recent) {
        const id = idOf(p);
        if (done.has(id)) continue;
        done.add(id);
        const key = `post.failed.${id}`;
        const err = (p.platforms || []).map((x: Row) => x.errorMessage || x.error).filter(Boolean)[0] || '';
        const when = p.scheduledFor ? new Date(p.scheduledFor).toLocaleString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
        const title = String(p.title || p.content || 'A post').split('\n')[0].slice(0, 80);
        if (!retried.has(key)) {
          try { await zcall(workspace, `/posts/${id}/retry`, { method: 'POST' }); healed.push(`Retried the failed post "${title}"`); } catch { /* alert below either way */ }
          out.push({ key, severity: 'warn', area: 'posts', title: `A post failed and was retried: ${title}`, detail: `${when ? `${when} ET. ` : ''}${err}`.trim(), fix: 'Nothing to do unless it fails again; then open it in Content Studio > Calendar > Studio history.', link: `${STUDIO}/calendar`, meta: { retried: true, postId: id, workspace } });
        } else {
          out.push({ key, severity: 'fail', area: 'posts', title: `A post keeps failing: ${title}`, detail: `${when ? `${when} ET. ` : ''}${err || 'It failed again after an automatic retry.'}`.trim(), fix: 'Open it in Content Studio > Calendar > Studio history: try again, or edit the media or caption (a reconnect in Zernio fixes most).', link: `${STUDIO}/calendar`, meta: { retried: true, postId: id, workspace } });
        }
      }
      // Every scheduled page (Zernio does not sort, so sorting happens below).
      for (let page = 1; page <= 10; page += 1) {
        const r = await zcall(workspace, `/posts?status=scheduled&limit=100&page=${page}`);
        scheduled.push(...(r.posts || []).map((p: Row) => ({ ...p, _workspace: workspace })));
        if (page >= (r.pagination?.pages || 1)) break;
      }
    } catch (e) {
      // One workspace failing leaves the other checked (a broken key also raises social.key.*).
      if (broken.length === keys.length - 1) throw e;
      broken.push(workspace);
      out.push({ key: `check.posts.${workspace}`, severity: 'warn', area: 'posts', title: `The ${WS_LABEL[workspace]} posts could not be checked`, detail: errText(e).slice(0, 300), fix: 'Usually a connection hiccup. If it repeats, open Systems > Social accounts to check the key.', link: SOCIAL_SETUP });
    }
  }
  // Autopilot batches waiting more than a day for someone's yes.
  const { data: waiting } = await db.from('autopilot_batches').select('id, first_day').eq('status', 'awaiting').lt('created_at', new Date(Date.now() - 24 * HOUR).toISOString()).limit(1);
  if (waiting?.[0]) out.push({ key: `autopilot.waiting.${waiting[0].id}`, severity: 'warn', area: 'posts', title: 'Drafted posts are waiting for approval', detail: `The autopilot's batch starting ${new Date(`${waiting[0].first_day}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} needs a yes before any of it can go out.`, fix: 'Open the review link in the email, or Content Studio > Auto-create > Autopilot > Review.', link: `${STUDIO}/autocreate?tab=autopilot` });
  // Days ahead with nothing booked for the Marketplace (its Instagram, Facebook or TikTok). Skipped
  // while a workspace can't be read, so a hiccup never reads as an empty week.
  if (!broken.length) {
    const accounts: { id: string; site: Site }[] = await zernioAccounts().then((c) => c.accounts).catch(() => []);
    const siteOf = (x: Row, w: Workspace) => accounts.find((a) => a.id === idOf(x.accountId))?.site || siteFor({ id: idOf(x.accountId), workspace: w, platform: x.platform });
    const seenPost = new Set<string>();
    const market = scheduled.filter((p) => {
      if (!p.scheduledFor || seenPost.has(idOf(p))) return false;
      seenPost.add(idOf(p));
      return (p.platforms || []).some((x: Row) => siteOf(x, p._workspace) === 'market');
    });
    market.sort((a, b) => new Date(a.scheduledFor || 0).getTime() - new Date(b.scheduledFor || 0).getTime());
    const days = new Set(market.map((p: Row) => p.scheduledFor && etDate(new Date(p.scheduledFor))).filter(Boolean));
    const next = Array.from({ length: 7 }, (_, i) => etDate(new Date(Date.now() + (i + 1) * 24 * HOUR)));
    const empty = next.filter((d) => !days.has(d));
    if (empty.length >= 3 || (empty.includes(next[0]) && empty.includes(next[1]))) {
      const last = market.length ? etDate(new Date(market[market.length - 1].scheduledFor)) : null;
      out.push({ key: 'posts.queue', severity: empty.length >= 5 ? 'fail' : 'warn', area: 'posts', title: `${plural(empty.length, 'day')} of the next 7 have no Marketplace post`, detail: `Booked through ${last || 'nothing yet'}. Empty: ${empty.map((d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })).join(', ')}.`, fix: 'Content Studio > Auto-create, or the Design studio\'s Batch, fills the gaps in a few minutes.', link: `${STUDIO}/autocreate` });
    }
  }
  return out;
}

// ── Social accounts setup (Systems > Social accounts) ────────────────────────

/**
 * Read-only: per workspace, the key, its accounts (with the brand each answers for), the webhook to
 * Carla, Zernio automations that would answer the same messages, and recent failed deliveries.
 * A webhook both keys see (one shared Zernio team) is listed once.
 */
async function socialSetup() {
  const { reads, both, siteOf } = await readAll();
  const listed = env('DM_AGENT_ACCOUNT_IDS').split(',').map((s) => s.trim()).filter(Boolean);
  const hooks = new Map<string, { h: Row; workspaces: Workspace[] }>();
  const names = new Map<string, string>();
  reads.forEach((r) => {
    (r.accounts || []).forEach((a) => names.set(idOf(a), nameOf(a)));
    (r.hooks || []).forEach((h) => {
      const hit = hooks.get(idOf(h));
      if (hit) hit.workspaces.push(r.workspace);
      else hooks.set(idOf(h), { h, workspaces: [r.workspace] });
    });
  });

  const workspaces = await Promise.all((['market', 'collective'] as Workspace[]).map(async (w) => {
    const base = { workspace: w, label: WS_LABEL[w], keyName: KEY_NAME[w] };
    const r = reads.find((x) => x.workspace === w);
    if (!r) return { ...base, keySet: false };
    const social = (r.accounts || []).filter((a) => SOCIAL.includes(a.platform));
    const [health, automations, workflows] = await Promise.all([
      // TikTok answers DMs and comments only through the Business app ("business" lane).
      Promise.all(social.map((a) => (a.platform === 'tiktok' ? zcall(w, `/accounts/${encodeURIComponent(idOf(a))}/health`).catch(() => null) : null))),
      zcall(w, '/comment-automations').catch((e) => ({ error: errText(e) })),
      zcall(w, '/workflows?limit=50').catch((e) => ({ error: errText(e) })),
    ]);
    const autoOn = ((automations.automations || []) as Row[]).filter((a) => a.isActive !== false);
    const flowOn = ((workflows.workflows || []) as Row[]).filter((f) => f.status === 'active');
    const collisions: string[] = [];
    if (autoOn.length) collisions.push(`${plural(autoOn.length, 'comment-to-DM automation')} switched on in Zernio (${autoOn.slice(0, 4).map((a) => a.name || 'unnamed').join(', ')}). ${autoOn.length === 1 ? 'It answers' : 'They answer'} comments too, so people could get two replies. Pause ${autoOn.length === 1 ? 'it' : 'them'} in Zernio > Automations.`);
    if (flowOn.length) collisions.push(`${plural(flowOn.length, 'Zernio workflow')} switched on (${flowOn.slice(0, 4).map((f) => f.name || 'unnamed').join(', ')}). ${flowOn.length === 1 ? 'It replies' : 'They reply'} to DMs too, so people could get two answers. Pause ${flowOn.length === 1 ? 'it' : 'them'} in Zernio > Workflows.`);
    return {
      ...base, keySet: true,
      accountsOk: !!r.accounts, accountsError: r.accountsError,
      accounts: social.map((a, i) => ({
        id: idOf(a), platform: a.platform, username: handle(a), displayName: a.displayName || '', site: siteOf(a, w),
        active: a.isActive !== false && a.enabled !== false, needsReconnection: !!a.needsReconnection, tokenExpiresAt: a.tokenExpiresAt || null,
        tiktokAccountType: a.tiktokAccountType || null, integrationLane: health[i]?.integrationLane || null, health: health[i]?.status || null,
        // Carla's own allow-list (DM_AGENT_ACCOUNT_IDS): null when it is not set (every account).
        carlaListening: listed.length ? listed.includes(idOf(a)) : null,
        bothKeys: both.has(idOf(a)),
      })),
      webhooksOk: !!r.hooks, webhooksError: r.hooksError,
      webhookIds: (r.hooks || []).map(idOf),
      problems: social.length ? hookProblems(r) : [],
      automations: automations.error ? null : { total: (automations.automations || []).length, active: autoOn.length },
      workflows: workflows.error ? null : { total: (workflows.workflows || []).length, active: flowOn.length },
      automationsError: automations.error || workflows.error || null,
      collisions,
    };
  }));

  const webhooks = await Promise.all([...hooks.values()].map(async ({ h, workspaces: seenBy }) => {
    const logs = await zcall(seenBy[0], `/webhooks/logs?webhookId=${encodeURIComponent(idOf(h))}&status=failed&limit=20`).catch((e) => ({ error: errText(e) }));
    const only = ids(h.accountIds);
    const signed = signs(h);
    return {
      id: idOf(h), name: h.name || '', workspaces: seenBy, events: h.events || [], isActive: h.isActive !== false,
      missingEvents: CARLA_EVENTS.filter((e) => !(h.events || []).includes(e)),
      accountIds: only, accounts: only.map((id) => names.get(id) || 'an account no longer connected'), profileCount: ids(h.profileIds).length,
      lastFiredAt: h.lastFiredAt || null, failureCount: h.failureCount ?? 0,
      // null when Zernio did not show the secret (and nothing has been turned away).
      hasSecret: hidden(h) ? null : !!h.secret, secretMatches: signed === 'unknown' ? null : signed === 'yes', secretName: hidden(h) ? null : secretName(h.secret),
      failures: ((logs.logs || []) as Row[]).map((l) => ({ event: l.event, statusCode: l.statusCode ?? null, error: String(l.errorMessage || '').slice(0, 200), at: l.createdAt || null, attempt: l.attemptNumber ?? null, test: !!l.test })),
      failuresError: logs.error || null,
    };
  }));

  return {
    checkedAt: new Date().toISOString(),
    carlaUrl: carlaUrl(),
    secrets: { ZERNIO_WEBHOOK_SECRET: !!env('ZERNIO_WEBHOOK_SECRET'), ZERNIO_COLLECTIVE_WEBHOOK_SECRET: !!env('ZERNIO_COLLECTIVE_WEBHOOK_SECRET') },
    carlaList: listed.length > 0,
    sharedTeam: both.size > 0 || webhooks.some((h) => h.workspaces.length > 1),
    workspaces, webhooks,
  };
}

/** Zernio's sample message to Carla, and what she answered (the newest test delivery in the logs). */
async function testHook(workspace: Workspace, webhookId: string) {
  const started = Date.now();
  let error: string | null = null;
  try { await zcall(workspace, '/webhooks/test', { method: 'POST', body: JSON.stringify({ webhookId, event: 'message.received' }) }); }
  catch (e) { error = errText(e); }
  const logs = await zcall(workspace, `/webhooks/logs?webhookId=${encodeURIComponent(webhookId)}&event=message.received&limit=5`).catch(() => null);
  // Only a delivery Zernio marks as a test: a real DM delivered meanwhile is not the answer.
  const last = ((logs?.logs || []) as Row[]).find((l) => l.test === true && new Date(l.createdAt || 0).getTime() >= started - 60e3);
  const code = typeof last?.statusCode === 'number' ? last.statusCode : null;
  const ok = !error && (code === null || (code >= 200 && code < 300));
  const note = ok ? 'Carla answered Zernio’s test message.'
    : code === 401 ? 'Carla turned the test away (401): the webhook’s secret does not match the one she checks.'
      : code ? `Carla answered the test with ${code}${last?.errorMessage ? ` (${String(last.errorMessage).slice(0, 120)})` : ''}.`
        : `The test did not go through${error ? `: ${error}` : ''}.`;
  return { ok, statusCode: code, note };
}

/**
 * The "Connect Carla" button: in each workspace, create the webhook to Carla, or complete the one
 * there. Nothing is ever removed: events and accounts are only added, and the secret is set only
 * when it does not match. Then Zernio sends its test message, and the fresh setup comes back.
 * When both keys are in one Zernio team they share one webhook: the second key only adds its
 * accounts (or profiles) to it, if it is limited to certain ones.
 */
async function connectWebhooks() {
  // Webhook id → the workspace that set it up, and the accounts and profiles it is limited to now
  // (one shared Zernio team sees one webhook through both keys).
  const handled = new Map<string, { workspace: Workspace; accountIds: string[]; profileIds: string[] }>();
  const results: Row[] = [];
  for (const { workspace } of workspaceKeys()) {
    const secret = secretFor(workspace);
    if (!secret) {
      results.push({ workspace, ok: false, action: 'none', note: 'Add the ZERNIO_WEBHOOK_SECRET secret in Supabase first: Carla only answers deliveries signed with it.' });
      continue;
    }
    try {
      const [{ accounts = [] }, { webhooks = [] }] = await Promise.all([zcall(workspace, '/accounts'), zcall(workspace, '/webhooks/settings')]);
      const ours = await carlaHooks(workspace, webhooks as Row[]);
      const shared = ours.find((h) => handled.has(idOf(h)));
      if (shared) {
        // Set up through the other key already. If it is limited to certain accounts or profiles, this
        // key's are added too (a key limited to its own profiles lets the other key see none of them).
        // It builds on what the first key set, and an open webhook stays open.
        const was = handled.get(idOf(shared))!;
        const scope = {
          accountIds: ids(shared.accountIds).length ? ids([...was.accountIds, ...ids(shared.accountIds)]) : [],
          profileIds: ids(shared.profileIds).length ? ids([...was.profileIds, ...ids(shared.profileIds)]) : [],
        };
        const { patch, changed } = widen(scope, accounts as Row[]);
        if (changed.length) {
          await zcall(workspace, '/webhooks/settings', { method: 'PUT', body: JSON.stringify({ webhookId: idOf(shared), ...patch }) });
          Object.assign(was, patch);
        }
        results.push({
          workspace, ok: true, action: changed.length ? 'updated' : 'shared', changed, webhookId: idOf(shared),
          note: `This key is in the same Zernio team as the ${WS_LABEL[was.workspace]} key, so they share one webhook to Carla${changed.length ? '; this key’s profiles were added to it' : ''}.`,
        });
        continue;
      }
      let hook: Row;
      let action = 'unchanged';
      const changed: string[] = [];
      let scope = { accountIds: [] as string[], profileIds: [] as string[] };
      if (!ours.length) {
        const out = await zcall(workspace, '/webhooks/settings', { method: 'POST', body: JSON.stringify({ name: 'Carla (dm-agent)', url: carlaUrl(), events: CARLA_EVENTS, secret, isActive: true }) });
        hook = out.webhook || out;
        action = 'created';
      } else {
        // Complete the one that is there (a switched-on one first).
        hook = ours.find((h) => h.isActive !== false) || ours[0];
        const had: string[] = hook.events || [];
        const patch: Row = { webhookId: idOf(hook), events: [...new Set([...had, ...CARLA_EVENTS])], isActive: true };
        if (patch.events.length > had.length) changed.push('events');
        if (hook.isActive === false) changed.push('switched on');
        if (signs(hook) === 'no') { patch.secret = secret; changed.push('secret'); }
        scope = { accountIds: ids(hook.accountIds), profileIds: ids(hook.profileIds) };
        const wider = widen(scope, accounts as Row[]);
        Object.assign(patch, wider.patch);
        changed.push(...wider.changed);
        if (changed.length) {
          await zcall(workspace, '/webhooks/settings', { method: 'PUT', body: JSON.stringify(patch) });
          action = 'updated';
          scope = { accountIds: patch.accountIds || scope.accountIds, profileIds: patch.profileIds || scope.profileIds };
        }
      }
      handled.set(idOf(hook), { workspace, ...scope });
      let test = await testHook(workspace, idOf(hook));
      // Zernio did not show the secret and Carla turned the test away: set ours, then test once more.
      if (test.statusCode === 401 && signs(hook) === 'unknown') {
        await zcall(workspace, '/webhooks/settings', { method: 'PUT', body: JSON.stringify({ webhookId: idOf(hook), secret }) });
        changed.push('secret');
        action = 'updated';
        test = await testHook(workspace, idOf(hook));
      }
      results.push({ workspace, ok: true, action, changed, webhookId: idOf(hook), test });
    } catch (e) {
      results.push({ workspace, ok: false, action: 'failed', note: errText(e) });
    }
  }
  return { results, setup: await socialSetup() };
}

const FORM_TABLES: [string, string, string][] = [
  ['vendor_applications', 'vendor applications', `${SYSTEMS}/vendors`],
  ['collective_applications', 'Collective applications', `${SYSTEMS}/applications`],
  ['vendor_agreements', 'storefront agreements', `${SYSTEMS}/forms`],
  ['vendor_registrations', 'market registrations', `${SYSTEMS}/forms`],
  ['vendor_feedback', 'feedback surveys', `${SYSTEMS}/forms`],
  ['volunteer_signups', 'volunteer forms', `${SYSTEMS}/forms`],
  ['academy_inquiries', 'mentorship intro-call requests', `${SYSTEMS}/academy`],
  ['coaching_intakes', 'coaching form links', `${SYSTEMS}/academy`],
  ['coaching_forms', 'signed coaching forms', `${SYSTEMS}/academy`],
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
    if (['vendor_feedback', 'volunteer_signups', 'coaching_intakes', 'coaching_forms'].includes(t)) continue;
    const { count, error } = await db.from(t).select('id', { count: 'exact', head: true }).eq('status', 'new').lte('created_at', old);
    if (!error && count) out.push({ key: `forms.waiting.${t}`, severity: 'warn', area: 'forms', title: `${plural(count, label.replace(/s$/, ''), label)} waiting more than 2 days`, fix: 'Open them and approve, decline or reply; the person is waiting to hear back.', link });
  }
  // Shops that have products and have waited more than two days for a yes (empty sign-ups are left alone).
  const { data: inReview } = await db.from('curator_data').select('id, business_name').eq('status', 'pending').lte('created_at', old).limit(100);
  if (inReview?.length) {
    const { data: stocked } = await db.from('products').select('curator_id').in('curator_id', inReview.map((s: { id: string }) => s.id));
    const ready = inReview.filter((s: { id: string }) => (stocked || []).some((p: { curator_id: string }) => p.curator_id === s.id));
    if (ready.length) out.push({ key: 'shops.waiting', severity: 'warn', area: 'forms', title: `${plural(ready.length, 'shop')} waiting for review`, detail: `${ready.slice(0, 3).map((s: { business_name: string }) => s.business_name).join(', ')}${ready.length > 3 ? ' and more' : ''} added products and are waiting to go live.`, fix: 'Systems > Shops: open each one and approve it, or choose Needs changes with a note.', link: `${SYSTEMS}/shops` });
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

  // From Systems, only for admins and Systems operators: "Run checks now" (Health), and the social
  // accounts setup with its "Connect Carla" button (Social accounts).
  if (['run', 'socialSetup', 'connectWebhooks'].includes(b.action)) {
    const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
    const [{ data: admin }, { data: operator }] = await Promise.all([asUser.rpc('is_academy_admin'), asUser.rpc('is_operator')]);
    if (!admin && !operator) return json({ error: b.action === 'run' ? 'Only admins can run the checks.' : 'Only admins can see or change how the social accounts are connected.' }, 403);
    try {
      if (b.action === 'socialSetup') return json(await socialSetup());
      if (b.action === 'connectWebhooks') return json(await connectWebhooks());
      return json(await run(db, 'admin'));
    } catch (e) { console.error(`watchdog ${b.action} failed`, (e as Error).message); return json({ error: (e as Error).message }, 500); }
  }

  // The schedule (or anyone else): at most once every ten minutes.
  const { data: last } = await db.from('ops_runs').select('ran_at').order('ran_at', { ascending: false }).limit(1);
  if (last?.[0] && Date.now() - new Date(last[0].ran_at).getTime() < 10 * 60e3) return json({ skipped: 'ran less than ten minutes ago' });
  try { return json(await run(db, String(b.source || 'cron').slice(0, 20))); } catch (e) { console.error('watchdog failed', e); return json({ error: (e as Error).message }, 500); }
});
