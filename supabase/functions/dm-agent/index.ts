// Supabase Edge Function: dm-agent
// Carla: answers Instagram, Facebook and TikTok DMs and comments, and thanks people for Google reviews,
// for both P31 brands, in the persona from persona.ts, with Gemini (GEMINI_API_KEY, model GEMINI_MODEL)
// or, when no Gemini key is set or Gemini fails, Claude (ANTHROPIC_API_KEY). Zernio calls this
// function for every inbox event; it verifies the signature, answers 200 right away (Zernio's limit
// is 5 seconds), then writes and sends the reply in the background.
//
// Two Zernio workspaces, one key each (see ../_shared/zernio.ts):
//   market      ZERNIO_API_KEY             Instagram @proverbs31market, the Facebook page, Google Business
//   collective  ZERNIO_COLLECTIVE_API_KEY  Instagram @the.p31collective, plus the Market's TikTok
// The brand Carla speaks for comes from the account (looked up live with GET /accounts), not the
// workspace: @the.p31collective gets the Collective persona and only the Collective's pages; the
// TikTok, @proverbs31market, the Facebook page and Google reviews get the Marketplace's. Every Zernio
// call uses the key of the workspace the account lives in.
//
// Setup:
//   supabase secrets set ZERNIO_API_KEY=... ZERNIO_COLLECTIVE_API_KEY=... ZERNIO_WEBHOOK_SECRET=<random string>
//   optional: ZERNIO_COLLECTIVE_WEBHOOK_SECRET=<random string>  when the Collective webhook signs with its own secret
//   supabase secrets set GEMINI_API_KEY=...   (and/or ANTHROPIC_API_KEY=sk-ant-...)
//   supabase secrets set DM_AGENT_ENABLED=true   (anything else = off; the kill switch for DMs)
//   COMMENT_AGENT_ENABLED=true   public replies under our Instagram, Facebook and TikTok posts
//   Per brand, admins switch DM and comment auto-replies on or off in Systems > Social accounts
//   (app_settings 'carla'); the secrets above stay the master switches.
//   REVIEW_AGENT_ENABLED=true    thank-you replies to 4–5★ Google reviews (Marketplace)
//   optional: DM_AGENT_DRY_RUN=true          write replies to the logs, send nothing
//   optional: DM_AGENT_ACCOUNT_IDS=id1,id2   extra Zernio account ids to answer for. Every Instagram,
//             Facebook and TikTok account connected in either workspace is answered already; this list
//             is only for an account GET /accounts does not show (it is no longer a limit).
//   optional: DM_AGENT_SKIP_ACCOUNT_IDS=id1  accounts Carla never answers (one connected in a P31
//             workspace that is not a P31 account). Check GET /accounts with each key before going live.
//   optional: ZERNIO_ACCOUNT_SITES=<id>=market,<id>=collective   force the brand of an account
//   optional: DM_AGENT_NOTIFY_EMAIL=...      email the team on handoffs and info requests (needs RESEND_API_KEY)
//   supabase functions deploy dm-agent
// Then, in EACH Zernio workspace, point a webhook at https://<project>.supabase.co/functions/v1/dm-agent
// with the events message.received, message.sent and comment.received (plus review.new in the
// Market workspace, for Google Business), signed with ZERNIO_WEBHOOK_SECRET (or the Collective secret).
// Leave its accountIds empty (every account in the workspace) or list them all; the Collective
// webhook must cover the TikTok too. Zernio's sample events (POST /webhooks/test, "test": true) are
// acknowledged and ignored.
//
// Canned replies (triggers.ts): the owner's keyword templates for each brand, and on the Marketplace
// the "Tell me more" flow: ask for an email address, thank them, and record a lead for the team
// (dm_handoffs kind 'lead', the CRM and an email; the team sends the details within 24–48 hours).
// A keyword comment on Instagram or Facebook gets a private DM plus a public reply; TikTok has no
// private replies, so its public reply carries the link itself.
//
// Story replies and story mentions arrive as DMs and are answered like any DM. Google reviews under
// 4 stars, or anything Carla flags, email DM_AGENT_NOTIFY_EMAIL instead of being answered.
//
// Preview: a correctly signed request with header `X-DM-Preview: 1` is answered synchronously with
// the reply the agent would write; nothing is sent and nothing is recorded. Add `X-DM-Site: market`
// or `X-DM-Site: collective` to choose the brand without a real account id (preview only). A DM
// preview still reads the conversation from Zernio, so it needs a real conversation and account.
//
// When a person on the team answers a conversation themselves (message.sent with sentVia "human"),
// Carla stays out of that conversation for 24 hours. Replies, pauses and caps are counted in
// ai_usage (task dm_* / comment_*); handoffs and leads go to dm_handoffs (Studio > Messages).
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { personaFor } from './persona.ts';
import { KNOWLEDGE, KNOWLEDGE_DATE } from './knowledge.ts';
import { EMAIL_THANKS, isRude, pickTrigger, publicReply, type Pick } from './triggers.ts';
import { sendEmail, layout } from '../_shared/email.ts';
import { recipients } from '../_shared/notify.ts';
import { siteFor, zernioAccount, zernioAccounts, zernioFor, ZernioError, type Site } from '../_shared/zernio.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const MODEL = 'claude-opus-5-5';
const PLATFORMS = new Set(['instagram', 'facebook', 'tiktok']);
const PAUSE_HOURS = 24;
const DAILY_REPLY_CAP = 400;    // a runaway-loop guard, far above normal volume
const SETTLE_MS = 6000;         // wait for people who send several messages in a row
const HISTORY = 20;             // messages of context per reply

const env = (k: string) => Deno.env.get(k) || '';
const admin = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const enc = encodeURIComponent;

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ── Which brand, which account ──
// Carla answers for one brand per account: `site` picks the persona, the knowledge and the live facts,
// `handle` is our own account's @username for the team's emails.
type Ctx = { site: Site; handle: string };

const BRAND: Record<Site, string> = { market: 'Marketplace', collective: 'Collective' };
const PLATFORM_NAME: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' };
const platformName = (p: string) => PLATFORM_NAME[p] || (p ? p[0].toUpperCase() + p.slice(1) : 'social media');
const ourAccount = (ctx: Ctx) => `${BRAND[ctx.site]}${ctx.handle ? ` @${ctx.handle}` : ''}`;

