// Carla, writing email: reads a conversation and drafts a reply for a person on the team to
// approve. Same persona and facts as the DM assistant (dm-agent/persona.ts), with email rules
// on top. Gemini when GEMINI_API_KEY is set (GEMINI_MODEL), otherwise Claude (ANTHROPIC_API_KEY).
import Anthropic from 'npm:@anthropic-ai/sdk';
import { PERSONA } from '../dm-agent/persona.ts';

const env = (k: string) => Deno.env.get(k) || '';
const MODEL = 'claude-opus-5-5';
const GEMINI_FALLBACK_MODEL = 'gemini-3.8-flash';

export const CATEGORIES = ['applicant', 'member', 'vendor', 'customer', 'partnership', 'press', 'general', 'spam', 'automated'] as const;

export type Draft = {
  category: string; summary: string; reply: string; needs_human: boolean; reason: string;
};

const EMAIL_RULES = `# You are answering EMAIL now
You are drafting an email reply that a person on the P31 team will read, edit if needed, and send. Nothing goes out without them.
- Write a complete email body: a greeting with their first name when you know it ("Hi Jasmine,"), the answer, one clear next step, and a sign-off.
- Email can be a little fuller than a DM: usually 2 to 5 short paragraphs, plain text, no markdown, no bullet symbols unless listing several items, no emoji.
- Sign off with "Warmly," then on the next lines "Carla" and the team name given in the context.
- The rules about facts, prices, dates and scripture still apply exactly.
- When the email needs a person (refunds, payments, orders, complaints, booth fees or contracts, press, sponsorship negotiations, legal or medical questions, anything personal or sensitive, or they ask for a person), still write a short, gracious holding reply saying the team will follow up personally, and set needs_human to true with the reason.
- Notifications, receipts, newsletters, out-of-office and other automated mail: category "automated", empty reply.
- Spam, scams, sales pitches for services we did not ask for: category "spam", empty reply.
- Never promise acceptance into the Collective or a market, never confirm payments or bookings.

# Output
Return JSON: "category" (one of: ${CATEGORIES.join(', ')}), "summary" (one short line for the team: who they are and what they want), "reply" (the email body, or empty), "needs_human" (true when a person must handle it), "reason" (why, in a few words; empty when needs_human is false).`;

const PROPS = { category: 'string', summary: 'string', reply: 'string', needs_human: 'boolean', reason: 'string' } as const;

function parse(raw: string): Draft | null {
  try {
    const j = JSON.parse(raw);
    const category = CATEGORIES.includes(j.category) ? j.category : 'general';
    return { category, summary: String(j.summary ?? '').slice(0, 300), reply: String(j.reply ?? ''), needs_human: !!j.needs_human, reason: String(j.reason ?? '').slice(0, 200) };
  } catch {
    console.error('carla-mail: unreadable model output', raw.slice(0, 200));
    return null;
  }
}

async function gemini(context: string, conversation: string): Promise<Draft | null> {
  const models = [...new Set([env('GEMINI_MODEL') || GEMINI_FALLBACK_MODEL, GEMINI_FALLBACK_MODEL])];
  let last: Error | null = null;
  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': env('GEMINI_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PERSONA }, { text: EMAIL_RULES }, { text: context }] },
        contents: [{ role: 'user', parts: [{ text: conversation }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: { type: 'OBJECT', properties: Object.fromEntries(Object.entries(PROPS).map(([k, t]) => [k, { type: t.toUpperCase() }])), required: Object.keys(PROPS) },
          maxOutputTokens: 4096,
        },
      }),
    });
    const j = await res.json();
    if (!res.ok) { last = new Error(`Gemini ${model} ${res.status}: ${JSON.stringify(j.error || j).slice(0, 200)}`); continue; }
    const raw = (j.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
    return parse(raw);
  }
  throw last ?? new Error('Gemini failed');
}

async function claude(context: string, conversation: string): Promise<Draft | null> {
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
        schema: { type: 'object', properties: Object.fromEntries(Object.entries(PROPS).map(([k, t]) => [k, { type: t }])), required: Object.keys(PROPS), additionalProperties: false },
      },
    },
    system: [
      { type: 'text', text: PERSONA, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: EMAIL_RULES, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: context },
    ],
    messages: [{ role: 'user', content: conversation }],
  } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming;
  const response = await client.beta.messages.create(params);
  if (response.stop_reason === 'refusal') return null;
  const raw = response.content.filter((b) => b.type === 'text').map((b) => (b as Anthropic.Beta.BetaTextBlock).text).join('');
  return parse(raw);
}

/** Draft a reply. `context` carries the mailbox, team name and live facts; `conversation` the emails. */
export async function draftReply(context: string, conversation: string): Promise<Draft | null> {
  if (env('GEMINI_API_KEY')) {
    try { return await gemini(context, conversation); } catch (err) {
      if (!env('ANTHROPIC_API_KEY')) throw err;
      console.warn('carla-mail: Gemini unavailable, using Claude:', (err as Error).message);
    }
  }
  if (!env('ANTHROPIC_API_KEY')) throw new Error('No GEMINI_API_KEY or ANTHROPIC_API_KEY');
  return claude(context, conversation);
}

export const brainConfigured = () => !!(env('GEMINI_API_KEY') || env('ANTHROPIC_API_KEY'));
