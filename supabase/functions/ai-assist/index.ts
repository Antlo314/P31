// Supabase Edge Function: ai-assist
// On-brand writing help for curators and the P31 team: captions, product
// descriptions (optionally from the product photo), shop bios, outreach
// messages, comment replies and email campaigns.
//
// Model: Google Gemini when GEMINI_API_KEY is set (GEMINI_MODEL, the same key Carla
// uses), otherwise Claude (ANTHROPIC_API_KEY).
//   supabase functions deploy ai-assist --no-verify-jwt
//
// Body: { task, input: { ...fields }, imageUrl?, imageBase64?, imageType? }
// Returns: { options: string[] }   (1–3 drafts)
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const MODEL = 'claude-opus-5-5';
const GEMINI_FALLBACK_MODEL = 'gemini-3.8-flash';
const DAILY_LIMIT = { operator: 300, curator: 40 };

// Stable brand voice (kept first so repeated calls share the cached prefix).
const SYSTEM = `You write for Proverbs 31 Marketplace (p31market.com), a premium, faith-led, curated marketplace and traveling market collective for women creatives, artisans and entrepreneurs, based in Atlanta, GA. Tagline: "Where her gifts make room." Scripture anchor: Proverbs 31:31.

Voice: warm, elegant, confident and encouraging; faith-rooted without preaching; celebrates women's gifts and craftsmanship. Plain, vivid language — no clichés like "elevate your style" or "game-changer", no exaggerated claims, no invented facts (prices, dates, ingredients, materials, awards). If a detail isn't given, write around it.

Output rules: return only the requested copy as plain text — no preamble, no labels, no markdown headings, no surrounding quotes. When asked for several options, separate them with a line containing only ---.`;

type Task = { prompt: (i: Record<string, string>) => string; maxTokens: number };