/** The brand an event's account answers for: the connected account's own, else a guess from the event. */
async function contextFor(evt: any, forced: Site | null = null): Promise<Ctx> {
  const a = evt.account || {};
  const id: string = a.accountId || a.id || '';
  const known = await zernioAccount(id).catch(() => null);
  const platform = String(a.platform || evt.message?.platform || evt.comment?.platform || '');
  const site = forced ?? known?.site ?? siteFor({ id, platform, username: a.username, displayName: a.displayName });
  return { site, handle: known?.username || a.username || '' };
}

// ── The website knowledge, per brand ──
// The Marketplace knows both sites (it points mentorship and membership questions to the Collective);
// the Collective knows only its own pages.
const [, ...SECTIONS] = KNOWLEDGE.split(/\n\n(?=## )/);
const KNOWLEDGE_FOR: Record<Site, string> = {
  market: KNOWLEDGE,
  collective: [
    `Everything published on thep31collective.org, page by page, read on ${KNOWLEDGE_DATE}. Use it to answer questions. Quote links exactly as they appear here.`,
    ...SECTIONS.filter((s) => s.startsWith('## thep31collective.org')),
  ].join('\n\n'),
};

type ZMessage = {
  id: string; message?: string; direction: 'incoming' | 'outgoing'; createdAt: string;
  attachments?: { type?: string; originalType?: string }[];
  storyReply?: { storyId: string }; isStoryMention?: boolean;
};

// What a message "says" when it is only a photo, reel, story reply or story mention.
function describe(m: ZMessage) {
  const text = (m.message || '').trim();
  const notes = new Set<string>();
  if (m.storyReply) notes.add('replying to one of our stories');
  if (m.isStoryMention) notes.add('mentioned us in their story');
  for (const a of m.attachments || []) {
    const t = a.originalType || a.type || 'attachment';
    if (t === 'story_mention') notes.add('mentioned us in their story');
    else if (t === 'ig_story' || t === 'story') notes.add('shared a story');
    else notes.add(`sent a ${t.replace(/^ig_/, '')}`);
  }
  return [text, notes.size ? `[${[...notes].join(', ')}]` : ''].filter(Boolean).join(' ');
}

const esc = (s: string) => s.replace(/[<>&]/g, '');

// ── Never the same thing twice ──
// Two replies are "the same" when they share most of their words (greetings and links included).
const words = (s: string) => new Set(s.toLowerCase().replace(/https?:\/\/\S+/g, (u) => ` ${u} `).split(/[^a-z0-9:/._-]+/).filter((w) => w.length > 2));
function isRepeat(reply: string, sent: string[]) {
  const a = words(reply);
  if (!a.size) return false;
  return sent.some((prev) => {
    const b = words(prev);
    if (!b.size) return false;
    let shared = 0;
    for (const w of a) if (b.has(w)) shared++;
    return shared / Math.min(a.size, b.size) >= 0.75 || reply.trim().toLowerCase() === prev.trim().toLowerCase();
  });
}

/** One reply per message: the first delivery claims it, a repeat delivery finds the claim and stops. */
async function claim(db: ReturnType<typeof admin>, key: string) {
  const { error } = await db.from('dm_claims').insert({ key });
  if (!error) {
    if (Math.random() < 0.02) await db.from('dm_claims').delete().lt('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString());
    return true;
  }
  if (/duplicate key|23505/.test(`${error.code} ${error.message}`)) return false;
  console.warn('dm-agent: claim table unavailable, carrying on —', error.message);
  return true;
}

/**
 * Save a row for Studio > Messages. The site and email columns and the 'lead' kind arrive with SQL v57;
 * until it runs, the row is saved without them (a lead as a 'dm', its email kept in the reason).
 */
async function saveHandoff(db: ReturnType<typeof admin>, row: Record<string, unknown>) {
  let { error } = await db.from('dm_handoffs').insert(row);
  if (error && (/42703|23514|PGRST204/.test(String(error.code)) || /column|check constraint/i.test(error.message))) {
    const older: Record<string, unknown> = { ...row, kind: row.kind === 'lead' ? 'dm' : row.kind };
    if (row.email) older.reason = `${row.reason} Email: ${row.email}`;
    delete older.site;
    delete older.email;
    ({ error } = await db.from('dm_handoffs').insert(older));
  }
  if (error) console.warn('dm-agent: handoff not recorded —', error.message);
}

/** Record a handoff for the Content Studio inbox and email the team. */
async function handoff(db: ReturnType<typeof admin>, site: Site, row: Record<string, unknown>, subject: string, title: string, html: string) {
  await saveHandoff(db, { ...row, site });
  await notifyTeam(site, subject, title, `${html}<p><a href="https://www.thep31collective.org/studio/inbox">Open Messages in the Content Studio</a></p>`);
}

// Email the team when something needs a person (needs RESEND_API_KEY), in the brand's own colors.
async function notifyTeam(site: Site, subject: string, title: string, html: string) {
  // A list saved in Systems > Email recipients ('carla') wins over DM_AGENT_NOTIFY_EMAIL.
  const to = await recipients('carla', env('DM_AGENT_NOTIFY_EMAIL') ? [env('DM_AGENT_NOTIFY_EMAIL')] : []);
  if (!to.length || env('DM_AGENT_DRY_RUN') === 'true') return;
  await sendEmail(to, subject, site === 'collective'
    ? layout(title, html, 'thep31collective.org · The P31 Collective by NEBA', 'THE PROVERBS 31 COLLECTIVE')
    : layout(title, html));
}

async function countSince(db: ReturnType<typeof admin>, task: string | string[], hours: number) {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const q = db.from('ai_usage').select('id', { count: 'exact', head: true }).gte('created_at', since);
  const { count } = await (Array.isArray(task) ? q.in('task', task) : q.eq('task', task));
  return count || 0;
}

const MENTORSHIP_LINE = 'Private mentorship and coaching: Business Coaching (four options, including hybrid faith and business), Private Faith Mentorship (2, 3 or 4 sessions a month) and Couples Private Mentorship (90-minute sessions for couples, bi-weekly or weekly, monthly or a 6-month commitment), plus 6-month Business Coaching commitments. Every one begins with the intro call; prices are shared privately after it. Never quote them, and never give savings amounts.';

// Live facts that change between messages: today's date and, per brand, what is coming up.
async function liveContext(db: ReturnType<typeof admin>, site: Site) {
  const tz = 'America/New_York';
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: tz });
  const dateLine = `Today is ${now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} (Atlanta time).`;
  const longDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  if (site === 'collective') {
    // The same list the Collective home shows under Upcoming (src/lib/events.js fetchUpcomingEvents, first four).
    // A date is only given once the team has announced it (date_public); a month only with month_public.
    const { data: events } = await db.from('market_events')
      .select('title,event_date,start_time,venue,address,location,date_public,month_public,rsvp_url')
      .eq('is_active', true).gte('event_date', today).order('event_date', { ascending: true }).limit(4);
    const lines = (events || []).map((e) => {
      if (!e.date_public) {
        const month = e.month_public ? new Date(`${e.event_date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '';
        return `- ${e.title}: ${month ? `${month}, exact date not announced yet` : 'date not announced yet'}`;
      }
      const where = e.venue || e.location ? `, ${[e.venue || e.location, e.address].filter(Boolean).join(', ')}` : ', venue to be announced';
      return `- ${e.title}: ${longDay(e.event_date)}${e.start_time ? `, ${e.start_time}` : ''}${where}${e.rsvp_url ? ` (RSVP: ${e.rsvp_url})` : ''}`;
    });
    return `${dateLine}
LIVE FACTS (current, use these over anything older):
Upcoming events (the same list the Collective home shows at https://www.thep31collective.org/#upcoming):
${lines.length ? lines.join('\n') : '- None scheduled yet; new dates are posted at https://www.thep31collective.org/#upcoming and on @the.p31collective.'}
Membership: $27 a month, no long-term commitment; apply at https://www.thep31collective.org/join
${MENTORSHIP_LINE}`;
  }

  const { data: events } = await db.from('market_events')
    .select('title,event_date,start_time,venue,address,location,date_public,is_active')
    .gte('event_date', today).order('event_date', { ascending: true }).limit(6);
  const lines = (events || []).filter((e) => e.is_active !== false).map((e) => {
    if (!e.date_public) return `- ${e.title}: date not announced yet`;
    const where = e.venue || e.location ? `, ${[e.venue || e.location, e.address].filter(Boolean).join(', ')}` : ', venue to be announced';
    return `- ${e.title}: ${longDay(e.event_date)}${e.start_time ? `, doors ${e.start_time}` : ''}${where}`;
  });
  const [{ data: shops }, { data: settings }] = await Promise.all([
    db.from('curator_data').select('slug, business_name, tagline, location, stripe_charges_enabled').eq('status', 'approved').eq('is_published', true).limit(60),
    db.from('app_settings').select('key, value').in('key', ['billing', 'addons']),
  ]);
  const set = Object.fromEntries((settings || []).map((r) => [r.key, r.value || {}]));
  const usd = (c: number) => `$${(Number(c) / 100).toFixed(Number(c) % 100 ? 2 : 0)}`;
  const billing = set.billing || {};
  const addons = set.addons || {};
  const shopLines = (shops || []).filter((x) => x.business_name).map((x) => `- ${x.business_name}${x.location ? ` (${x.location})` : ''}${x.tagline ? `: ${x.tagline}` : ''} — https://www.p31market.com/${x.slug || ''}`);
  return `${dateLine}
LIVE FACTS (current, use these over anything older):
Upcoming markets:
${lines.length ? lines.join('\n') : '- None scheduled yet; new dates will be posted on the calendar page.'}
Shops open on the marketplace right now (${shopLines.length}):
${shopLines.length ? shopLines.join('\n') : '- None listed yet.'}
Virtual storefront terms: free for ${billing.free_months || 3} months, then ${usd(billing.price_cents || 1499)} a month; P31 keeps 5% of each sale; shoppers pay by card, Apple Pay, Klarna or Afterpay through Stripe. Each shop includes ${addons.included_products || 10} products.${(addons.product_packs || []).length ? ` Extra product slots: ${addons.product_packs.map((p: { slots: number; cents: number }) => `${p.slots} for ${usd(p.cents)}/month`).join(', ')}.` : ''}${(addons.featured_plans || []).length ? ` Featured on P31 social media: ${addons.featured_plans.map((p: { posts: number; cents: number }) => `${p.posts} posts a month for ${usd(p.cents)}`).join(' or ')}, plus one free CEO pick each month.` : ''}
Merch: p31market.com/merch, printed to order by Printful, shipping $6.95 per order, free over $75, ships in about 2 to 7 business days plus transit.
${MENTORSHIP_LINE}`;
}

async function pausedUntil(db: ReturnType<typeof admin>, conversationId: string) {
  const since = new Date(Date.now() - PAUSE_HOURS * 3600_000).toISOString();
  const { count } = await db.from('ai_usage').select('id', { count: 'exact', head: true })
    .eq('task', `dm_pause:${conversationId}`).gte('created_at', since);
  return (count || 0) > 0;
}

type Turn = { role: 'user' | 'assistant'; content: string };
type Decision = { reply: string; handoff: boolean; handoff_reason: string; inputTokens: number | null; outputTokens: number | null };

const SCHEMA_PROPS = { reply: 'string', handoff: 'boolean', handoff_reason: 'string' } as const;

function parseDecision(raw: string, inputTokens: number | null, outputTokens: number | null): Decision | null {
  try {
    const j = JSON.parse(raw);
    return { reply: String(j.reply ?? ''), handoff: !!j.handoff, handoff_reason: String(j.handoff_reason ?? ''), inputTokens, outputTokens };
  } catch {
    console.error('dm-agent: unreadable model output', raw.slice(0, 200));
    return null;
  }
}

// Carla's brain: Gemini when GEMINI_API_KEY is set, otherwise Claude. `site` picks the persona and knowledge.
async function think(system: string, turns: Turn[], site: Site): Promise<Decision | null> {
  if (!env('GEMINI_API_KEY')) return thinkClaude(system, turns, site);
  try {
    return await thinkGemini(system, turns, site);
  } catch (err) {
    if (!env('ANTHROPIC_API_KEY')) throw err;
    console.warn('dm-agent: Gemini unavailable, using Claude —', (err as Error).message);
    return thinkClaude(system, turns, site);
  }
}

const GEMINI_FALLBACK_MODEL = 'gemini-3.8-flash';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

async function thinkGemini(system: string, turns: Turn[], site: Site): Promise<Decision | null> {
  const models = [...new Set([env('GEMINI_MODEL') || GEMINI_FALLBACK_MODEL, GEMINI_FALLBACK_MODEL])];
  let lastErr: Error | null = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await geminiOnce(model, system, turns, site);
      } catch (err) {
        lastErr = err as Error;
        if (!(err as { retryable?: boolean }).retryable) break;
        await sleep(1500 * (attempt + 1));
      }
    }
  }
  throw lastErr ?? new Error('Gemini failed');
}

async function geminiOnce(model: string, system: string, turns: Turn[], site: Site): Promise<Decision | null> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env('GEMINI_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: personaFor(site) }, { text: KNOWLEDGE_FOR[site] }, { text: system }] },
      contents: turns.map((t) => ({ role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] })),
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: Object.fromEntries(Object.entries(SCHEMA_PROPS).map(([k, t]) => [k, { type: t.toUpperCase() }])),
          required: Object.keys(SCHEMA_PROPS),
        },
        maxOutputTokens: 2048,
      },
    }),
  });
  const j = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(`Gemini ${model} ${res.status}: ${JSON.stringify(j.error || j).slice(0, 300)}`), { retryable: RETRYABLE.has(res.status) });
  }
  const cand = j.candidates?.[0];
  if (!cand || j.promptFeedback?.blockReason) {
    console.warn('dm-agent: Gemini blocked', j.promptFeedback?.blockReason || cand?.finishReason);
    return null;
  }
  const raw = (cand.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
  return parseDecision(raw, j.usageMetadata?.promptTokenCount ?? null, j.usageMetadata?.candidatesTokenCount ?? null);
}

