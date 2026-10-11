// Supabase Edge Function: team-digest
// One email at 8 AM Eastern with what came in over the last day, across both sites: orders, vendor
// applications, Collective applications, storefront agreements, market registrations, survey answers,
// volunteers, emails waiting for a reply, site errors, the posts going out today, and the next event.
// The scheduler (v38) calls it at 12:05 and 13:05 UTC; it sends only during the 8 AM Eastern hour and
// only once per day (team_digests), so extra calls are harmless.
// A team member can send themselves a test copy: POST { "test": true } while signed in.
//
// Secrets: RESEND_API_KEY, EMAIL_FROM (or MARKET_EMAIL_FROM), DIGEST_TO (comma list; default founder@),
//          ZERNIO_API_KEY (optional: posts going out today)
// Deploy: supabase functions deploy team-digest --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, layout, esc, money, emailConfigured } from '../_shared/email.ts';

const env = (k: string) => Deno.env.get(k) || '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

const TZ = 'America/New_York';
const SYSTEMS = 'https://www.thep31collective.org/systems';
const etParts = (d = new Date()) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
  .formatToParts(d).map((p) => [p.type, p.value]));
const etDate = (d = new Date()) => { const p = etParts(d); return `${p.year}-${p.month}-${p.day}`; };
const etHour = (d = new Date()) => Number(etParts(d).hour) % 24;
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const list = (k: string, fallback: string[]) => { const v = env(k).split(',').map((s) => s.trim()).filter(Boolean); return v.length ? v : fallback; };

// ── Email pieces ──
const section = (title: string, n: number, link: string, rows: string[]) => `
<tr><td style="padding:18px 0 6px;border-top:1px solid #eee">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="font-size:15px;font-weight:bold;color:#2A1526">${esc(title)}</td>
    <td align="right" style="font-size:22px;font-family:Georgia,serif;color:${n ? '#3A1C36' : '#B9AFC6'}">${n}</td>
  </tr></table>
  ${rows.length ? `<ul style="margin:6px 0 0;padding-left:18px;color:#4E3A4B;font-size:13px;line-height:1.55">${rows.map((r) => `<li>${r}</li>`).join('')}</ul>` : ''}
  ${n ? `<p style="margin:6px 0 0;font-size:12px"><a href="${link}" style="color:#3A1C36">Open in Systems</a></p>` : ''}
</td></tr>`;

async function zernioToday(today: string): Promise<Row[]> {
  if (!env('ZERNIO_API_KEY')) return [];
  try {
    const res = await fetch('https://zernio.com/api/v1/posts?status=scheduled&limit=100&sortBy=scheduled-asc', { headers: { Authorization: `Bearer ${env('ZERNIO_API_KEY')}` } });
    if (!res.ok) return [];
    const { posts = [] } = await res.json();
    return posts.filter((p: Row) => p.scheduledFor && etDate(new Date(p.scheduledFor)) === today);
  } catch { return []; }
}

// deno-lint-ignore no-explicit-any
async function gather(db: any) {
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const today = etDate();
  const q = (table: string, cols: string) => db.from(table).select(cols, { count: 'exact' }).gte('created_at', since).order('created_at', { ascending: false }).limit(6);
  const safe = async (p: PromiseLike<Row>) => { try { const r = await p; return r.error ? { data: [], count: 0 } : r; } catch { return { data: [], count: 0 }; } };
  const [orders, vendors, joins, agreements, regs, feedback, volunteers, emails, errors, events, posts] = await Promise.all([
    safe(q('orders', 'id, product_name, buyer_name, amount_total, payment_status, fulfillment_status')),
    safe(q('vendor_applications', 'id, full_name, business_name')),
    safe(q('collective_applications', 'id, full_name, city_state')),
    safe(q('vendor_agreements', 'id, business_name, first_name, last_name, status')),
    safe(q('vendor_registrations', 'id, business_name, event_label')),
    safe(q('vendor_feedback', 'id, business_name, market_label, overall, again')),
    safe(q('volunteer_signups', 'id, first_name, last_name')),
    safe(db.from('email_threads').select('id, contact_name, contact_email, subject', { count: 'exact' }).eq('status', 'needs_reply').order('last_message_at', { ascending: false }).limit(5)),
    safe(db.from('app_errors').select('id, message, count', { count: 'exact' }).is('resolved_at', null).gte('last_seen', since).order('count', { ascending: false }).limit(3)),
    safe(db.from('market_events').select('id, title, event_date, date_public, has_vendors').eq('is_active', true).gte('event_date', today).order('event_date').limit(1)),
    zernioToday(today),
  ]);
  let lineup: number | null = null;
  const next = (events.data || [])[0] || null;
  if (next?.has_vendors) {
    const { count } = await db.from('event_vendors').select('id', { count: 'exact', head: true }).eq('event_id', next.id).in('status', ['confirmed', 'paid', 'checked_in']);
    lineup = count ?? null;
  }
  return { today, orders, vendors, joins, agreements, regs, feedback, volunteers, emails, errors, next, lineup, posts };
}

