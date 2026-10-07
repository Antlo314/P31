// Supabase Edge Function: dm-agent
// Carla: answers Instagram and Facebook DMs for P31 in the persona from
// persona.ts, with Gemini (GEMINI_API_KEY, model GEMINI_MODEL) or, when no
// Gemini key is set, Claude (ANTHROPIC_API_KEY). Zernio calls this function for every inbox event; it verifies
// the signature, answers 200 right away (Zernio's limit is 5 seconds), then
// writes and sends the reply in the background.
//
// Setup:
//   supabase secrets set ZERNIO_API_KEY=sk_... ZERNIO_WEBHOOK_SECRET=<random string>
//   supabase secrets set GEMINI_API_KEY=...   (or ANTHROPIC_API_KEY=sk-ant-...)
//   supabase secrets set DM_AGENT_ENABLED=true   (anything else = off; the kill switch)
//   optional: DM_AGENT_DRY_RUN=true          write replies to the logs, send nothing
//   optional: DM_AGENT_ACCOUNT_IDS=id1,id2   only answer for these Zernio accounts
//   optional: DM_AGENT_NOTIFY_EMAIL=...      email the team on handoffs (needs RESEND_API_KEY)
//   supabase functions deploy dm-agent
// Then point a Zernio webhook (events message.received + message.sent) at
// https://<project>.supabase.co/functions/v1/dm-agent with the same secret.
//
// Story replies and story mentions arrive as DMs and are answered like any DM.
// Comments and Google reviews have their own switches (both default off), and
// need those events added to the same Zernio webhook:
//   COMMENT_AGENT_ENABLED=true   + event comment.received  → public replies under IG/FB posts
//   REVIEW_AGENT_ENABLED=true    + event review.new        → thank-you replies to 4–5★ Google reviews
// Under 4 stars, or anything Carla flags, emails DM_AGENT_NOTIFY_EMAIL instead.
// DM_AGENT_DRY_RUN and DM_AGENT_ACCOUNT_IDS apply to all three (include the
// Google Business account id there if the list is set).
//
// Preview: a correctly signed request with header `X-DM-Preview: 1` and a
// message.received-shaped body is answered synchronously with the reply the
// agent would write — nothing is sent and nothing is recorded.
//
// When a person on the team answers a conversation themselves (message.sent
// with sentVia "human"), the agent stays out of that conversation for 24 hours.
// Pauses, handoffs and replies are recorded in ai_usage (task dm_*), so no new
// tables are needed.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PERSONA } from './persona.ts';
import { sendEmail, layout } from '../_shared/email.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const MODEL = 'claude-opus-5-5';
const ZERNIO = 'https://zernio.com/api/v1';
const PLATFORMS = new Set(['instagram', 'facebook']);
const PAUSE_HOURS = 24;
const DAILY_REPLY_CAP = 400;    // a runaway-loop guard, far above normal volume
const SETTLE_MS = 6000;         // wait for people who send several messages in a row
const HISTORY = 20;             // messages of context per reply

const env = (k: string) => Deno.env.get(k) || '';
const admin = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

async function zernio(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ZERNIO}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env('ZERNIO_API_KEY')}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Zernio ${res.status} ${path}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

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
const enc = encodeURIComponent;

// Email the team when something needs a person (needs RESEND_API_KEY).
async function notifyTeam(subject: string, title: string, html: string) {
  const to = env('DM_AGENT_NOTIFY_EMAIL');
  if (!to || env('DM_AGENT_DRY_RUN') === 'true') return;
  await sendEmail(to, subject, layout(title, html));
}

async function countSince(db: ReturnType<typeof admin>, task: string, hours: number) {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const { count } = await db.from('ai_usage').select('id', { count: 'exact', head: true }).eq('task', task).gte('created_at', since);
  return count || 0;
}

