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

type ZMessage = { id: string; message?: string; direction: 'incoming' | 'outgoing'; createdAt: string; attachments?: { type?: string; originalType?: string }[] };

// What a message "says" when it is only a photo, reel or story mention.
function describe(m: ZMessage) {
  const text = (m.message || '').trim();
  const att = (m.attachments || []).map((a) => {
    const t = a.originalType || a.type || 'attachment';
    return t === 'story_mention' ? 'mentioned us in their story' : `sent a ${t.replace(/^ig_/, '')}`;
  });
  return [text, att.length ? `[${att.join(', ')}]` : ''].filter(Boolean).join(' ');
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
    const to = env('DM_AGENT_NOTIFY_EMAIL');
    if (to && !dryRun) {
      const lastText = describe(last).replace(/[<>&]/g, '');
      await sendEmail(to, `DM needs you: ${sender.name || sender.username || 'a follower'} on ${msg.platform}`, layout('A conversation needs you',
        `<p><strong>${(sender.name || sender.username || 'Someone').replace(/[<>&]/g, '')}</strong> on ${msg.platform}: “${lastText}”</p>
<p>Why: ${(out.handoff_reason || 'asked for the team').replace(/[<>&]/g, '')}</p>
<p>The assistant told them the team will follow up and is paused on this conversation for ${PAUSE_HOURS} hours. Reply from the Zernio inbox or the ${msg.platform} app.</p>`));
    }
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
      return new Response(JSON.stringify(await handleIncoming(evt, { preview: true })), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  const accountId = evt.account?.accountId || evt.account?.id;
  const allowed = env('DM_AGENT_ACCOUNT_IDS').split(',').map((s) => s.trim()).filter(Boolean);
  const forUs = !allowed.length || allowed.includes(accountId);
  const msg = evt.message;

  if (env('DM_AGENT_ENABLED') === 'true' && forUs && msg && PLATFORMS.has(msg.platform)) {
    if (evt.event === 'message.received' && msg.direction === 'incoming') {
      EdgeRuntime.waitUntil(handleIncoming(evt).catch((e) => console.error('dm-agent error:', e)));
    } else if (evt.event === 'message.sent' && msg.sentVia === 'human') {
      EdgeRuntime.waitUntil(Promise.resolve(admin().from('ai_usage').insert({ user_id: null, task: `dm_pause:${msg.conversationId}` }))
        .then(() => console.log(`dm-agent: team replied in ${msg.conversationId} — pausing ${PAUSE_HOURS}h`)));
    }
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