const TASKS: Record<string, Task> = {
  caption: {
    maxTokens: 1200,
    prompt: (i) => `Write 3 different social media captions for ${i.platforms || 'Instagram and Facebook'}.
Topic / what the post shows: ${i.topic || '(not given)'}
${i.details ? `Details: ${i.details}\n` : ''}Each caption: 1–4 short lines, an inviting hook first, a clear call to action (e.g. shop the link, RSVP, visit the market). End each with 3–6 relevant hashtags on their own line.${Number(i.maxChars) ? ` Keep each under ${Number(i.maxChars)} characters including hashtags.` : ''}`,
  },
  // Everything one post needs, as JSON the Studio reads: hook lines, captions, hashtags, a first comment.
  post_pack: {
    maxTokens: 2000,
    prompt: (i) => `Write a complete social post pack for ${i.platforms || 'Instagram and Facebook'} (${i.kind || 'reel'}).
What the post is about: ${i.topic || '(not given)'}
${i.details ? `Details: ${i.details}\n` : ''}${i.pillar ? `Content pillar: ${i.pillar}\n` : ''}${i.event ? `Upcoming market: ${i.event}\n` : ''}
What works on Reels right now: the first 1–3 seconds decide whether people stay, so hooks are short, specific promises or questions (no "welcome to", no introductions); captions lead with the hook, use plain keywords people would search, say "link in bio" instead of pasting links on Instagram, and end with 3–5 specific hashtags, never a wall of them; a first comment can carry extra context or the link for Facebook.
Return ONLY a JSON object (no code fences, no commentary) with exactly these keys:
{"hooks": [3 on-screen hook lines, 3–8 words each, written to be read in 2 seconds],
 "captions": [3 captions, each 2–5 short lines with the hook first and one clear call to action; no hashtags inside],
 "hashtags": [5 specific hashtags with the # sign],
 "first_comment": "one short comment to post under it (a link, a detail, or a question)",
 "best_time": "one line on when this kind of post tends to do best for a faith-led women's market in Atlanta"}`,
  },
  // A month of post ideas, one per planned slot, spread across the content pillars.
  month_plan: {
    maxTokens: 4000,
    prompt: (i) => `Plan ${i.count || 12} social posts for ${i.month || 'next month'} for Proverbs 31 Marketplace's Instagram and Facebook.
${i.events ? `Markets and dates this period: ${i.events}\n` : ''}${i.focus ? `Focus this month: ${i.focus}\n` : ''}Mix these pillars across the month: Market countdown and behind the scenes · Curator spotlight (a real woman-owned brand, described generally since names are not given) · Faith and encouragement (one scripture, KJV, used with care) · Community and testimonials · Mentorship and the P31 Collective · Shop the marketplace. Vary the format: reels most often, then photos, a carousel, a story.
Return ONLY a JSON array (no code fences) of ${i.count || 12} objects, each: {"day": 1-31, "kind": "reel"|"photo"|"carousel"|"story", "pillar": "...", "theme": "one line: what the post is", "hook": "on-screen hook, 3–8 words", "caption": "2–4 short lines with a call to action", "hashtags": "#five #specific #tags"}. Spread the days out; markets get a post the week before, the day before, and the day after.`,
  },
  // One product, everything a vendor needs to market it, as JSON the Marketing tab reads.
  product_promo: {
    maxTokens: 2200,
    prompt: (i) => `Write a marketing kit for one product sold by a woman-owned shop on Proverbs 31 Marketplace.
Shop: ${i.shop || '(not given)'}
Product: ${i.name || '(not given)'}${i.price ? ` · $${i.price}` : ''}${i.compare_at ? ` (was $${i.compare_at})` : ''}
${i.category ? `Category: ${i.category}\n` : ''}${i.description ? `Description: ${i.description}\n` : ''}${i.tags ? `Tags: ${i.tags}\n` : ''}${i.angle ? `Angle the vendor wants: ${i.angle}\n` : ''}${i.hasImage ? 'A photo of the product is attached — describe only what you can actually see.\n' : ''}What works on Instagram and Facebook right now: the first line is a short, specific hook (a feeling, a use, a question — never "introducing"); plain words people search; one clear call to action ("tap the link", "DM us", "find us at the market"); 3–5 specific hashtags, not a wall; stories are one line; emails lead with the benefit and have one button.
Return ONLY JSON (no code fences) with:
 "hooks": [3 on-screen hook lines, 3–8 words each],
 "captions": [3 captions for Instagram/Facebook, each 2–5 short lines with the hook first and one call to action, no hashtags inside],
 "story": "one line for an Instagram story sticker, max 60 characters",
 "hashtags": [5 specific hashtags],
 "email_subject": "max 50 characters",
 "email_body": "90–140 words, 2–3 short paragraphs, warm and first person from the maker, ends with one call to action to shop the link",
 "sms": "one text message under 140 characters with a call to action",
 "best_time": "one sentence on when to post this kind of product"`,
  },
  // A vendor's email to the people following their shop. Subject, then body, separated by ---.
  shop_email: {
    maxTokens: 1400,
    prompt: (i) => `Write an email from ${i.shop || 'a woman-owned shop'} on Proverbs 31 Marketplace to the shoppers who follow the shop.
Purpose: ${i.goal || 'share what is new'}
${i.product ? `Product to feature: ${i.product}\n` : ''}${i.details ? `Details: ${i.details}\n` : ''}${i.maker ? `Maker: ${i.maker}\n` : ''}First person from the maker, warm and personal, never salesy. Return exactly 2 parts separated by ---: first a subject line (max 50 characters), then the email body (90–160 words, 2–3 short paragraphs, one clear call to action, signed with the maker's name or the shop name).`,
  },
  product_description: {
    maxTokens: 1000,
    prompt: (i) => `Write a product description for an online boutique listing.
Product name: ${i.name || '(not given)'}
${i.category ? `Category: ${i.category}\n` : ''}${i.notes ? `Maker's notes: ${i.notes}\n` : ''}${i.hasImage ? 'A photo of the product is attached — describe only what you can actually see plus the notes above.\n' : ''}Write 2 options. Each: 2–4 sentences (40–90 words) — what it is, what makes it special, how it feels to use or give it. No bullet points.`,
  },
  shop_bio: {
    maxTokens: 1000,
    prompt: (i) => `Write a shop "About" bio for a curator's storefront.
Shop: ${i.business || '(not given)'}
${i.maker ? `Maker: ${i.maker}\n` : ''}${i.what ? `What they make: ${i.what}\n` : ''}${i.story ? `Their story / notes: ${i.story}\n` : ''}${i.location ? `Location: ${i.location}\n` : ''}Write 2 options, each 60–110 words, first person ("I" or "we"), warm and personal.`,
  },
  tagline: {
    maxTokens: 400,
    prompt: (i) => `Write 3 short shop taglines (max 8 words each) for ${i.business || 'a curator shop'}${i.what ? ` that makes ${i.what}` : ''}.`,
  },
  outreach: {
    maxTokens: 1200,
    prompt: (i) => `Write 2 short, personal outreach messages from the Proverbs 31 Marketplace team to ${i.name || 'a community group'}${i.platform ? ` on ${i.platform}` : ''}.
About them: ${i.about || '(not given)'}
Goal: ${i.goal || 'invite them to connect with P31 — as curators/vendors, shoppers at our next market, or a community partner'}.
Each: 60–110 words, friendly and specific to them, one clear ask, no hard sell, signed "— The P31 Marketplace team".`,
  },
  reply: {
    maxTokens: 600,
    prompt: (i) => `Write 2 options for a reply from Proverbs 31 Marketplace to this comment${i.platform ? ` on ${i.platform}` : ''}.
Comment by ${i.author || 'a follower'}: "${i.comment || ''}"
${i.context ? `Post context: ${i.context}\n` : ''}Each reply: 1–2 sentences, warm and genuine, answers any question if possible (otherwise invites them to DM or visit p31market.com).`,
  },
  campaign: {
    maxTokens: 2000,
    prompt: (i) => `Write a marketing email for the Proverbs 31 Marketplace list.
Purpose: ${i.goal || '(not given)'}
${i.details ? `Details: ${i.details}\n` : ''}Audience: ${i.audience || 'subscribers who love the collective'}.
Return exactly 2 parts separated by ---: first a subject line (max 60 characters), then the email body (120–220 words, short paragraphs, one clear call to action, sign off "With gratitude, The P31 Marketplace team").`,
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: userData } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: 'Sign in to use AI writing.' }, 401);

    // Who may use it, and how much per day: the team (admins, Systems operators, anyone with a
    // team dashboard or a classroom) and curators.
    const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false },
    });
    const { data: roles } = await asUser.rpc('my_roles');
    let team = !!(roles && (roles.admin || roles.operator || roles.studio || (roles.tools || []).length || (roles.mentor || []).length));
    let curator = !!roles?.curator;
    if (!roles) { // before v41: the older checks
      const [{ data: op }, { data: cur }] = await Promise.all([
        admin.from('system_operators').select('user_id').eq('user_id', user.id).maybeSingle(),
        admin.from('curator_data').select('id').eq('id', user.id).maybeSingle(),
      ]);
      team = !!op; curator = !!cur;
    }
    const role = team ? 'operator' : curator ? 'curator' : null;
    if (!role) return json({ error: 'AI writing is available to curators and the P31 team.' }, 403);
    // Only people allowed to use it learn whether it's switched on.
    const useGemini = !!Deno.env.get('GEMINI_API_KEY');
    if (!useGemini && !Deno.env.get('ANTHROPIC_API_KEY')) return json({ error: 'AI writing isn’t switched on yet (add the GEMINI_API_KEY secret).' });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin.from('ai_usage').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('created_at', since);
    if ((count || 0) >= DAILY_LIMIT[role]) return json({ error: 'You’ve reached today’s AI writing limit — try again tomorrow.' }, 429);

    const { task, input = {}, imageUrl, imageBase64, imageType } = await req.json();
    const spec = TASKS[task];
    if (!spec) return json({ error: 'Unknown writing task.' }, 400);

    // Trim free-text inputs so a pasted novel can't blow up the bill.
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(input || {})) clean[k] = String(v ?? '').slice(0, 2000);

    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (imageUrl && /^https:\/\//.test(imageUrl)) {
      content.push({ type: 'image', source: { type: 'url', url: imageUrl } });
      clean.hasImage = '1';
    } else if (imageBase64 && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(imageType)) {
      if (imageBase64.length > 7_000_000) return json({ error: 'That photo is too large for AI — try a smaller one.' }, 400);
      content.push({ type: 'image', source: { type: 'base64', media_type: imageType, data: imageBase64 } });
      clean.hasImage = '1';
    }
    content.push({ type: 'text', text: spec.prompt(clean) });

    const done = (text: string) => {
      const parts = text.split(/\n\s*---\s*\n/).map((s) => s.trim()).filter(Boolean);
      // A campaign is one draft: subject line, then the body.
      const options = task === 'campaign' || task === 'shop_email'
        ? [`${parts[0].replace(/^subject:\s*/i, '')}\n${parts.slice(1).join('\n\n')}`]
        : parts.slice(0, 3);
      return json({ options });
    };

    if (useGemini) {
      const out = await gemini(spec, clean, content);
      await admin.from('ai_usage').insert({ user_id: user.id, task, input_tokens: out.inTokens, output_tokens: out.outTokens });
      if (out.blocked) return json({ error: 'The AI couldn’t write that one — try rephrasing the details.' });
      if (!out.text) return json({ error: 'No draft came back — please try again.' });
      return done(out.text);
    }

    const client = new Anthropic();
    // Claude Opus 5.5 always thinks; low effort keeps short copy fast and cheap.
    // Server-side refusal fallback ("default") re-runs a declined request on the
    // model Anthropic recommends for that refusal category.
    const params = {
      model: MODEL,
      max_tokens: spec.maxTokens + 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming;

    const response = await client.beta.messages.create(params);

    await admin.from('ai_usage').insert({
      user_id: user.id,
      task,
      input_tokens: response.usage?.input_tokens ?? null,
      output_tokens: response.usage?.output_tokens ?? null,
    });

    if (response.stop_reason === 'refusal') {
      return json({ error: 'The AI couldn’t write that one — try rephrasing the details.' });
    }

    const text = response.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { type: string }) => (b as Anthropic.Beta.BetaTextBlock).text)
      .join('\n')
      .trim();
    if (!text) return json({ error: 'No draft came back — please try again.' });
    return done(text);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'AI is busy right now — try again in a minute.' }, 429);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: 'The AI key isn’t valid — check ANTHROPIC_API_KEY.' }, 500);
    if (err instanceof Anthropic.APIError) {
      console.error('Claude API error', err.status, err.message);
      return json({ error: 'AI writing hit a problem — please try again.' }, 502);
    }
    console.error('ai-assist error:', err);
    if (/^Gemini /.test((err as Error).message || '')) return json({ error: 'AI writing hit a problem — please try again.' }, 502);
    return json({ error: (err as Error).message || 'AI writing failed.' }, 500);
  }
});

