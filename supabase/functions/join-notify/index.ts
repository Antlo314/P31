// Supabase Edge Function: join-notify
// Public, but it can only do one thing: hand new "Join P31 Collective" applications to the
// team, each exactly once. For every application it hasn't handled yet it
//   1. emails members@ (and founder@ while testing), with Reply-To set to the applicant, and
//   2. adds a row to P31's Google Sheet (through the Apps Script in tools/google-sheet-intake.gs).
// The Join page calls it right after someone applies; calling it again sends nothing new.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY, EMAIL_FROM        email (already used by the other functions)
//   JOIN_NOTIFY_TO                    optional, comma list; defaults to DEFAULT_TO below
//   COLLECTIVE_EMAIL_FROM             optional sender, e.g. "The P31 Collective <members@thep31collective.org>"
//   JOIN_SHEET_URL, JOIN_SHEET_TOKEN  the Apps Script web app URL and the token set in that script
// Deploy: supabase functions deploy join-notify --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, layout, esc, emailConfigured } from '../_shared/email.ts';

// founder@ is on the list for testing. Change without a code change:
//   supabase secrets set JOIN_NOTIFY_TO="members@thep31collective.org"
const DEFAULT_TO = ['members@thep31collective.org', 'founder@thep31collective.org'];
const SITE = 'https://www.thep31collective.org';
const FIELDS = 'id, full_name, business_name, email, phone, city_state, birthday, socials, heard_from, business_description, inspiration, growth_areas, interests, agreed, source, created_at';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Application = {
  id: string; full_name: string; business_name: string | null; email: string; phone: string; city_state: string;
  birthday: string; socials: string | null; heard_from: string; business_description: string | null;
  inspiration: string | null; growth_areas: string[]; interests: string[]; agreed: boolean; source: string | null; created_at: string;
};

const eastern = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });

// ── Email ─────────────────────────────────────────────────────
const row = (label: string, value: string) =>
  `<tr><td style="padding:7px 12px 7px 0;color:#6E6580;font-size:13px;vertical-align:top;white-space:nowrap">${esc(label)}</td>`
  + `<td style="padding:7px 0;font-size:14px;color:#201431">${value}</td></tr>`;
const list = (items: string[]) => (items?.length ? items.map((i) => esc(i)).join('<br>') : '<span style="color:#6E6580">—</span>');
const text = (v: string | null) => (v && v.trim() ? esc(v).replace(/\n/g, '<br>') : '<span style="color:#6E6580">—</span>');

function applicationEmail(a: Application) {
  const body = `
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${esc(a.full_name)} applied to join The P31 Collective on ${esc(eastern(a.created_at))} (Eastern).
Reply to this email to write back to them directly.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #eee">
${row('Name', esc(a.full_name))}
${row('Business or ministry', text(a.business_name))}
${row('Email', `<a href="mailto:${esc(a.email)}" style="color:#5E2A8C">${esc(a.email)}</a>`)}
${row('Phone', `<a href="tel:${esc(a.phone.replace(/[^\d+]/g, ''))}" style="color:#5E2A8C">${esc(a.phone)}</a>`)}
${row('City / state', esc(a.city_state))}
${row('Birthday', esc(a.birthday))}
${row('Social media', text(a.socials))}
${row('Found us through', esc(a.heard_from))}
${row('Their business', text(a.business_description))}
${row('What inspired them', text(a.inspiration))}
${row('Hoping to grow in', list(a.growth_areas))}
${row('Interested in', list(a.interests))}
</table>
<p style="margin:22px 0 0"><a href="${SITE}/systems/applications" style="display:inline-block;background:#F2CE4D;color:#2a1a00;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px">Review in Systems → Applications</a></p>`;
  return layout(`New application: ${a.full_name}`, body, 'thep31collective.org · The P31 Collective by NEBA', 'THE PROVERBS 31 COLLECTIVE');
}

// ── Google Sheet ──────────────────────────────────────────────
// Keyed by the same questions as the Join form (and the original Google Form), so the
// Apps Script can match them to the sheet's column headings.
const sheetRow = (a: Application) => ({
  'Timestamp': eastern(a.created_at),
  'First and Last Name': a.full_name,
  'Name of your Business or Ministry': a.business_name || '',
  'Email Address': a.email,
  'Phone Number': a.phone,
  'City & State': a.city_state,
  'Birthday (Month / Day)': a.birthday,
  'Social Media Handle(s)': a.socials || '',
  'How did you find out about our community?': a.heard_from,
  'Briefly describe your business.': a.business_description || '',
  'What inspired you to join the P31 Collective?': a.inspiration || '',
  'What area are you hoping to grow in most? (Select your top 4)': (a.growth_areas || []).join(', '),
  'Once you begin membership, which of the following would you be interested in:': (a.interests || []).join(', '),
  'Agreement': a.agreed ? 'Agreed' : '',
  'Source': `Website (${a.source || 'join page'})`,
});

async function addToSheet(a: Application) {
  const res = await fetch(Deno.env.get('JOIN_SHEET_URL')!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: Deno.env.get('JOIN_SHEET_TOKEN') || '', row: sheetRow(a) }),
    redirect: 'follow',
  });
  const out = await res.text();
  if (!res.ok || !out.includes('"ok":true')) throw new Error(`Sheet said: ${out.slice(0, 200)}`);
}

// ── Claim, then hand off ──────────────────────────────────────
// The update only matches rows not yet handled, so two calls at once can't both take the same one.
async function claim(admin: ReturnType<typeof createClient>, column: 'notified_at' | 'sheet_synced_at') {
  const since = new Date(Date.now() - 2 * 864e5).toISOString();
  const { data, error } = await admin.from('collective_applications')
    .update({ [column]: new Date().toISOString() })
    .is(column, null).gte('created_at', since).select(FIELDS);
  if (error) throw new Error(error.message);
  return (data || []) as Application[];
}
const release = (admin: ReturnType<typeof createClient>, column: string, id: string) =>
  admin.from('collective_applications').update({ [column]: null }).eq('id', id);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const result = { ok: true, emailed: 0, sheet: 0, waiting: [] as string[] };

  // 1. Email (left waiting until Resend is set up, then they go out on the next call).
  if (emailConfigured()) {
    try {
      const to = (Deno.env.get('JOIN_NOTIFY_TO') || '').split(',').map((s) => s.trim()).filter(Boolean);
      const from = Deno.env.get('COLLECTIVE_EMAIL_FROM') || undefined;
      for (const a of await claim(admin, 'notified_at')) {
        const res = await sendEmail(to.length ? to : DEFAULT_TO, `New P31 Collective application: ${a.full_name}`, applicationEmail(a), a.email, from);
        if (res.ok) result.emailed += 1; else await release(admin, 'notified_at', a.id);
      }
    } catch (e) { console.error('join-notify email', e); }
  } else result.waiting.push('email');

  // 2. Google Sheet (left waiting until the sheet is connected).
  if (Deno.env.get('JOIN_SHEET_URL')) {
    try {
      for (const a of await claim(admin, 'sheet_synced_at')) {
        try { await addToSheet(a); result.sheet += 1; } catch (e) { console.error('join-notify sheet', e); await release(admin, 'sheet_synced_at', a.id); }
      }
    } catch (e) { console.error('join-notify sheet claim', e); }
  } else result.waiting.push('sheet');

  return json(result);
});