async function thinkClaude(system: string, turns: Turn[], site: Site): Promise<Decision | null> {
  const client = new Anthropic();
  const params = {
    model: MODEL,
    max_tokens: 6000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: 'low',
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: Object.fromEntries(Object.entries(SCHEMA_PROPS).map(([k, t]) => [k, { type: t }])),
          required: Object.keys(SCHEMA_PROPS),
          additionalProperties: false,
        },
      },
    },
    system: [
      { type: 'text', text: personaFor(site) },
      { type: 'text', text: KNOWLEDGE_FOR[site], cache_control: { type: 'ephemeral' } },
      { type: 'text', text: system },
    ],
    messages: turns,
  } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming;

  const response = await client.beta.messages.create(params);
  if (response.stop_reason === 'refusal') {
    console.warn('dm-agent: Claude declined');
    return null;
  }
  const raw = response.content.filter((b: { type: string }) => b.type === 'text').map((b: unknown) => (b as Anthropic.Beta.BetaTextBlock).text).join('');
  return parseDecision(raw, response.usage?.input_tokens ?? null, response.usage?.output_tokens ?? null);
}

type Outcome = { skipped?: string; reply?: string; dm?: string; lead?: string; handoff?: boolean; handoff_reason?: string };

async function handleIncoming(evt: any, ctx: Ctx, { preview = false } = {}): Promise<Outcome> {
  const msg = evt.message;
  const accountId: string = evt.account?.accountId || evt.account?.id;
  const conversationId: string = msg.conversationId;
  const { site } = ctx;
  const db = admin();

  const skip = (why: string): Outcome => { console.log(`dm-agent: ${conversationId} — ${why}`); return { skipped: why }; };
  if (!preview && await pausedUntil(db, conversationId)) return skip('the team is handling this conversation');
  if (!preview && await countSince(db, ['dm_reply', 'dm_reply_trigger'], 24) >= DAILY_REPLY_CAP) return skip('daily reply cap reached');

  if (!preview) await sleep(SETTLE_MS);
  const page = await zernioFor(accountId, `/inbox/conversations/${enc(conversationId)}/messages?accountId=${enc(accountId)}&limit=${HISTORY}&sortOrder=desc`);
  const recent: ZMessage[] = (page.messages || []).slice().reverse();
  const last = recent[recent.length - 1];
  if (!last || last.direction !== 'incoming') return skip('already answered');
  if (!preview && last.id !== msg.platformMessageId && last.id !== msg.id) return skip('a newer message will answer');
  // Instagram and Facebook sometimes deliver the same message twice: the first delivery claims it.
  if (!preview && !(await claim(db, `dm:${conversationId}:${last.id}`))) return skip('this message is already being answered');
  const sent = recent.filter((m) => m.direction === 'outgoing').map((m) => (m.message || '').trim()).filter(Boolean);

  const turns: Turn[] = [];
  for (const m of recent) {
    const role = m.direction === 'incoming' ? 'user' : 'assistant';
    const text = describe(m);
    if (!text) continue;
    if (!turns.length && role === 'assistant') continue;
    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) prev.content = `${prev.content}\n${text}`;
    else turns.push({ role, content: text });
  }
  if (!turns.length) return skip('nothing to answer');
  // First reply: nothing sent in the messages we can see and nothing answered before in this conversation.
  const { count: answeredBefore } = await db.from('dm_claims').select('key', { count: 'exact', head: true }).like('key', `dm:${conversationId}:%`);
  const firstReply = !recent.some((m) => m.direction === 'outgoing') && (answeredBefore || 0) <= (preview ? 0 : 1);

  const sender = msg.sender || {};
  const pName = platformName(msg.platform);
  const who2 = sender.name || sender.username || 'Someone';
  const senderLabel = `${who2}${sender.username ? ` (@${sender.username})` : ''}`;
  const dryRun = env('DM_AGENT_DRY_RUN') === 'true';

  // Their newest message(s): everything since our last reply, as they typed it.
  const lastOut = recent.map((m) => m.direction).lastIndexOf('outgoing');
  const newest = recent.slice(lastOut + 1).filter((m) => m.direction === 'incoming');
  const newestText = newest.map((m) => (m.message || '').trim()).filter(Boolean).join('\n');
  // Silent only when everything they wrote since is rude: one casual curse never hides a real question.
  if (newest.every((m) => isRude(m.message || ''))) return skip('rude message left unanswered');

  // The owner's canned replies (triggers.ts): the email step, the info ask, keyword templates.
  const pick: Pick | null = pickTrigger({ site, surface: 'dm', platform: msg.platform, text: newestText, firstTurn: firstReply, sentTexts: sent });
  if (pick && (pick.kind !== 'template' || !isRepeat(pick.dm, sent))) {
    const reply = pick.dm;
    if (preview) return { reply, lead: pick.email, handoff: false, handoff_reason: `canned reply: ${pick.key}` };
    // An email lead is recorded even when the send fails: Zernio says a failed send may still have been
    // delivered, and the claim above stops any retry, so the team must hear about it either way.
    let failed: unknown = null;
    if (!dryRun) {
      try {
        await zernioFor(accountId, `/inbox/conversations/${enc(conversationId)}/messages`, {
          method: 'POST',
          headers: { 'Idempotency-Key': `dm-agent-${conversationId}-${last.id}` },
          body: JSON.stringify({ accountId, message: reply }),
        });
      } catch (e) {
        if (pick.kind !== 'email') throw e;
        failed = e;
      }
    }
    if (!failed) {
      console.log(`dm-agent [${pick.key}]${dryRun ? ' [dry run]' : ''}: ${conversationId} ← ${JSON.stringify(reply)}`);
      await db.from('ai_usage').insert({ user_id: null, task: 'dm_reply_trigger', input_tokens: 0, output_tokens: 0 });
    }
    if (pick.kind === 'email' && pick.email) {
      // What they first asked: their message just before our email ask. When the ask opened the thread
      // (we can see its start), it was our private reply to one of their comments; else this message.
      const askAt = recent.map((m) => m.direction === 'outgoing' && /please provide your email address/i.test(m.message || '')).lastIndexOf(true);
      const before = askAt >= 0 ? recent.slice(0, askAt).reverse().find((m) => m.direction === 'incoming') : undefined;
      const fromComment = askAt >= 0 && !before && recent.length < HISTORY;
      const question = before ? describe(before)
        : `${fromComment ? '(Our email request opened this DM, most likely as a reply to their comment on one of our posts.) ' : ''}${describe(last) || newestText}`;
      const transcript = turns.slice(-8).map((t) => `${t.role === 'user' ? who2 : 'Carla'}: ${t.content}`).join('\n');
      await recordLead(db, ctx, {
        email: pick.email, platform: msg.platform, accountId, conversationId, sender: senderLabel, who: who2, question, transcript, delivered: !failed,
      });
    }
    if (failed) throw failed;
    return { reply, handoff: false };
  }

  const who = `This conversation is on ${pName} with ${senderLabel}. You are answering for ${site === 'collective' ? 'The P31 Collective' : 'P31 Marketplace'}${ctx.handle ? ` from our account @${ctx.handle}` : ''}.${
    firstReply ? `\nThis is the first reply in the conversation: greet them, and introduce yourself as Carla, ${site === 'collective' ? 'the virtual assistant for The P31 Collective' : 'P31 Marketplace\'s virtual assistant'}, in one short natural line, and mention the team reads every message.` : ''}`;

  const said = sent.length
    ? `\nALREADY SENT TO THIS PERSON (never repeat these words, greetings or links; if they ask the same thing again, answer in new words or ask what is unclear):\n${sent.slice(-8).map((m) => `- ${m.replace(/\s+/g, ' ').slice(0, 300)}`).join('\n')}`
    : '';
  const system = `${await liveContext(db, site)}

${who}${said}`;
  let out = await think(system, turns, site);
  if (!out) return skip('no usable reply from the model');
  // A reply that says what was already said gets one more try, then the team.
  if (out.reply && isRepeat(out.reply, sent)) {
    const again = await think(`${system}\n\nYour draft repeated an earlier message: "${out.reply.slice(0, 300)}". Write a different, shorter reply that adds something new or asks what they still need. If you have nothing new from the knowledge, set handoff to true.`, turns, site);
    if (again && (!again.reply || !isRepeat(again.reply, sent))) out = again;
    else out = { ...out, reply: '', handoff: true, handoff_reason: out.handoff_reason || 'Carla had nothing new to add and would have repeated herself' };
  }
  const reply = (out.reply || '').trim().slice(0, 1000);

  if (preview) return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };

  if (reply && !dryRun) {
    await zernioFor(accountId, `/inbox/conversations/${enc(conversationId)}/messages`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `dm-agent-${conversationId}-${last.id}` },
      body: JSON.stringify({ accountId, message: reply }),
    });
  }
  console.log(`dm-agent${dryRun ? ' [dry run]' : ''}: ${conversationId} ← ${JSON.stringify(reply)}${out.handoff ? ` (handoff: ${out.handoff_reason})` : ''}`);

  await db.from('ai_usage').insert({
    user_id: null,
    task: 'dm_reply',
    input_tokens: out.inputTokens,
    output_tokens: out.outputTokens,
  });

  if (out.handoff) {
    await db.from('ai_usage').insert({ user_id: null, task: `dm_pause:${conversationId}` });
    const transcript = turns.slice(-8).map((t) => `${t.role === 'user' ? who2 : 'Carla'}: ${t.content}`).join('\n');
    await handoff(db, site, {
      platform: msg.platform, account_id: accountId, conversation_id: conversationId, kind: 'dm',
      sender: senderLabel, question: describe(last), reason: out.handoff_reason || 'asked for the team',
      transcript, carla_reply: reply || null,
    }, `DM needs you: ${who2} on ${pName} (${ourAccount(ctx)})`, 'A conversation needs you',
      `<p><strong>${esc(who2)}</strong> wrote to ${esc(ourAccount(ctx))} on ${pName}: “${esc(describe(last))}”</p>
<p>Why Carla passed it on: ${esc(out.handoff_reason || 'asked for the team')}</p>
${reply ? `<p>Carla replied: “${esc(reply)}”</p>` : '<p>Carla did not reply.</p>'}
<p style="white-space:pre-wrap;font-size:13px;color:#4E3A4B;border-left:3px solid #E3D0EA;padding-left:10px">${esc(transcript)}</p>
<p>Carla is paused on this conversation for ${PAUSE_HOURS} hours. Reply from the ${pName} app or Zernio.</p>`);
  }
  return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };
}

