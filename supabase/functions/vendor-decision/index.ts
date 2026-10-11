// Supabase Edge Function: vendor-decision
// Systems → Vendor applications: when the team sets an application to approved, waitlist or
// declined and presses "Email them", this sends the applicant the matching note from
// vendor@p31market.com and records that it went out. Team only (admins and Systems operators).
//   { application_id, decision: 'approved'|'waitlist'|'declined', event?: { title, date, venue }, note? }
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

const BODIES: Record<string, (a: Record<string, string>, ev: Record<string, string> | null, note: string) => { subject: string; title: string; html: string }> = {
  approved: (a, ev, note) => ({
    subject: `You’re in: ${a.business_name} at the Proverbs 31 Market`,
    title: 'Welcome to the market',
    html: `<p>Hi ${esc(a.first)},</p>
<p>We’re delighted to welcome <b>${esc(a.business_name)}</b> as a vendor at the Proverbs 31 Market${ev?.title ? ` for <b>${esc(ev.title)}</b>` : ''}.</p>
${ev ? `<p>${[ev.date, ev.venue].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
${note ? `<p>${esc(note).replace(/\n/g, '<br>')}</p>` : ''}
<p>Next steps:</p>
<ol style="padding-left:20px;line-height:1.6">
<li>Reply to this email to confirm your spot.</li>
<li>Create your curator account at <a href="${SITE}/register" style="color:#5E2A8C">${SITE.replace('https://', '')}/register</a> using this same email (<b>${esc(a.email)}</b>). Your studio opens the moment you sign up: your own storefront on the marketplace, products, payments and marketing tools, plus your booth details as they’re set.</li>
<li>Booth placement, load-in times and payment details follow by email once the lineup is set.</li>
</ol>
<p>Give her of the fruit of her hands; and let her own works praise her in the gates. (Proverbs 31:31)</p>`,
  }),
  waitlist: (a, ev, note) => ({
    subject: `Your Proverbs 31 Market application: on the waitlist`,
    title: 'You’re on our waitlist',
    html: `<p>Hi ${esc(a.first)},</p>
<p>Thank you for applying to vend with <b>${esc(a.business_name)}</b>. ${ev?.title ? `<b>${esc(ev.title)}</b> is full for your category right now` : 'This market is full for your category right now'}, so we’ve placed you on the waitlist.</p>
${note ? `<p>${esc(note).replace(/\n/g, '<br>')}</p>` : ''}
<p>If a spot opens, we’ll email you first. Your application also stays in line for the next market. In the meantime, you’re welcome to create a storefront on the marketplace at <a href="${SITE}/register" style="color:#5E2A8C">${SITE.replace('https://', '')}/register</a>.</p>`,
  }),
  declined: (a, _ev, note) => ({
    subject: `Your Proverbs 31 Market application`,
    title: 'Thank you for applying',
    html: `<p>Hi ${esc(a.first)},</p>
<p>Thank you for applying to vend with <b>${esc(a.business_name)}</b>. We weren’t able to offer a spot this time.</p>
${note ? `<p>${esc(note).replace(/\n/g, '<br>')}</p>` : ''}
<p>Every market is curated around a balance of categories, so this isn’t a verdict on your work. We’d love to see you apply again for a future market, and you’re welcome at any of our markets as a guest.</p>`,
  }),
};

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
  if (!BODIES[decision]) return json({ error: 'Unknown decision.' }, 400);
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const { data: a } = await db.from('vendor_applications').select('*').eq('id', String(b.application_id || '')).maybeSingle();
  if (!a) return json({ error: 'Application not found.' }, 404);

  const ev = b.event && typeof b.event === 'object' ? { title: String(b.event.title || ''), date: String(b.event.date || ''), venue: String(b.event.venue || '') } : null;
  const m = BODIES[decision]({ ...a, first: String(a.full_name).split(' ')[0] }, ev, String(b.note || '').slice(0, 2000));
  const from = env('EMAIL_FROM') || 'Proverbs 31 Marketplace <vendor@p31market.com>';
  const res = await sendEmail(a.email, m.subject, layout(m.title, m.html, 'p31market.com · Where her gifts make room.'), 'vendor@p31market.com', from);
  if (!res.ok) return json({ error: 'The email didn’t send. Check the Resend setup.' }, 502);
  await db.from('vendor_applications').update({ status: decision, reviewed_by: who.user.id, reviewed_at: new Date().toISOString(),
    review_notes: [a.review_notes, `${new Date().toLocaleDateString('en-US')}: emailed “${decision}”`].filter(Boolean).join('\n') }).eq('id', a.id);
  return json({ ok: true });
});