// ── Gemini ──────────────────────────────────────────────────
const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** The same request for Gemini: the brand voice as the system instruction, the photo inline. */
async function gemini(spec: Task, clean: Record<string, string>, content: Anthropic.Beta.BetaContentBlockParam[]) {
  const parts: Record<string, unknown>[] = [];
  for (const block of content) {
    if (block.type !== 'image') continue;
    const src = block.source as { type: string; url?: string; data?: string; media_type?: string };
    if (src.type === 'base64') parts.push({ inline_data: { mime_type: src.media_type, data: src.data } });
    if (src.type === 'url' && src.url) {
      const res = await fetch(src.url);
      const type = (res.headers.get('content-type') || '').split(';')[0];
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (res.ok && /^image\/(jpeg|png|webp|gif)$/.test(type) && bytes.length < 7_000_000) parts.push({ inline_data: { mime_type: type, data: toBase64(bytes) } });
    }
  }
  parts.push({ text: spec.prompt(clean) });

  const models = [...new Set([Deno.env.get('GEMINI_MODEL') || GEMINI_FALLBACK_MODEL, GEMINI_FALLBACK_MODEL])];
  let last: Error | null = null;
  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')!, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { maxOutputTokens: spec.maxTokens + 4000, temperature: 0.9 },
      }),
    });
    const j = await res.json();
    if (!res.ok) { last = new Error(`Gemini ${model} ${res.status}: ${JSON.stringify(j.error || j).slice(0, 200)}`); console.error(last.message); continue; }
    const cand = j.candidates?.[0];
    const text = (cand?.content?.parts || []).map((p: { text?: string; thought?: boolean }) => (p.thought ? '' : p.text || '')).join('').trim();
    return {
      text,
      blocked: !!j.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY' || cand?.finishReason === 'PROHIBITED_CONTENT',
      inTokens: j.usageMetadata?.promptTokenCount ?? null,
      outTokens: j.usageMetadata?.candidatesTokenCount ?? null,
    };
  }
  throw last ?? new Error('Gemini failed');
}
