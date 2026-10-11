// Supabase Edge Function: vendor-decision
// Systems → Market: the emails the team sends vendors by hand, from vendor@p31market.com, each recorded on the row.
//   • Vendor applications  { application_id, decision: 'approved'|'waitlist'|'declined', event?: { title, date, venue }, note? }
//   • Market registrations { registration_id, decision: 'confirmed'|'waitlist'|'declined', note? }   (event details come from the registration)
//   • Storefront agreements { agreement_id, decision: 'storefront', note? }  → the link to create (or open) her account
// Team only (admins and Systems operators).
// Deploy: supabase functions deploy vendor-decision --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, layout, esc, emailConfigured } from '../_shared/email.ts';

const env = (k: string) => Deno.env.get(k) || '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const SITE = 'https://www.p31market.com';
const FOOT = 'p31market.com · Where her gifts make room.';
const a = (path: string, label?: string) => `<a href="${SITE}${path}" style="color:#3A1C36">${esc(label || `p31market.com${path}`)}</a>`;
const para = (note: string) => (note ? `<p>${esc(note).replace(/\n/g, '<br>')}</p>` : '');
const longDate = (d: string) => new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

type Ev = { title: string; date: string; venue: string } | null;
type Body = { subject: string; title: string; html: string };
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

// ── Vendor applications (p31market.com/apply) ──
const APPLICATION: Record<string, (a: Row, ev: Ev, note: string) => Body> = {
  approved: (x, ev, note) => ({
    subject: `You’re in: ${x.business_name} at the Proverbs 31 Market`,
    title: 'Welcome to the market',
    html: `<p>Hi ${esc(x.first)},</p>
<p>We’re delighted to welcome <b>${esc(x.business_name)}</b> as a vendor at the Proverbs 31 Market${ev?.title ? ` for <b>${esc(ev.title)}</b>` : ''}.</p>
${ev ? `<p>${[ev.date, ev.venue].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
${para(note)}
<p>Next steps:</p>
<ol style="padding-left:20px;line-height:1.6">
<li>Reply to this email to confirm your spot.</li>
<li>Reserve your space: complete the market registration and sign the Vendor Rules &amp; Regulations at ${a('/vendors/register')}. Have your logo handy; it goes on the lineup.</li>
<li>Create your curator account at ${a('/register')} using this same email (<b>${esc(x.email)}</b>). Your studio opens the moment you sign up: your own storefront on the marketplace, products, payments and marketing tools, plus your booth details as they’re set. Then sign the Storefront Agreement at ${a('/vendors/agreement')}.</li>
<li>Booth placement, load-in times and payment details follow by email once the lineup is set.</li>
</ol>
<p>Give her of the fruit of her hands; and let her own works praise her in the gates. (Proverbs 31:31)</p>`,
  }),
  waitlist: (x, ev, note) => ({
    subject: `Your Proverbs 31 Market application: on the waitlist`,
    title: 'You’re on our waitlist',
    html: `<p>Hi ${esc(x.first)},</p>
<p>Thank you for applying to vend with <b>${esc(x.business_name)}</b>. ${ev?.title ? `<b>${esc(ev.title)}</b> is full for your category right now` : 'This market is full for your category right now'}, so we’ve placed you on the waitlist.</p>
${para(note)}
<p>If a spot opens, we’ll email you first. Your application also stays in line for the next market. In the meantime, you’re welcome to create a storefront on the marketplace at ${a('/register')}.</p>`,
  }),
  declined: (x, _ev, note) => ({
    subject: `Your Proverbs 31 Market application`,
    title: 'Thank you for applying',
    html: `<p>Hi ${esc(x.first)},</p>
<p>Thank you for applying to vend with <b>${esc(x.business_name)}</b>. We weren’t able to offer a spot this time.</p>
${para(note)}
<p>Every market is curated around a balance of categories, so this isn’t a verdict on your work. We’d love to see you apply again for a future market, and you’re welcome at any of our markets as a guest.</p>`,
  }),
};

// ── Market registrations (p31market.com/vendors/register) ──
const REGISTRATION: Record<string, (r: Row, ev: Ev, note: string) => Body> = {
  confirmed: (r, ev, note) => ({
    subject: `Your space is confirmed: ${r.business_name} at ${r.event_label}`,
    title: 'Your vendor space is confirmed',
    html: `<p>Hi ${esc(r.first)},</p>
<p>Your registration for <b>${esc(r.business_name)}</b> at <b>${esc(r.event_label)}</b> is confirmed. Thank you for signing the Vendor Rules &amp; Regulations.</p>
${ev && (ev.date || ev.venue) ? `<p>${[ev.date, ev.venue].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
${para(note)}
<p>What to expect:</p>
<ol style="padding-left:20px;line-height:1.6">
<li>Booth placement, load-in time and payment details follow by email as the lineup is set.</li>
<li>On market day, arrive and check in no later than 3:15 PM; late arrivals cannot set up. In an emergency, call 470-562-2852.</li>
<li>Bring your own 6-foot table and a floor-length covering (an 8-foot table and skirt are provided for Package A only): one table, up to two chairs, one assistant.</li>
<li>No storefront yet? Sign the Storefront Agreement at ${a('/vendors/agreement')} and your shop can be live before the market.</li>
</ol>`,
  }),
  waitlist: (r, _ev, note) => ({
    subject: `Your registration for ${r.event_label}: on the waitlist`,
    title: 'You’re on our waitlist',
    html: `<p>Hi ${esc(r.first)},</p>
<p>Thank you for registering <b>${esc(r.business_name)}</b> for <b>${esc(r.event_label)}</b>. That market is full for your category right now, so we’ve placed you on the waitlist.</p>
${para(note)}
<p>If a space opens, we’ll email you first, and your registration stays in line for the next market.</p>`,
  }),
  declined: (r, _ev, note) => ({
    subject: `Your registration for ${r.event_label}`,
    title: 'Thank you for registering',
    html: `<p>Hi ${esc(r.first)},</p>
<p>Thank you for registering <b>${esc(r.business_name)}</b> for <b>${esc(r.event_label)}</b>. We weren’t able to offer a space this time.</p>
${para(note)}
<p>Every market is curated around a balance of categories, so this isn’t a verdict on your work. We’d love to see you at a future market.</p>`,
  }),
};

// ── Storefront agreements (p31market.com/vendors/agreement) ──
const storefront = (g: Row, hasAccount: boolean, note: string): Body => ({
  subject: hasAccount ? `Your storefront on Proverbs 31 Marketplace is active` : `Create your account: your P31 storefront is ready to set up`,
  title: hasAccount ? 'Your storefront is active' : 'Your storefront is ready to set up',
  html: `<p>Hi ${esc(g.first)},</p>
<p>Thank you for signing the Storefront Agreement for <b>${esc(g.business_name)}</b>.</p>
${para(note)}
${hasAccount
    ? `<p>You already have a curator account with this email, so your storefront is active. Sign in at ${a('/login')} to add products, set up payments and share your link.</p>`
    : `<p>Here is the link we promised: create your curator account at ${a('/register')} using this same email (<b>${esc(g.email)}</b>). Your studio opens the moment you sign up: your own storefront on the marketplace, products, payments and marketing tools, with a short walkthrough to start.</p>`}
<p>Your storefront is complimentary for 3 months from activation (a 5% transaction fee applies to each sale). We’ll send the $14.99 monthly subscription link before the complimentary period ends, should you choose to continue.</p>
<p>Questions along the way? Reply to this email.</p>`,
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return json({ error: 'Sign in first.' }, 401);
  const [{ data: admin }, { data: operator }] = await Promise.all([asUser.rpc('is_academy_admin'), asUser.rpc('is_operator')]);
  if (!admin && !operator) return json({ error: 'Team only.' }, 403);
  if (!emailConfigured()) return json({ error: 'Email isn’t set up yet (RESEND_API_KEY).' }, 503);

  // deno-lint-ignore no-explicit-any
  let b: any = {};
  try { b = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  const decision = String(b.decision || '');
  const note = String(b.note || '').slice(0, 2000);
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const from = env('EMAIL_FROM') || 'Proverbs 31 Marketplace <vendor@p31market.com>';
  const stamp = (prev: string | null, what: string) => [prev, `${new Date().toLocaleDateString('en-US')}: emailed “${what}”`].filter(Boolean).join('\n');
  const send = async (to: string, m: Body) => {
    const res = await sendEmail(to, m.subject, layout(m.title, m.html, FOOT), 'vendor@p31market.com', from);
    return !!res.ok;
  };

  // Storefront agreement: the account link.
  if (b.agreement_id) {
    if (decision !== 'storefront') return json({ error: 'Unknown decision.' }, 400);
    const { data: g } = await db.from('vendor_agreements').select('*').eq('id', String(b.agreement_id)).maybeSingle();
    if (!g) return json({ error: 'Agreement not found.' }, 404);
    const hasAccount = !!g.curator_id;
    if (!(await send(g.email, storefront({ ...g, first: g.first_name }, hasAccount, note)))) return json({ error: 'The email didn’t send. Check the Resend setup.' }, 502);
    await db.from('vendor_agreements').update({
      status: hasAccount ? 'active' : 'account_sent', reviewed_by: who.user.id, reviewed_at: new Date().toISOString(),
      review_notes: stamp(g.review_notes, hasAccount ? 'storefront active' : 'account link'),
    }).eq('id', g.id);
    return json({ ok: true, has_account: hasAccount });
  }

  // Market registration: confirmed / waitlist / declined, with the market's own details.
  if (b.registration_id) {
    if (!REGISTRATION[decision]) return json({ error: 'Unknown decision.' }, 400);
    const { data: r } = await db.from('vendor_registrations').select('*').eq('id', String(b.registration_id)).maybeSingle();
    if (!r) return json({ error: 'Registration not found.' }, 404);
    let ev: Ev = null;
    if (r.event_id) {
      const { data: e } = await db.from('market_events').select('title, event_date, venue, address, start_time, date_public').eq('id', r.event_id).maybeSingle();
      if (e) ev = { title: e.title, date: e.date_public ? `${longDate(e.event_date)}${e.start_time ? ` · ${e.start_time}` : ''}` : '', venue: [e.venue, e.address].filter(Boolean).join(', ') };
    }
    if (!(await send(r.email, REGISTRATION[decision]({ ...r, first: r.first_name }, ev, note)))) return json({ error: 'The email didn’t send. Check the Resend setup.' }, 502);
    await db.from('vendor_registrations').update({
      status: decision, reviewed_by: who.user.id, reviewed_at: new Date().toISOString(), review_notes: stamp(r.review_notes, decision),
    }).eq('id', r.id);
    return json({ ok: true });
  }

  // Vendor application (the original flow).
  if (!APPLICATION[decision]) return json({ error: 'Unknown decision.' }, 400);
  const { data: x } = await db.from('vendor_applications').select('*').eq('id', String(b.application_id || '')).maybeSingle();
  if (!x) return json({ error: 'Application not found.' }, 404);
  const ev: Ev = b.event && typeof b.event === 'object' ? { title: String(b.event.title || ''), date: String(b.event.date || ''), venue: String(b.event.venue || '') } : null;
  const m = APPLICATION[decision]({ ...x, first: String(x.full_name).split(' ')[0] }, ev, note);
  if (!(await send(x.email, m))) return json({ error: 'The email didn’t send. Check the Resend setup.' }, 502);
  await db.from('vendor_applications').update({ status: decision, reviewed_by: who.user.id, reviewed_at: new Date().toISOString(), review_notes: stamp(x.review_notes, decision) }).eq('id', x.id);
  return json({ ok: true });
});
