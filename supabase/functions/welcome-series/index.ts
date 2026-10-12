// Supabase Edge Function: welcome-series
// Three welcome emails for someone who joins the newsletter (the marketplace pop-up, the home page
// form, or the Collective), a few days apart:
//   1. Welcome, and why P31 began (Melanie JC's story, from the site)
//   2. What is coming up (the next public events from market_events, with their ticket links)
//   3. Ways to be part of it (vend, join the Collective, mentorship, shop, follow)
// leads.welcome_step / welcome_next_at track each person (v42); people who were on the list before
// v42 are marked as welcomed and never emailed. Every email carries the unsubscribe link.
// The scheduler calls this every hour.
// Secrets: RESEND_API_KEY, MARKET_EMAIL_FROM / COLLECTIVE_EMAIL_FROM or EMAIL_FROM
// Deploy: supabase functions deploy welcome-series --no-verify-jwt
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

const MARKET = 'https://www.p31market.com';
const COLLECTIVE = 'https://www.thep31collective.org';
const GAP_DAYS = [3, 4]; // after email 1, after email 2
const p = (html: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${html}</p>`;
const a = (href: string, label: string) => `<a href="${href}" style="color:#3A1C36;font-weight:bold">${esc(label)}</a>`;
const button = (href: string, label: string) => `<p style="margin:20px 0 6px"><a href="${href}" style="display:inline-block;background:#F2CE4D;color:#2a1a00;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px">${esc(label)}</a></p>`;
const verse = (text: string, ref: string) => `<p style="margin:18px 0;padding:14px 18px;border-left:3px solid #D9A93A;background:#F8F3FA;font-family:Georgia,serif;font-size:16px;line-height:1.5;color:#3A1C36">“${esc(text)}”<br><span style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:1px;color:#8a6d1a">${esc(ref)} KJV</span></p>`;
const eventDate = (e: Row) => {
  const d = new Date(`${String(e.event_date).slice(0, 10)}T12:00:00`);
  if (e.date_public) return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return `${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} (date announcing soon)`;
};

function emailFor(step: number, lead: Row, events: Row[]) {
  const first = String(lead.full_name || '').trim().split(/\s+/)[0];
  const hi = first ? `Hi ${esc(first)},` : 'Hello,';
  const collective = lead.welcome_track === 'collective';
  const brand = collective ? 'THE PROVERBS 31 COLLECTIVE' : 'PROVERBS 31 MARKETPLACE';
  const unsub = `${MARKET}/unsubscribe?t=${lead.unsubscribe_token}`; // the unsubscribe page lives on the marketplace
  const foot = `${collective ? 'thep31collective.org · The Proverbs 31 Collective by NEBA' : 'p31market.com · Where her gifts make room.'}<br>You are getting this because you joined our newsletter. <a href="${unsub}" style="color:#74657A">Unsubscribe</a>.`;

  if (step === 0) {
    return {
      subject: collective ? 'Welcome to The P31 Collective' : 'Welcome to the Proverbs 31 Marketplace',
      html: layout('Welcome. You belong here.', [
        p(hi),
        p(`Thank you for joining us. ${collective ? 'The P31 Collective is' : 'Proverbs 31 Marketplace and The P31 Collective are'} a community of faith-driven women who create, build and lead, and we are so glad you are here.`),
        p('Melanie JC started P31 with a simple conviction: gifted women deserve a stage as excellent as their work. In 2019 she founded Not Easily Broken Apart (NEBA) Women’s Ministry for healing, restoration and purposeful living, and what began as a calling to help women heal has grown into a movement of women who build, lead and prosper God’s way.'),
        verse('Give her of the fruit of her hands; and let her own works praise her in the gates.', 'Proverbs 31:31'),
        p(`Over the next week we will send two more short notes: what is coming up, and the ways to be part of it. In the meantime, ${a(`${COLLECTIVE}/#melanie`, 'meet Melanie')} or ${a(`${MARKET}/directory`, 'browse our curators')}.`),
      ].join(''), foot, brand),
    };
  }
  if (step === 1) {
    const list = events.length
      ? `<ul style="margin:0 0 14px;padding-left:18px;font-size:15px;line-height:1.6">${events.map((e) => `<li><b>${esc(e.title)}</b><br>${esc(eventDate(e))}${e.venue ? ` · ${esc(e.venue)}` : ''}${e.rsvp_url ? `<br>${a(e.rsvp_url, /eventbrite/i.test(e.rsvp_url) ? 'Get tickets' : 'Details and RSVP')}` : ''}</li>`).join('')}</ul>`
      : p('New dates are announced first to this list, so keep an eye on your inbox.');
    return {
      subject: 'What is coming up at P31',
      html: layout('What is coming up', [
        p(hi),
        p('Here is what is on the calendar. Newsletter friends hear about new dates first.'),
        list,
        button(`${MARKET}/calendar`, 'See every date'),
        p(`Running a business? Our mentorships pair you with Melanie JC for faith-centered business and personal growth. ${a(`${COLLECTIVE}/mentorship`, 'Learn about the mentorships')}.`),
      ].join(''), foot, brand),
    };
  }
  return {
    subject: 'Three ways to be part of P31',
    html: layout('Three ways to be part of it', [
      p(hi),
      p(`<b>Vend with us.</b> Women-owned brands sell on the marketplace and at our markets. ${a(`${MARKET}/apply`, 'Apply to become a curator')}.`),
      p(`<b>Join The P31 Collective.</b> A faith-centered community for women entrepreneurs who want to grow spiritually, purposefully and professionally. ${a(`${COLLECTIVE}/join`, 'Join the Collective')}.`),
      p(`<b>Shop and share.</b> Every purchase supports a woman-owned business. ${a(`${MARKET}/shop`, 'Shop the marketplace')}, and follow along on Instagram at ${a('https://www.instagram.com/proverbs31market', '@proverbs31market')} and ${a('https://www.instagram.com/the.p31collective', '@the.p31collective')}.`),
      verse('Strength and honour are her clothing; and she shall rejoice in time to come.', 'Proverbs 31:25'),
      p('Thank you for being here. Reply to this email any time; a real person reads it.'),
    ].join(''), foot, brand),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!emailConfigured()) return json({ ok: false, waiting: 'email' });
  // deno-lint-ignore no-explicit-any
  const db: any = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const { data: cfg } = await db.from('app_settings').select('value').eq('key', 'welcome').maybeSingle();
  if (cfg?.value?.enabled === false) return json({ ok: true, skipped: 'welcome emails are off' });

  const nowIso = new Date().toISOString();
  const { data: due, error } = await db.from('leads')
    .select('id, full_name, email, unsubscribe_token, welcome_step, welcome_next_at, welcome_track')
    .lt('welcome_step', 3).not('welcome_next_at', 'is', null).lte('welcome_next_at', nowIso).eq('unsubscribed', false)
    .order('welcome_next_at').limit(150);
  if (error) return json({ error: error.message }, 500);
  if (!due?.length) return json({ ok: true, sent: 0 });

  const today = new Date().toISOString().slice(0, 10);
  const { data: events } = await db.from('market_events').select('title, event_date, date_public, month_public, venue, rsvp_url')
    .eq('is_active', true).gte('event_date', today).or('date_public.eq.true,month_public.eq.true').order('event_date').limit(4);

  let sent = 0;
  for (const lead of due) {
    // Claim this step (push the next time ahead) so overlapping runs never send it twice.
    const { data: claimed } = await db.from('leads').update({ welcome_next_at: new Date(Date.now() + 3600e3).toISOString() })
      .eq('id', lead.id).eq('welcome_step', lead.welcome_step).lte('welcome_next_at', nowIso).select('id');
    if (!claimed?.length) continue;
    const { subject, html } = emailFor(lead.welcome_step, lead, events || []);
    const from = lead.welcome_track === 'collective' ? (env('COLLECTIVE_EMAIL_FROM') || env('EMAIL_FROM') || undefined) : (env('MARKET_EMAIL_FROM') || env('EMAIL_FROM') || undefined);
    const replyTo = lead.welcome_track === 'collective' ? 'members@thep31collective.org' : 'outreach@p31market.com';
    const res = await sendEmail(lead.email, subject, html, replyTo, from);
    if (!res.ok && !res.skipped) continue; // claimed for an hour, then tried again
    const next = lead.welcome_step + 1;
    await db.from('leads').update({ welcome_step: next, welcome_next_at: next < 3 ? new Date(Date.now() + GAP_DAYS[lead.welcome_step] * 864e5).toISOString() : null }).eq('id', lead.id);
    sent += 1;
  }
  return json({ ok: true, sent });
});
