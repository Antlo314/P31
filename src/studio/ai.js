import { supabase } from '../lib/supabase';

/** Ask the on-brand writing helper (the ai-assist function). Returns its text options. */
export async function askAi(task, input = {}) {
  const { data, error } = await supabase.functions.invoke('ai-assist', { body: { task, input } });
  if (error) {
    let msg = 'The writing helper is not available right now.';
    try { const ctx = await error.context?.json?.(); if (ctx?.error) msg = ctx.error; } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data?.options || [];
}

// The helper is asked for JSON; strip any code fence it may wrap it in.
const parseJson = (text) => {
  const clean = String(text || '').replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = clean.search(/[[{]/);
  return JSON.parse(clean.slice(start));
};

/** Everything one post needs: hooks, captions, hashtags, a first comment, a best-time note. */
export async function postPack(input) {
  const [first] = await askAi('post_pack', input);
  const j = parseJson(first);
  return {
    hooks: (j.hooks || []).map(String).slice(0, 3),
    captions: (j.captions || []).map(String).slice(0, 3),
    hashtags: (j.hashtags || []).map((h) => String(h).trim()).filter(Boolean).map((h) => (h.startsWith('#') ? h : `#${h}`)).slice(0, 6),
    firstComment: String(j.first_comment || ''),
    bestTime: String(j.best_time || ''),
  };
}

/** A month of post ideas: [{ day, kind, pillar, theme, hook, caption, hashtags }]. */
export async function monthPlan(input) {
  const [first] = await askAi('month_plan', input);
  const list = parseJson(first);
  return (Array.isArray(list) ? list : []).map((p) => ({
    day: Math.max(1, Math.min(31, Number(p.day) || 1)),
    kind: ['reel', 'photo', 'carousel', 'story'].includes(p.kind) ? p.kind : 'reel',
    pillar: String(p.pillar || ''), theme: String(p.theme || ''), hook: String(p.hook || ''),
    caption: String(p.caption || ''), hashtags: String(p.hashtags || ''),
  }));
}