// Live facts that change between messages: today's date and the market list.
async function liveContext(db: ReturnType<typeof admin>) {
  const tz = 'America/New_York';
  const now = new Date();
  const today = now.toLocaleDateString('en-CA', { timeZone: tz });
  const { data: events } = await db.from('market_events')
    .select('title,event_date,start_time,venue,address,location,date_public,is_active')
    .gte('event_date', today).order('event_date', { ascending: true }).limit(6);
  const lines = (events || []).filter((e) => e.is_active !== false).map((e) => {
    if (!e.date_public) return `- ${e.title}: date not announced yet`;
    const day = new Date(`${e.event_date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const where = e.venue || e.location ? `, ${[e.venue || e.location, e.address].filter(Boolean).join(', ')}` : ', venue to be announced';
    return `- ${e.title}: ${day}${e.start_time ? `, doors ${e.start_time}` : ''}${where}`;
  });
  return `Today is ${now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} (Atlanta time).
Upcoming markets:
${lines.length ? lines.join('\n') : '- None scheduled yet; new dates will be posted on the calendar page.'}`;
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

// Carla's brain: Gemini when GEMINI_API_KEY is set, otherwise Claude.
// `system` is the live context; the persona always comes first.
async function think(system: string, turns: Turn[]): Promise<Decision | null> {
  if (!env('GEMINI_API_KEY')) return thinkClaude(system, turns);
  try {
    return await thinkGemini(system, turns);
  } catch (err) {
    if (!env('ANTHROPIC_API_KEY')) throw err;
    console.warn('dm-agent: Gemini unavailable, using Claude —', (err as Error).message);
    return thinkClaude(system, turns);
  }
}

const GEMINI_FALLBACK_MODEL = 'gemini-3.8-flash';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

// Busy or rate-limited Gemini calls are retried once, then the fallback model is tried.
async function thinkGemini(system: string, turns: Turn[]): Promise<Decision | null> {
  const models = [...new Set([env('GEMINI_MODEL') || GEMINI_FALLBACK_MODEL, GEMINI_FALLBACK_MODEL])];
  let lastErr: Error | null = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await geminiOnce(model, system, turns);
      } catch (err) {
        lastErr = err as Error;
        if (!(err as { retryable?: boolean }).retryable) break;
        await sleep(1500 * (attempt + 1));
      }
    }
  }
  throw lastErr ?? new Error('Gemini failed');
}

async function geminiOnce(model: string, system: string, turns: Turn[]): Promise<Decision | null> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env('GEMINI_API_KEY'), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: PERSONA }, { text: system }] },
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

async function thinkClaude(system: string, turns: Turn[]): Promise<Decision | null> {
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
    // Persona first and cached; the live facts change, so they come after it.
    system: [
      { type: 'text', text: PERSONA, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: system },
    ],
    messages: turns,
  } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming;

  const response = await client.beta.messages.create(params);
  if (response.stop_reason === 'refusal') {
    console.warn('dm-agent: Claude declined');
    return null;
  }
  const raw = response.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.Beta.BetaTextBlock).text).join('');
  return parseDecision(raw, response.usage?.input_tokens ?? null, response.usage?.output_tokens ?? null);
}

type Outcome = { skipped?: string; reply?: string; handoff?: boolean; handoff_reason?: string };

async function handleIncoming(evt: any, { preview = false } = {}): Promise<Outcome> {
  const msg = evt.message;
  const accountId: string = evt.account?.accountId || evt.account?.id;
  const conversationId: string = msg.conversationId;
  const db = admin();

  const skip = (why: string): Outcome => { console.log(`dm-agent: ${conversationId} — ${why}`); return { skipped: why }; };
  if (!preview && await pausedUntil(db, conversationId)) return skip('the team is handling this conversation');

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count: today } = await db.from('ai_usage').select('id', { count: 'exact', head: true })
    .eq('task', 'dm_reply').gte('created_at', since);
  if (!preview && (today || 0) >= DAILY_REPLY_CAP) return skip('daily reply cap reached');

  // Let a burst of messages land, then answer them together. Only the newest
  // incoming message's event replies; the others step aside.
  if (!preview) await sleep(SETTLE_MS);
  const page = await zernio(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages?accountId=${encodeURIComponent(accountId)}&limit=${HISTORY}&sortOrder=desc`);
  const recent: ZMessage[] = (page.messages || []).slice().reverse();
  const last = recent[recent.length - 1];
  if (!last || last.direction !== 'incoming') return skip('already answered');
  if (!preview && last.id !== msg.platformMessageId && last.id !== msg.id) return skip('a newer message will answer');

  // Both brains want user/assistant turns that start with the person and alternate.
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
  const firstReply = !recent.some((m) => m.direction === 'outgoing');

  const sender = msg.sender || {};
  const who = `This conversation is on ${msg.platform === 'instagram' ? 'Instagram' : 'Facebook'} with ${sender.name || sender.username || 'someone'}${sender.username ? ` (@${sender.username})` : ''}.${
    firstReply ? ' This is the first reply in the conversation: greet them, and introduce yourself as Carla, P31\'s virtual assistant, in one short natural line, and mention the team reads every message.' : ''}`;

  const system = `${await liveContext(db)}

${who}`;
  const out = await think(system, turns);
  if (!out) return skip('no usable reply from the model');
  const reply = (out.reply || '').trim().slice(0, 1000);

  if (preview) return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };

  const dryRun = env('DM_AGENT_DRY_RUN') === 'true';
  if (reply && !dryRun) {
    await zernio(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `dm-agent-${evt.id}` },
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
    // The team takes it from here: pause the agent and let them know.
    await db.from('ai_usage').insert({ user_id: null, task: `dm_pause:${conversationId}` });
    await notifyTeam(`DM needs you: ${sender.name || sender.username || 'a follower'} on ${msg.platform}`, 'A conversation needs you',
      `<p><strong>${esc(sender.name || sender.username || 'Someone')}</strong> on ${msg.platform}: “${esc(describe(last))}”</p>
<p>Why: ${esc(out.handoff_reason || 'asked for the team')}</p>
<p>The assistant told them the team will follow up and is paused on this conversation for ${PAUSE_HOURS} hours. Reply from the Zernio inbox or the ${msg.platform} app.</p>`);
  }
  return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };
}

