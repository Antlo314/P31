// Shared by email-inbound and email-send: the two inboxes, and Carla's draft for a conversation.
import { draftReply, brainConfigured } from './carla-mail.ts';

const env = (k: string) => Deno.env.get(k) || '';

export type Mailbox = 'collective' | 'market';

// Who each inbox is, and the address replies are sent from (the From address's own inbox
// receives the answers, which are forwarded back here).
export const MAILBOX: Record<Mailbox, { team: string; from: () => string; label: string }> = {
  collective: {
    team: 'The P31 Collective',
    label: 'members@thep31collective.org',
    from: () => env('COLLECTIVE_EMAIL_FROM') || env('EMAIL_FROM') || 'The P31 Collective <members@thep31collective.org>',
  },
  market: {
    team: 'Proverbs 31 Marketplace',
    label: 'vendor@p31market.com',
    from: () => env('EMAIL_FROM') || 'Proverbs 31 Marketplace <vendor@p31market.com>',
  },
};

export const addressOf = (s: string) => (String(s).match(/<([^>]+)>/)?.[1] || String(s)).trim().toLowerCase();
export const nameOf = (s: string) => {
  const m = String(s).match(/^\s*"?([^"<]*?)"?\s*</);
  return m && m[1].trim() ? m[1].trim() : null;
};
export const baseSubject = (s: string) => String(s || '').replace(/^\s*((re|fw|fwd|aw)\s*:\s*)+/i, '').trim().toLowerCase();

// deno-lint-ignore no-explicit-any
type Db = any;

async function liveFacts(db: Db) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db.from('market_events').select('title, event_date, date_public, venue')
    .eq('is_active', true).gte('event_date', today).order('event_date').limit(5);
  const lines = (data || []).map((e: { title: string; event_date: string; date_public: boolean; venue: string | null }) =>
    `- ${e.title}: ${e.date_public ? e.event_date : 'date not announced'}${e.date_public && e.venue ? `, ${e.venue}` : ''}`);
  return lines.length ? `Upcoming markets:\n${lines.join('\n')}` : 'Upcoming markets: none scheduled yet.';
}

/** Ask Carla for a (new) draft on this conversation and save it on the thread. */
export async function redraft(db: Db, threadId: string, instruction = '') {
  if (!brainConfigured()) return { error: 'Carla needs GEMINI_API_KEY or ANTHROPIC_API_KEY in Supabase secrets.' };
  const { data: thread } = await db.from('email_threads').select('*').eq('id', threadId).single();
  if (!thread) return { error: 'Conversation not found.' };
  const { data: msgs } = await db.from('email_messages').select('direction, from_email, from_name, subject, body_text, created_at, attachments')
    .eq('thread_id', threadId).order('created_at', { ascending: false }).limit(10);
  const box = MAILBOX[thread.mailbox as Mailbox];
  const conversation = (msgs || []).reverse().map((m: { direction: string; from_name: string | null; from_email: string; created_at: string; subject: string; body_text: string; attachments: unknown[] }) =>
    `--- ${m.direction === 'in' ? `FROM ${m.from_name || ''} <${m.from_email}>` : `OUR REPLY (${box.team})`} · ${m.created_at.slice(0, 16).replace('T', ' ')} UTC\n`
    + `Subject: ${m.subject}\n${(m.attachments || []).length ? `[${(m.attachments || []).length} attachment(s)]\n` : ''}${String(m.body_text).slice(0, 6000)}`).join('\n\n');
  const context = [
    `MODE: EMAIL. Inbox: ${box.label}. Sign as: Carla, ${box.team}.`,
    thread.contact_name ? `Their name: ${thread.contact_name}.` : '',
    `Today: ${new Date().toISOString().slice(0, 10)}.`,
    await liveFacts(db),
    instruction ? `The team member reviewing this asks you to change the draft: ${instruction.slice(0, 500)}` : '',
  ].filter(Boolean).join('\n');

  const d = await draftReply(context, `Draft our reply to the newest email in this conversation:\n\n${conversation}`);
  if (!d) return { error: 'Carla could not draft this one. Write the reply yourself.' };
  const quiet = d.category === 'spam' || d.category === 'automated';
  await db.from('email_threads').update({
    category: d.category, summary: d.summary, needs_human: d.needs_human, human_reason: d.reason || null,
    draft: d.reply || null, draft_at: new Date().toISOString(),
    ...(quiet && !instruction ? { status: 'ignored' } : {}),
  }).eq('id', threadId);
  return { draft: d };
}