/**
 * Someone asked the Marketplace for more information and gave their email: the reply promised details
 * within 24–48 hours, so the team gets a lead (Studio > Messages and an email) and the CRM a contact.
 * Carla is not paused: she keeps answering the conversation. `delivered` is false when Zernio reported an
 * error sending the thank-you (it may or may not have reached them).
 */
async function recordLead(db: ReturnType<typeof admin>, ctx: Ctx, l: {
  email: string; platform: string; accountId: string; conversationId: string; sender: string; who: string; question: string; transcript: string; delivered: boolean;
}) {
  const pName = platformName(l.platform);
  // A dry run sends nothing, so it adds nobody to the CRM either.
  if (env('DM_AGENT_DRY_RUN') === 'true') console.log(`dm-agent [dry run]: CRM lead for ${l.conversationId} not added`);
  else {
    try {
      const { error } = await db.rpc('crm_add', {
        p_email: l.email, p_name: l.who === 'Someone' ? null : l.who, p_phone: null, p_user: null,
        p_kind: 'dm_info_request', p_title: `Asked for more information on ${pName}`,
        p_detail: { platform: l.platform, account: ctx.handle || null, conversation_id: l.conversationId, question: l.question.slice(0, 500) },
        p_source: `${l.platform} dm`, p_stage: 'lead', p_ref: `dm:${l.conversationId}`,
      });
      if (error) console.warn('dm-agent: CRM not updated —', error.message);
    } catch (e) {
      console.warn('dm-agent: CRM not updated —', (e as Error).message);
    }
  }
  await handoff(db, ctx.site, {
    platform: l.platform, account_id: l.accountId, conversation_id: l.conversationId, kind: 'lead', email: l.email,
    sender: l.sender, question: l.question,
    reason: `Asked for more information. Send the details within 24-48 hours.${l.delivered ? '' : ' Carla\'s thank-you may not have reached them.'}`,
    transcript: l.transcript, carla_reply: EMAIL_THANKS,
  }, `New info request: ${l.email} from ${l.who} on ${pName} (${BRAND[ctx.site]})`, 'Someone asked for more information',
    `<p><strong>${esc(l.sender)}</strong> asked ${esc(ourAccount(ctx))} on ${pName} for more information and left their email: <strong>${esc(l.email)}</strong></p>
<p>What they asked: “${esc(l.question)}”</p>
${l.delivered
    ? '<p>Carla told them the team will send the details within 24–48 hours. Please send them by then.</p>'
    : `<p>Zernio reported an error sending Carla's thank-you, so it may not have reached them. Please email them the details within 24–48 hours.</p>`}
<p style="white-space:pre-wrap;font-size:13px;color:#4E3A4B;border-left:3px solid #E3D0EA;padding-left:10px">${esc(l.transcript)}</p>
<p>Carla keeps answering this conversation. Reply from the ${pName} app or Zernio.</p>`);
}

// ── Comments on our posts ───────────────────────────────────────────────────
const COMMENT_DAILY_CAP = 300;
const COMMENT_PER_PERSON = 3;

type ZComment = { id: string; message?: string; from?: { id?: string; name?: string; username?: string; isOwner?: boolean } };

/** One private DM to the person who commented (Instagram and Facebook; one per comment, within 7 days). */
async function privateReply(accountId: string, c: { id: string; platformPostId: string }, message: string) {
  try {
    await zernioFor(accountId, `/inbox/comments/${enc(c.platformPostId)}/${enc(c.id)}/private-reply`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `comment-dm-${c.id}` },
      body: JSON.stringify({ accountId, message }),
    });
    return true;
  } catch (e) {
    // A 502 means Meta failed after receiving it: Zernio says it is usually delivered, and it must not be retried.
    if (e instanceof ZernioError && e.status === 502) return true;
    const used = e instanceof ZernioError && !!(e.body as { details?: { privateReplyConsumed?: boolean } })?.details?.privateReplyConsumed;
    console.warn(`comment-agent: private reply to ${c.id} not sent${used ? ' (its one private reply is already used)' : ''} —`, (e as Error).message);
    return false;
  }
}

async function handleComment(evt: any, ctx: Ctx, { preview = false } = {}): Promise<Outcome> {
  const c = evt.comment;
  const accountId: string = evt.account?.accountId || evt.account?.id;
  const author = c.author || {};
  const { site } = ctx;
  const db = admin();
  const skip = (why: string): Outcome => { console.log(`comment-agent: ${c.platform} ${c.id} — ${why}`); return { skipped: why }; };

  const text = (c.text || '').trim();
  if (author.isOwnAccount) return skip('our own comment');
  if (!text) return skip('empty comment');
  if (c.isLive) return skip('comment on a live broadcast');
  if (isRude(text)) return skip('rude comment left unanswered');

  if (!preview && !(await claim(db, `comment:${c.id}`))) return skip('this comment is already being answered');
  if (!preview) {
    if (await countSince(db, ['comment_reply', 'comment_reply_trigger'], 24) >= COMMENT_DAILY_CAP) return skip('daily comment cap reached');
    if (await countSince(db, `comment_seen:${c.platformPostId}:${author.id}`, 24) >= COMMENT_PER_PERSON) return skip('already answered this person on this post today');
  }
  const pName = platformName(c.platform);
  const dryRun = env('DM_AGENT_DRY_RUN') === 'true';

  // Canned replies answer top-level comments only; a reply inside a thread goes through the thread check below.
  const pick = c.isReply ? null : pickTrigger({ site, surface: 'comment', platform: c.platform, text });
  if (pick) {
    if (preview) {
      return { reply: publicReply(pick, c.platform, pick.sendDm), dm: pick.sendDm ? pick.dm : undefined, handoff: false, handoff_reason: `canned reply: ${pick.key}` };
    }
    // Instagram and Facebook: the DM first, so the public reply only says "check your DMs" when one went out.
    const dmSent = pick.sendDm && (dryRun || await privateReply(accountId, c, pick.dm));
    const reply = publicReply(pick, c.platform, dmSent);
    if (!dryRun) {
      await zernioFor(accountId, `/inbox/comments/${enc(c.platformPostId)}`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `comment-agent-${c.id}` },
        body: JSON.stringify({ accountId, message: reply, commentId: c.id }),
      });
    }
    console.log(`comment-agent [${pick.key}]${dryRun ? ' [dry run]' : ''}: ${c.platform} ${c.id} ← ${JSON.stringify(reply)}${dmSent ? ` + DM ${JSON.stringify(pick.dm)}` : ''}`);
    await db.from('ai_usage').insert([
      { user_id: null, task: 'comment_reply_trigger', input_tokens: 0, output_tokens: 0 },
      { user_id: null, task: `comment_seen:${c.platformPostId}:${author.id}` },
    ]);
    return { reply, dm: dmSent ? pick.dm : undefined, handoff: false };
  }

  let replyTo = c.id;
  const turns: Turn[] = [];
  if (c.isReply && c.parentCommentId) {
    replyTo = c.parentCommentId;
    // Instagram and Facebook return the parent as `comment`; TikTok may not, and then it reads as followers talking.
    let page: { comment?: ZComment; comments?: ZComment[] } = {};
    try {
      page = await zernioFor(accountId, `/inbox/comments/${enc(c.platformPostId)}?accountId=${enc(accountId)}&commentId=${enc(c.parentCommentId)}&limit=20`) || {};
    } catch (e) {
      return skip(`could not read the thread, so treated as a conversation between followers (${(e as Error).message})`);
    }
    const parent: ZComment | undefined = page.comment;
    const replies: ZComment[] = Array.isArray(page.comments) ? page.comments : [];
    const ours = !!parent?.from?.isOwner;
    const theirs = !!parent && parent.from?.id === author.id && replies.some((r) => r?.from?.isOwner);
    if (!ours && !theirs) return skip('a conversation between followers');
    for (const m of [parent, ...replies]) {
      if (!m || m.id === c.id || !(m.message || '').trim()) continue;
      const role = m.from?.isOwner ? 'assistant' : 'user';
      if (!turns.length && role === 'assistant') continue;
      const prev = turns[turns.length - 1];
      const line = role === 'user' && m.from?.id !== author.id ? `(${m.from?.username || m.from?.name || 'someone else'}): ${m.message}` : m.message!;
      if (prev && prev.role === role) prev.content = `${prev.content}\n${line}`;
      else turns.push({ role, content: line });
    }
  }
  const prev = turns[turns.length - 1];
  if (prev && prev.role === 'user') prev.content = `${prev.content}\n${text}`;
  else turns.push({ role: 'user', content: text });

  const caption = (evt.post?.content || '').trim().slice(0, 800);
  const system = `${await liveContext(db, site)}

MODE: PUBLIC COMMENT. You are replying in the comments of one of our ${pName} posts, to ${author.name || author.username || 'someone'}${author.username ? ` (@${author.username})` : ''}. Everyone can read this reply. Follow the "Public comments" rules.
You are answering for ${site === 'collective' ? 'The P31 Collective' : 'P31 Marketplace'}${ctx.handle ? ` from our account @${ctx.handle}` : ''}.
${caption ? `The post's caption: """${caption}"""` : 'The post caption is not available.'}${c.ad ? '\nThis post is a paid ad.' : ''}`;

  const out = await think(system, turns, site);
  if (!out) return skip('no usable reply from the model');
  const reply = (out.reply || '').trim().slice(0, 600);
  if (preview) return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };

  if (reply && !dryRun) {
    await zernioFor(accountId, `/inbox/comments/${enc(c.platformPostId)}`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `comment-agent-${c.id}` },
      body: JSON.stringify({ accountId, message: reply, commentId: replyTo }),
    });
  }
  console.log(`comment-agent${dryRun ? ' [dry run]' : ''}: ${c.platform} ${c.id} ← ${JSON.stringify(reply)}${out.handoff ? ` (handoff: ${out.handoff_reason})` : ''}`);

  await db.from('ai_usage').insert([
    { user_id: null, task: 'comment_reply', input_tokens: out.inputTokens, output_tokens: out.outputTokens },
    { user_id: null, task: `comment_seen:${c.platformPostId}:${author.id}` },
  ]);
  if (out.handoff) {
    const who = author.username || author.name || null;
    await saveHandoff(db, { platform: c.platform, account_id: accountId, conversation_id: c.platformPostId, kind: 'comment', site, sender: who, question: text, reason: out.handoff_reason || 'needs the team', carla_reply: reply || null });
    await notifyTeam(site, `Comment needs you: ${who || 'a follower'} on ${pName} (${ourAccount(ctx)})`, 'A comment needs you',
      `<p><strong>${esc(who || 'Someone')}</strong> commented on a ${pName} post of ${esc(ourAccount(ctx))}: “${esc(text)}”</p>
<p>Why: ${esc(out.handoff_reason || 'needs the team')}</p>
${reply ? `<p>Carla replied publicly: “${esc(reply)}”</p>` : '<p>Carla did not reply.</p>'}
${evt.post?.permalink ? `<p><a href="${esc(evt.post.permalink)}">Open the post</a></p>` : ''}
<p>Reply from the ${pName} app or Zernio.</p>`);
  }
  return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };
}

// ── Google reviews (Google Business is the Marketplace's) ───────────────────
async function handleReview(evt: any, { preview = false } = {}): Promise<Outcome> {
  const r = evt.review;
  const accountId: string = evt.account?.accountId || evt.account?.id;
  const name = r.reviewer?.name || 'A reviewer';
  const skip = (why: string): Outcome => { console.log(`review-agent: ${r.id} — ${why}`); return { skipped: why }; };
  if (r.hasReply) return skip('already answered');

  if (r.rating <= 3) {
    if (!preview) {
      await notifyTeam('market', `${r.rating}-star Google review from ${name} (Marketplace)`, 'A review needs a personal reply',
        `<p><strong>${esc(name)}</strong> left ${r.rating} star${r.rating === 1 ? '' : 's'}${r.text ? `: “${esc(r.text)}”` : ' (no text)'}</p>
<p>Carla does not answer reviews under 4 stars. Reply from the Content Studio, Zernio or Google Business Profile.</p>`);
    }
    return skip(`${r.rating}-star review left for the team`);
  }

  const db = admin();
  const system = `${await liveContext(db, 'market')}

MODE: GOOGLE REVIEW. ${name} left us a ${r.rating}-star review on Google${r.text ? '' : ' with no written text'}. Write our public reply, following the "Google reviews" rules.`;
  const out = await think(system, [{ role: 'user', content: r.text?.trim() || `[${r.rating} stars, no text]` }], 'market');
  if (!out) return skip('no usable reply from the model');
  const reply = (out.reply || '').trim().slice(0, 1000);
  if (preview) return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };

  const dryRun = env('DM_AGENT_DRY_RUN') === 'true';
  if (reply && !out.handoff && !dryRun) {
    await zernioFor(accountId, `/inbox/reviews/${enc(r.id)}/reply`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `review-agent-${evt.id}` },
      body: JSON.stringify({ accountId, message: reply }),
    });
  }
  console.log(`review-agent${dryRun ? ' [dry run]' : ''}: ${r.id} ← ${JSON.stringify(reply)}${out.handoff ? ` (held for the team: ${out.handoff_reason})` : ''}`);
  await db.from('ai_usage').insert({ user_id: null, task: 'review_reply', input_tokens: out.inputTokens, output_tokens: out.outputTokens });
  if (out.handoff) {
    await notifyTeam('market', `Google review from ${name} needs you (Marketplace)`, 'A review needs a personal reply',
      `<p><strong>${esc(name)}</strong> (${r.rating} stars): “${esc(r.text || '')}”</p><p>Why: ${esc(out.handoff_reason || '')}</p><p>Suggested reply (not posted): “${esc(reply)}”</p>`);
  }
  return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };
}

// ── The admin switches (Systems > Social accounts) ──
// app_settings 'carla' = { market: { dms, comments }, collective: { dms, comments } }; anything missing is on.
// With a switch off, Carla stays quiet there and a person answers; a team reply still pauses her as usual.
let switches: { at: number; value: Record<string, Record<string, boolean>> } | null = null;
async function carlaOn(site: Site, kind: 'dms' | 'comments') {
  if (!switches || Date.now() - switches.at > 30_000) {
    const { data, error } = await admin().from('app_settings').select('value').eq('key', 'carla').maybeSingle();
    if (error) console.warn('dm-agent: could not read the auto-reply switches, leaving them on —', error.message);
    switches = { at: Date.now(), value: (data?.value as Record<string, Record<string, boolean>>) || {} };
  }
  return switches.value?.[site]?.[kind] !== false;
}

/**
 * Everything after the 200: is the account ours, which brand it speaks for, then the right handler.
 * Ours = connected in either Zernio workspace, or listed in DM_AGENT_ACCOUNT_IDS; never one in DM_AGENT_SKIP_ACCOUNT_IDS.
 */
async function route(evt: any) {
  const msg = evt.message;
  const dm = env('DM_AGENT_ENABLED') === 'true' && !!msg && PLATFORMS.has(msg.platform);
  const job = evt.event === 'comment.received'
    ? (env('COMMENT_AGENT_ENABLED') === 'true' && PLATFORMS.has(evt.comment?.platform) ? 'comment' : null)
    : evt.event === 'review.new'
      ? (env('REVIEW_AGENT_ENABLED') === 'true' && evt.review ? 'review' : null)
      : evt.event === 'message.received' && dm && msg.direction === 'incoming' ? 'dm'
        : evt.event === 'message.sent' && dm && msg.sentVia === 'human' ? 'pause' : null;
  if (!job) return;

  const accountId: string = evt.account?.accountId || evt.account?.id || '';
  const ids = (k: string) => env(k).split(',').map((s) => s.trim()).filter(Boolean);
  if (ids('DM_AGENT_SKIP_ACCOUNT_IDS').includes(accountId)) {
    console.log(`dm-agent: ${evt.event} for account ${accountId} ignored — listed in DM_AGENT_SKIP_ACCOUNT_IDS`);
    return;
  }
  const known = await zernioAccount(accountId).catch(() => null);
  if (!accountId || (!known && !ids('DM_AGENT_ACCOUNT_IDS').includes(accountId))) {
    const { failed } = await zernioAccounts().catch(() => ({ failed: [] as string[] }));
    console.log(`dm-agent: ${evt.event} for account ${accountId || '(none)'} ignored — ${failed.length
      ? `the ${failed.join(' and ')} account list could not be read (add the id to DM_AGENT_ACCOUNT_IDS to answer it anyway)`
      : 'not connected in either Zernio workspace and not in DM_AGENT_ACCOUNT_IDS'}`);
    return;
  }
  const ctx = await contextFor(evt);
  const kind = job === 'comment' ? 'comments' : job === 'dm' ? 'dms' : null;
  if (kind && !(await carlaOn(ctx.site, kind))) {
    console.log(`dm-agent: ${evt.event} on ${ourAccount(ctx)} left for the team — ${BRAND[ctx.site]} ${kind === 'dms' ? 'DM' : 'comment'} auto-replies are off`);
    return;
  }

  if (job === 'comment') await handleComment(evt, ctx);
  else if (job === 'review') await handleReview(evt);
  else if (job === 'dm') await handleIncoming(evt, ctx);
  else {
    await admin().from('ai_usage').insert({ user_id: null, task: `dm_pause:${msg.conversationId}` });
    console.log(`dm-agent: team replied in ${msg.conversationId} (${ourAccount(ctx)}) — pausing ${PAUSE_HOURS}h`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.text();

  // Each workspace's webhook signs with ZERNIO_WEBHOOK_SECRET, or the Collective's own secret when it has one.
  const secrets = [env('ZERNIO_WEBHOOK_SECRET'), env('ZERNIO_COLLECTIVE_WEBHOOK_SECRET')].filter(Boolean);
  const sig = (req.headers.get('X-Zernio-Signature') || '').toLowerCase();
  let verified = false;
  for (const s of secrets) {
    if (safeEqual(sig, await hmacHex(s, body))) {
      verified = true;
      break;
    }
  }
  if (!verified) return new Response('Bad signature', { status: 401 });

  let evt: any;
  try { evt = JSON.parse(body); } catch { return new Response('Bad JSON', { status: 400 }); }
  const ok = () => new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });

  // Zernio's sample events (POST /webhooks/test) carry placeholder ids: acknowledge them and do nothing.
  if (evt.test === true) {
    console.log(`dm-agent: Zernio test event ${evt.event || ''} received — ignored`);
    return ok();
  }

  // Signed preview: return the reply the agent would write, send nothing. X-DM-Site picks the brand.
  if (req.headers.get('X-DM-Preview') === '1') {
    try {
      const forced = (req.headers.get('X-DM-Site') || '').toLowerCase();
      const ctx = await contextFor(evt, forced === 'market' || forced === 'collective' ? forced : null);
      const out = evt.event === 'comment.received' ? await handleComment(evt, ctx, { preview: true })
        : evt.event === 'review.new' ? await handleReview(evt, { preview: true })
        : await handleIncoming(evt, ctx, { preview: true });
      return new Response(JSON.stringify({ site: evt.event === 'review.new' ? 'market' : ctx.site, ...out }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  EdgeRuntime.waitUntil(route(evt).catch((e) => console.error(`dm-agent ${evt.event || 'event'} error:`, e)));
  return ok();
});