// ── Comments on our posts ───────────────────────────────────────────────────
// Carla answers new comments publicly, in the comment thread. She never joins a
// thread where followers are talking to each other, and answers one person at
// most a few times per post per day.
const COMMENT_DAILY_CAP = 300;
const COMMENT_PER_PERSON = 3;

type ZComment = { id: string; message?: string; from?: { id?: string; name?: string; username?: string; isOwner?: boolean } };

async function handleComment(evt: any, { preview = false } = {}): Promise<Outcome> {
  const c = evt.comment;
  const accountId: string = evt.account?.accountId || evt.account?.id;
  const author = c.author || {};
  const db = admin();
  const skip = (why: string): Outcome => { console.log(`comment-agent: ${c.platform} ${c.id} — ${why}`); return { skipped: why }; };

  const text = (c.text || '').trim();
  if (author.isOwnAccount) return skip('our own comment');
  if (!text) return skip('empty comment');
  if (c.isLive) return skip('comment on a live broadcast');

  if (!preview) {
    if (await countSince(db, 'comment_reply', 24) >= COMMENT_DAILY_CAP) return skip('daily comment cap reached');
    if (await countSince(db, `comment_seen:${c.platformPostId}:${author.id}`, 24) >= COMMENT_PER_PERSON) return skip('already answered this person on this post today');
  }

  // A reply inside a thread: answer only when the thread is a conversation with
  // us (we wrote the parent, or this person started it and we've answered there).
  const turns: Turn[] = [];
  let replyTo = c.id;
  if (c.isReply && c.parentCommentId) {
    replyTo = c.parentCommentId; // Instagram and Facebook thread replies under the top comment
    const page = await zernio(`/inbox/comments/${enc(c.platformPostId)}?accountId=${enc(accountId)}&commentId=${enc(c.parentCommentId)}&limit=20`);
    const parent: ZComment | undefined = page.comment;
    const replies: ZComment[] = page.comments || [];
    const ours = !!parent?.from?.isOwner;
    const theirs = parent?.from?.id === author.id && replies.some((r) => r.from?.isOwner);
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

  const where = c.platform === 'instagram' ? 'Instagram' : 'Facebook';
  const caption = (evt.post?.content || '').trim().slice(0, 800);
  const system = `${await liveContext(db)}

MODE: PUBLIC COMMENT. You are replying in the comments of one of our ${where} posts, to ${author.name || author.username || 'someone'}${author.username ? ` (@${author.username})` : ''}. Everyone can read this reply. Follow the "Public comments" rules.
${caption ? `The post's caption: """${caption}"""` : 'The post caption is not available.'}${c.ad ? '\nThis post is a paid ad.' : ''}`;

  const out = await think(system, turns);
  if (!out) return skip('no usable reply from the model');
  const reply = (out.reply || '').trim().slice(0, 600);
  if (preview) return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };

  const dryRun = env('DM_AGENT_DRY_RUN') === 'true';
  if (reply && !dryRun) {
    await zernio(`/inbox/comments/${enc(c.platformPostId)}`, {
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
    await notifyTeam(`Comment needs you: ${author.username || author.name || 'a follower'} on ${c.platform}`, 'A comment needs you',
      `<p><strong>${esc(author.username || author.name || 'Someone')}</strong> commented on ${c.platform}: “${esc(text)}”</p>
<p>Why: ${esc(out.handoff_reason || 'needs the team')}</p>
${reply ? `<p>Carla replied publicly: “${esc(reply)}”</p>` : '<p>Carla did not reply.</p>'}
${evt.post?.permalink ? `<p><a href="${esc(evt.post.permalink)}">Open the post</a></p>` : ''}`);
  }
  return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };
}

// ── Google reviews ──────────────────────────────────────────────────────────
// 4–5 stars: Carla writes a gracious thank-you. 1–3 stars: no automatic reply;
// the team is emailed so a person can answer it personally.
async function handleReview(evt: any, { preview = false } = {}): Promise<Outcome> {
  const r = evt.review;
  const accountId: string = evt.account?.accountId || evt.account?.id;
  const name = r.reviewer?.name || 'A reviewer';
  const skip = (why: string): Outcome => { console.log(`review-agent: ${r.id} — ${why}`); return { skipped: why }; };
  if (r.hasReply) return skip('already answered');

  if (r.rating <= 3) {
    if (!preview) {
      await notifyTeam(`${r.rating}-star Google review from ${name}`, 'A review needs a personal reply',
        `<p><strong>${esc(name)}</strong> left ${r.rating} star${r.rating === 1 ? '' : 's'}${r.text ? `: “${esc(r.text)}”` : ' (no text)'}</p>
<p>Carla does not answer reviews under 4 stars. Reply from the Content Studio, Zernio or Google Business Profile.</p>`);
    }
    return skip(`${r.rating}-star review left for the team`);
  }

  const db = admin();
  const system = `${await liveContext(db)}

MODE: GOOGLE REVIEW. ${name} left us a ${r.rating}-star review on Google${r.text ? '' : ' with no written text'}. Write our public reply, following the "Google reviews" rules.`;
  const out = await think(system, [{ role: 'user', content: r.text?.trim() || `[${r.rating} stars, no text]` }]);
  if (!out) return skip('no usable reply from the model');
  const reply = (out.reply || '').trim().slice(0, 1000);
  if (preview) return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };

  const dryRun = env('DM_AGENT_DRY_RUN') === 'true';
  if (reply && !out.handoff && !dryRun) {
    await zernio(`/inbox/reviews/${enc(r.id)}/reply`, {
      method: 'POST',
      headers: { 'Idempotency-Key': `review-agent-${evt.id}` },
      body: JSON.stringify({ accountId, message: reply }),
    });
  }
  console.log(`review-agent${dryRun ? ' [dry run]' : ''}: ${r.id} ← ${JSON.stringify(reply)}${out.handoff ? ` (held for the team: ${out.handoff_reason})` : ''}`);
  await db.from('ai_usage').insert({ user_id: null, task: 'review_reply', input_tokens: out.inputTokens, output_tokens: out.outputTokens });
  if (out.handoff) {
    await notifyTeam(`Google review from ${name} needs you`, 'A review needs a personal reply',
      `<p><strong>${esc(name)}</strong> (${r.rating} stars): “${esc(r.text || '')}”</p><p>Why: ${esc(out.handoff_reason || '')}</p><p>Suggested reply (not posted): “${esc(reply)}”</p>`);
  }
  return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.text();

  const secret = env('ZERNIO_WEBHOOK_SECRET');
  const sig = (req.headers.get('X-Zernio-Signature') || '').toLowerCase();
  if (!secret || !safeEqual(sig, await hmacHex(secret, body))) return new Response('Bad signature', { status: 401 });

  let evt: any;
  try { evt = JSON.parse(body); } catch { return new Response('Bad JSON', { status: 400 }); }

  // Signed preview: return the reply the agent would write, send nothing.
  if (req.headers.get('X-DM-Preview') === '1') {
    try {
      const handler = evt.event === 'comment.received' ? handleComment : evt.event === 'review.new' ? handleReview : handleIncoming;
      return new Response(JSON.stringify(await handler(evt, { preview: true })), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  const accountId = evt.account?.accountId || evt.account?.id;
  const allowed = env('DM_AGENT_ACCOUNT_IDS').split(',').map((s) => s.trim()).filter(Boolean);
  const forUs = !allowed.length || allowed.includes(accountId);
  const msg = evt.message;
  const run = (label: string, p: Promise<unknown>) => EdgeRuntime.waitUntil(p.catch((e) => console.error(`${label} error:`, e)));

  if (evt.event === 'comment.received') {
    if (env('COMMENT_AGENT_ENABLED') === 'true' && forUs && PLATFORMS.has(evt.comment?.platform)) run('comment-agent', handleComment(evt));
  } else if (evt.event === 'review.new') {
    if (env('REVIEW_AGENT_ENABLED') === 'true' && forUs && evt.review) run('review-agent', handleReview(evt));
  } else if (env('DM_AGENT_ENABLED') === 'true' && forUs && msg && PLATFORMS.has(msg.platform)) {
    if (evt.event === 'message.received' && msg.direction === 'incoming') {
      EdgeRuntime.waitUntil(handleIncoming(evt).catch((e) => console.error('dm-agent error:', e)));
    } else if (evt.event === 'message.sent' && msg.sentVia === 'human') {
      EdgeRuntime.waitUntil(Promise.resolve(admin().from('ai_usage').insert({ user_id: null, task: `dm_pause:${msg.conversationId}` }))
        .then(() => console.log(`dm-agent: team replied in ${msg.conversationId} — pausing ${PAUSE_HOURS}h`)));
    }
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
