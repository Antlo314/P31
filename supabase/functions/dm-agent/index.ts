// Supabase Edge Function: dm-agent
// Carla: answers Instagram, Facebook, and TikTok DMs and comments for P31 in the persona from
// persona.ts, with Gemini (GEMINI_API_KEY, model GEMINI_MODEL) or, when no
// Gemini key is set, Claude (ANTHROPIC_API_KEY). Supports both P31 Marketplace and
// P31 Collective Zernio accounts, automated owner trigger templates, and anti-troll filtering.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { PERSONA } from './persona.ts';
import { KNOWLEDGE } from './knowledge.ts';
import { sendEmail, layout } from '../_shared/email.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const MODEL = 'claude-opus-5-5';
const ZERNIO = 'https://zernio.com/api/v1';
const PLATFORMS = new Set(['instagram', 'facebook', 'tiktok']);
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

// Multi-key Zernio fetcher: attempts primary ZERNIO_API_KEY, then ZERNIO_COLLECTIVE_API_KEY
async function zernio(path: string, init: RequestInit = {}) {
  const keys = [env('ZERNIO_API_KEY'), env('ZERNIO_COLLECTIVE_API_KEY')].filter(Boolean);
  let lastErr: Error | null = null;
  for (const key of keys) {
    try {
      const res = await fetch(`${ZERNIO}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
      });
      const text = await res.text();
      if (!res.ok) {
        if (keys.length > 1 && (res.status === 401 || res.status === 404 || res.status === 403)) {
          lastErr = new Error(`Zernio ${res.status} ${path}: ${text.slice(0, 300)}`);
          continue;
        }
        throw new Error(`Zernio ${res.status} ${path}: ${text.slice(0, 300)}`);
      }
      return text ? JSON.parse(text) : {};
    } catch (e) {
      lastErr = e as Error;
      if (keys.length > 1) continue;
      throw e;
    }
  }
  throw lastErr || new Error('No Zernio API key configured');
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

// ── Never the same thing twice ──
// Two replies are "the same" when they share most of their words (greetings and links included).
const words = (s: string) => new Set(s.toLowerCase().replace(/https?:\/\/\S+/g, (u) => ` ${u} `).split(/[^a-z0-9:/._-]+/).filter((w) => w.length > 2));
const links = (s: string) => (s.match(/https?:\/\/[^\s)]+/g) || []).map((u) => u.replace(/[.,!?]+$/, '').replace(/\/$/, '').toLowerCase());
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
/** A canned reply is only sent if its link has not already gone to this person. */
const alreadySentLink = (template: string, sent: string[]) => links(template).some((l) => sent.some((m) => links(m).includes(l)));

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

/** Record a handoff for the Content Studio inbox and email the team. */
async function handoff(db: ReturnType<typeof admin>, row: Record<string, unknown>, subject: string, title: string, html: string) {
  const { error } = await db.from('dm_handoffs').insert(row);
  if (error) console.warn('dm-agent: handoff not recorded —', error.message);
  await notifyTeam(subject, title, `${html}<p><a href="https://www.thep31collective.org/studio/inbox">Open Messages in the Content Studio</a></p>`);
}
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
  const [{ data: shops }, { data: settings }] = await Promise.all([
    db.from('curator_data').select('slug, business_name, tagline, location, stripe_charges_enabled').eq('status', 'approved').eq('is_published', true).limit(60),
    db.from('app_settings').select('key, value').in('key', ['billing', 'addons']),
  ]);
  const set = Object.fromEntries((settings || []).map((r) => [r.key, r.value || {}]));
  const usd = (c: number) => `$${(Number(c) / 100).toFixed(Number(c) % 100 ? 2 : 0)}`;
  const billing = set.billing || {};
  const addons = set.addons || {};
  const shopLines = (shops || []).filter((x) => x.business_name).map((x) => `- ${x.business_name}${x.location ? ` (${x.location})` : ''}${x.tagline ? `: ${x.tagline}` : ''} — https://www.p31market.com/${x.slug || ''}`);
  return `Today is ${now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} (Atlanta time).
LIVE FACTS (current, use these over anything older):
Upcoming markets:
${lines.length ? lines.join('\n') : '- None scheduled yet; new dates will be posted on the calendar page.'}
Shops open on the marketplace right now (${shopLines.length}):
${shopLines.length ? shopLines.join('\n') : '- None listed yet.'}
Virtual storefront terms: free for ${billing.free_months || 3} months, then ${usd(billing.price_cents || 1499)} a month; P31 keeps 5% of each sale; shoppers pay by card, Apple Pay, Klarna or Afterpay through Stripe. Each shop includes ${addons.included_products || 10} products.${(addons.product_packs || []).length ? ` Extra product slots: ${addons.product_packs.map((p: { slots: number; cents: number }) => `${p.slots} for ${usd(p.cents)}/month`).join(', ')}.` : ''}${(addons.featured_plans || []).length ? ` Featured on P31 social media: ${addons.featured_plans.map((p: { posts: number; cents: number }) => `${p.posts} posts a month for ${usd(p.cents)}`).join(' or ')}, plus one free CEO pick each month.` : ''}
Merch: p31market.com/merch, printed to order by Printful, shipping $6.95 per order, free over $75, ships in about 2 to 7 business days plus transit.
Private mentorship and coaching: Business Coaching (four options, including hybrid faith and business) and Private Faith Mentorship (2, 3 or 4 sessions a month), plus 6-month Business Coaching commitments. Prices are shared privately after the intro call; never quote them.`;
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

// Fast-path baseline trigger check and anti-troll filter
function matchTrigger(text: string, isCollective: boolean) {
  const t = text.toUpperCase();

  // Strict anti-troll filter: ignore offensive, profane or trolling comments completely
  if (/\b(scam|scammer|scammers|fake|fraud|bitch|hoe|slut|clown|stupid|idiot|ugly|trash|dumbass|bullshit|stfu|f+u+c+k|sh+i+t|asshole)\b/i.test(text)) {
    return { isTroll: true };
  }

  if (isCollective) {
    if (/\b(COMMUNITY|JOIN|SISTERHOOD)\b/.test(t)) {
      return {
        comment: 'We would love to welcome you! Check your DMs for details on joining our community!',
        dm: 'Thank you for your interest in P31 Collective! We’re building a community rooted in faith, fellowship, purpose, and business. Click below to learn more and become a member!\n\nhttps://www.thep31collective.org/join',
      };
    }
    if (/\b(EVENT|RSVP|PRAYER WALK|GATHERING)\b/.test(t)) {
      return {
        comment: 'Check your DMs for details on our upcoming event details!',
        dm: 'We’re excited that you’re interested in joining us! P31 Collective offers opportunities to connect, grow in faith, and build meaningful relationships. Explore our upcoming gatherings and reserve your spot!\n\nhttps://linktr.ee/p31marketplaceandcollective',
      };
    }
    if (/\b(MENTORSHIP|MENTOR|BUSINESS COACHING|COACHING)\b/.test(t)) {
      return {
        comment: 'Your next level begins with intentional guidance! Check your DMs for the next step.',
        dm: 'Thank you for your interest in private mentorship or business coaching with Melanie JC through P31 Collective by NEBA! Whether you’re seeking spiritual guidance, clarity in your purpose, or strategic business development, your first step is scheduling an introductory call.\n\nhttps://calendly.com/nebamentorship/intro-call',
      };
    }
  } else {
    // Marketplace (TikTok, @proverbs31market, Facebook)
    if (/\b(VENDOR|CURATOR|SELL|EXHIBIT)\b/.test(t)) {
      return {
        comment: 'Your gifts deserve room to grow! Check your DMs for more information!',
        dm: 'Thank you for your interest in P31 Marketplace! We’re creating opportunities for entrepreneurs, creatives, and business owners to showcase their gifts, connect, and grow. Visit our website to explore upcoming vendor and curator opportunities!\n\nhttps://www.p31market.com/',
      };
    }
    if (/\b(EVENT|MARKETPLACE|TICKETS|ATTEND)\b/.test(t)) {
      return {
        comment: 'We’d love to see you there! Check your DMs for event details and registration!',
        dm: 'You’re invited to experience P31 Marketplace! Join us for an atmosphere of entrepreneurship, faith, fellowship, and meaningful connections. Explore our upcoming events and secure your spot!\n\nhttps://linktr.ee/p31marketplaceandcollective',
      };
    }
    if (/\b(STOREFRONT|VIRTUAL|ONLINE STORE|SHOP OWNER)\b/.test(t)) {
      return {
        comment: 'Your business deserves a place in the marketplace! Check your DMs to learn how to open your virtual storefront!',
        dm: 'Thank you for your interest in becoming a P31 Marketplace virtual storefront owner! We’re creating a space where entrepreneurs and business owners can showcase their products, expand their visibility, and connect with a growing community of shoppers. Ready to bring your business into the marketplace? Visit our website to learn more and register your storefront!\n\nhttps://www.p31market.com/storefront',
      };
    }
  }
  return null;
}

// Carla's brain: Gemini when GEMINI_API_KEY is set, otherwise Claude.
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
      systemInstruction: { parts: [{ text: PERSONA }, { text: KNOWLEDGE }, { text: system }] },
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
    system: [
      { type: 'text', text: PERSONA },
      { type: 'text', text: KNOWLEDGE, cache_control: { type: 'ephemeral' } },
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

  if (!preview) await sleep(SETTLE_MS);
  const page = await zernio(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages?accountId=${encodeURIComponent(accountId)}&limit=${HISTORY}&sortOrder=desc`);
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
  const platformName = msg.platform === 'instagram' ? 'Instagram' : msg.platform === 'tiktok' ? 'TikTok' : 'Facebook';
  const isTikTok = msg.platform === 'tiktok' || (evt.account?.platform || '').toLowerCase() === 'tiktok';
  const acctName = (evt.account?.username || evt.account?.displayName || '').toLowerCase();
  const isCollective = !isTikTok && (acctName.includes('collective') || (msg.platform === 'instagram' && acctName.includes('collective')));

  const lastText = describe(last);
  const matched = matchTrigger(lastText, isCollective);
  if (matched?.isTroll) {
    return skip('rude/troll message ignored');
  }

  // If initial trigger matched directly
  if (matched?.dm && turns.length <= 2 && !alreadySentLink(matched.dm, sent) && !isRepeat(matched.dm, sent)) {
    const reply = matched.dm;
    if (preview) return { reply, handoff: false, handoff_reason: 'Automated trigger matched' };
    const dryRun = env('DM_AGENT_DRY_RUN') === 'true';
    if (!dryRun) {
      await zernio(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `dm-agent-${conversationId}-${last.id}` },
        body: JSON.stringify({ accountId, message: reply }),
      });
    }
    console.log(`dm-agent [trigger match]${dryRun ? ' [dry run]' : ''}: ${conversationId} ← ${JSON.stringify(reply)}`);
    await db.from('ai_usage').insert({
      user_id: null,
      task: 'dm_reply_trigger',
      input_tokens: 0,
      output_tokens: 0,
    });
    return { reply, handoff: false };
  }

  const brandContext = isTikTok
    ? 'ACCOUNT CONTEXT: TikTok (represents P31 MARKETPLACE). Focus on vendors, storefronts, and upcoming pop-up markets.'
    : isCollective
      ? 'ACCOUNT CONTEXT: Instagram @the.p31collective (represents THE P31 COLLECTIVE). Focus on community membership ($27/mo), gatherings, and mentorship with Melanie JC.'
      : `ACCOUNT CONTEXT: ${platformName} (represents P31 MARKETPLACE). Focus on market shopping, vendors, and events.`;

  const who = `This conversation is on ${platformName} with ${sender.name || sender.username || 'someone'}${sender.username ? ` (@${sender.username})` : ''}.
${brandContext}${
    firstReply ? '\nThis is the first reply in the conversation: greet them, and introduce yourself as Carla, P31\'s virtual assistant, in one short natural line, and mention the team reads every message.' : ''}`;

  const said = sent.length
    ? `\nALREADY SENT TO THIS PERSON (never repeat these words, greetings or links; if they ask the same thing again, answer in new words or ask what is unclear):\n${sent.slice(-8).map((m) => `- ${m.replace(/\s+/g, ' ').slice(0, 300)}`).join('\n')}`
    : '';
  const system = `${await liveContext(db)}

${who}${said}`;
  let out = await think(system, turns);
  if (!out) return skip('no usable reply from the model');
  // A reply that says what was already said gets one more try, then the team.
  if (out.reply && isRepeat(out.reply, sent)) {
    const again = await think(`${system}\n\nYour draft repeated an earlier message: "${out.reply.slice(0, 300)}". Write a different, shorter reply that adds something new or asks what they still need. If you have nothing new from the knowledge, set handoff to true.`, turns);
    if (again && (!again.reply || !isRepeat(again.reply, sent))) out = again;
    else out = { ...out, reply: '', handoff: true, handoff_reason: out.handoff_reason || 'Carla had nothing new to add and would have repeated herself' };
  }
  const reply = (out.reply || '').trim().slice(0, 1000);

  if (preview) return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };

  const dryRun = env('DM_AGENT_DRY_RUN') === 'true';
  if (reply && !dryRun) {
    await zernio(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
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
    const who2 = sender.name || sender.username || 'Someone';
    const transcript = turns.slice(-8).map((t) => `${t.role === 'user' ? who2 : 'Carla'}: ${t.content}`).join('\n');
    await handoff(db, {
      platform: msg.platform, account_id: accountId, conversation_id: conversationId, kind: 'dm',
      sender: `${who2}${sender.username ? ` (@${sender.username})` : ''}`, question: describe(last), reason: out.handoff_reason || 'asked for the team',
      transcript, carla_reply: reply || null,
    }, `DM needs you: ${who2} on ${msg.platform}`, 'A conversation needs you',
      `<p><strong>${esc(who2)}</strong> on ${msg.platform} asked: “${esc(describe(last))}”</p>
<p>Why Carla passed it on: ${esc(out.handoff_reason || 'asked for the team')}</p>
${reply ? `<p>Carla replied: “${esc(reply)}”</p>` : '<p>Carla did not reply.</p>'}
<p style="white-space:pre-wrap;font-size:13px;color:#4E3A4B;border-left:3px solid #E3D0EA;padding-left:10px">${esc(transcript)}</p>
<p>Carla is paused on this conversation for ${PAUSE_HOURS} hours. Reply from the Instagram or Facebook app or Zernio.</p>`);
  }
  return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };
}

// ── Comments on our posts ───────────────────────────────────────────────────
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

  const isTikTok = c.platform === 'tiktok' || (evt.account?.platform || '').toLowerCase() === 'tiktok';
  const acctName = (evt.account?.username || evt.account?.displayName || '').toLowerCase();
  const isCollective = !isTikTok && (acctName.includes('collective') || (c.platform === 'instagram' && acctName.includes('collective')));

  const matched = matchTrigger(text, isCollective);
  if (matched?.isTroll) {
    return skip('rude/troll comment ignored');
  }

  let replyTo = c.id;
  if (!preview && !(await claim(db, `comment:${c.id}`))) return skip('this comment is already being answered');
  if (!preview) {
    if (await countSince(db, 'comment_reply', 24) >= COMMENT_DAILY_CAP) return skip('daily comment cap reached');
    if (await countSince(db, `comment_seen:${c.platformPostId}:${author.id}`, 24) >= COMMENT_PER_PERSON) return skip('already answered this person on this post today');
  }

  // If keyword trigger matches directly
  if (matched?.comment) {
    const reply = matched.comment;
    if (preview) return { reply, handoff: false, handoff_reason: 'Automated comment trigger matched' };
    const dryRun = env('DM_AGENT_DRY_RUN') === 'true';
    if (!dryRun) {
      await zernio(`/inbox/comments/${enc(c.platformPostId)}`, {
        method: 'POST',
        headers: { 'Idempotency-Key': `comment-agent-${c.id}` },
        body: JSON.stringify({ accountId, message: reply, commentId: replyTo }),
      });
    }
    console.log(`comment-agent [trigger match]${dryRun ? ' [dry run]' : ''}: ${c.platform} ${c.id} ← ${JSON.stringify(reply)}`);
    await db.from('ai_usage').insert([
      { user_id: null, task: 'comment_reply_trigger', input_tokens: 0, output_tokens: 0 },
      { user_id: null, task: `comment_seen:${c.platformPostId}:${author.id}` },
    ]);
    return { reply, handoff: false };
  }

  const turns: Turn[] = [];
  if (c.isReply && c.parentCommentId) {
    replyTo = c.parentCommentId;
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

  const platformName = c.platform === 'instagram' ? 'Instagram' : c.platform === 'tiktok' ? 'TikTok' : 'Facebook';
  const brandContext = isTikTok
    ? 'ACCOUNT CONTEXT: TikTok (represents P31 MARKETPLACE). Focus on vendors, storefronts, and upcoming pop-up markets.'
    : isCollective
      ? 'ACCOUNT CONTEXT: Instagram @the.p31collective (represents THE P31 COLLECTIVE). Focus on community membership ($27/mo), gatherings, and mentorship with Melanie JC.'
      : `ACCOUNT CONTEXT: ${platformName} (represents P31 MARKETPLACE).`;

  const where = platformName;
  const caption = (evt.post?.content || '').trim().slice(0, 800);
  const system = `${await liveContext(db)}

MODE: PUBLIC COMMENT. You are replying in the comments of one of our ${where} posts, to ${author.name || author.username || 'someone'}${author.username ? ` (@${author.username})` : ''}. Everyone can read this reply. Follow the "Public comments" rules and the anti-troll guidelines.
${brandContext}
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
    await db.from('dm_handoffs').insert({ platform: c.platform, account_id: accountId, conversation_id: c.platformPostId, kind: 'comment', sender: author.username || author.name || null, question: text, reason: out.handoff_reason || 'needs the team', carla_reply: reply || null }).then(({ error }) => error && console.warn('dm-agent: comment handoff not recorded —', error.message));
    await notifyTeam(`Comment needs you: ${author.username || author.name || 'a follower'} on ${c.platform}`, 'A comment needs you',
      `<p><strong>${esc(author.username || author.name || 'Someone')}</strong> commented on ${c.platform}: “${esc(text)}”</p>
<p>Why: ${esc(out.handoff_reason || 'needs the team')}</p>
${reply ? `<p>Carla replied publicly: “${esc(reply)}”</p>` : '<p>Carla did not reply.</p>'}
${evt.post?.permalink ? `<p><a href="${esc(evt.post.permalink)}">Open the post</a></p>` : ''}`);
  }
  return { reply, handoff: out.handoff, handoff_reason: out.handoff_reason };
}

// ── Google reviews ──────────────────────────────────────────────────────────
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

  // Validate webhook signature against either primary or collective webhook secret
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