function render(g: Row) {
  const n = (r: Row) => r.count ?? (r.data || []).length;
  const paid = (g.orders.data || []).filter((o: Row) => o.payment_status === 'paid').reduce((s: number, o: Row) => s + (Number(o.amount_total) || 0), 0);
  const days = g.next ? Math.round((new Date(`${g.next.event_date}T12:00:00Z`).getTime() - new Date(`${g.today}T12:00:00Z`).getTime()) / 864e5) : null;
  const total = ['orders', 'vendors', 'joins', 'agreements', 'regs', 'feedback', 'volunteers'].reduce((s, k) => s + n(g[k]), 0);
  const rows = [
    section('New orders', n(g.orders), `${SYSTEMS}/orders`, (g.orders.data || []).map((o: Row) => `${esc(o.product_name || 'Order')} · ${esc(o.buyer_name || 'a shopper')}${o.amount_total ? ` · ${money(o.amount_total)}` : ''}`)),
    section('Vendor applications', n(g.vendors), `${SYSTEMS}/vendors`, (g.vendors.data || []).map((v: Row) => `${esc(v.business_name)} · ${esc(v.full_name)}`)),
    section('Storefront agreements', n(g.agreements), `${SYSTEMS}/forms?tab=agreements`, (g.agreements.data || []).map((a: Row) => `${esc(a.business_name)} · ${esc(`${a.first_name} ${a.last_name}`)}${a.status === 'account_sent' ? ' · account link sent automatically' : ''}`)),
    section('Market registrations', n(g.regs), `${SYSTEMS}/forms?tab=registrations`, (g.regs.data || []).map((r: Row) => `${esc(r.business_name)} · ${esc(r.event_label)}`)),
    section('Survey answers', n(g.feedback), `${SYSTEMS}/forms?tab=feedback`, (g.feedback.data || []).map((f: Row) => `${esc(f.business_name)} · ${esc(f.market_label)} · ${f.overall}/5${f.again === 'in' ? ' · in for the next market' : ''}`)),
    section('Volunteers', n(g.volunteers), `${SYSTEMS}/forms?tab=volunteers`, (g.volunteers.data || []).map((v: Row) => esc(`${v.first_name} ${v.last_name}`))),
    section('Join P31 Collective applications', n(g.joins), `${SYSTEMS}/applications`, (g.joins.data || []).map((j: Row) => `${esc(j.full_name)}${j.city_state ? ` · ${esc(j.city_state)}` : ''}`)),
    section('Emails waiting for a reply', n(g.emails), 'https://www.thep31collective.org/studio/email', (g.emails.data || []).map((e: Row) => `${esc(e.contact_name || e.contact_email)} · ${esc(e.subject || '')}`)),
    section('Posts going out today', g.posts.length, 'https://www.thep31collective.org/studio/calendar', g.posts.map((p: Row) => `${esc(time(p.scheduledFor))} · ${esc(String(p.content || p.title || '').split('\n')[0].slice(0, 90))}`)),
    g.errors.count ? section('Site errors (new or still happening)', n(g.errors), `${SYSTEMS}/health`, (g.errors.data || []).map((e: Row) => `${esc(String(e.message).slice(0, 100))} · ${e.count}×`)) : '',
  ].join('');
  const next = g.next ? `<p style="margin:0 0 6px;font-size:14px;color:#4E3A4B"><b>${esc(g.next.title)}</b> ${days === 0 ? 'is today' : days === 1 ? 'is tomorrow' : `is in ${days} days`}${g.lineup != null ? ` · ${g.lineup} vendor${g.lineup === 1 ? '' : 's'} confirmed` : ''}.</p>` : '';
  const lead = total ? `${total} new ${total === 1 ? 'thing' : 'things'} came in over the last day${paid ? `, with ${money(paid)} in paid orders` : ''}.` : 'A quiet night: nothing new came in.';
  const html = layout(`Good morning. Here is your P31 day.`, `<p style="margin:0 0 10px;font-size:15px;line-height:1.5">${lead}</p>${next}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<p style="margin:22px 0 0"><a href="https://www.thep31collective.org/today" style="display:inline-block;background:#F2CE4D;color:#2a1a00;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px">Open Today</a></p>`,
  'Sent every morning at 8 AM Eastern by P31 Systems.');
  const subject = total ? `P31 this morning: ${total} new${n(g.orders) ? ` · ${n(g.orders)} order${n(g.orders) === 1 ? '' : 's'}` : ''}${g.posts.length ? ` · ${g.posts.length} post${g.posts.length === 1 ? '' : 's'} today` : ''}` : `P31 this morning: quiet night${g.posts.length ? ` · ${g.posts.length} post${g.posts.length === 1 ? '' : 's'} today` : ''}`;
  return { html, subject, total, quiet: !total && !g.posts.length && !n(g.emails) && !g.errors.count };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!emailConfigured()) return json({ ok: false, waiting: 'email' });
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  // deno-lint-ignore no-explicit-any
  let b: any = {};
  try { b = await req.json(); } catch { /* the scheduler sends a small body; nothing else is needed */ }
  const from = env('MARKET_EMAIL_FROM') || env('EMAIL_FROM') || undefined;

  // A signed-in team member asking for a test copy: send it to them, now, without marking the day.
  if (b.test) {
    const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
    const { data: who } = await asUser.auth.getUser();
    if (!who?.user?.email) return json({ error: 'Sign in first.' }, 401);
    const [{ data: admin }, { data: operator }] = await Promise.all([asUser.rpc('is_academy_admin'), asUser.rpc('is_operator')]);
    if (!admin && !operator) return json({ error: 'Team only.' }, 403);
    const d = render(await gather(db));
    const res = await sendEmail(who.user.email, `[Test] ${d.subject}`, d.html, undefined, from);
    return json({ ok: !!res.ok, sentTo: who.user.email });
  }

  // The scheduled run: only in the 8 AM Eastern hour, once per Eastern day.
  if (etHour() !== 8) return json({ ok: true, skipped: 'not 8 AM Eastern' });
  const day = etDate();
  const { data: claimed } = await db.from('team_digests').insert({ day }).select('day');
  if (!claimed?.length) return json({ ok: true, skipped: 'already sent today' });

  const g = await gather(db);
  const d = render(g);
  if (d.quiet) {
    await db.from('team_digests').update({ summary: { quiet: true } }).eq('day', day);
    return json({ ok: true, skipped: 'nothing to report' });
  }
  const res = await sendEmail(list('DIGEST_TO', ['founder@thep31collective.org']), d.subject, d.html, 'founder@thep31collective.org', from);
  if (!res.ok) { await db.from('team_digests').delete().eq('day', day); return json({ ok: false, error: 'email failed' }, 502); }
  await db.from('team_digests').update({ sent_at: new Date().toISOString(), summary: { total: d.total, posts: g.posts.length } }).eq('day', day);
  return json({ ok: true, sent: true, total: d.total });
});
