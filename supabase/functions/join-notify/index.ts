// Supabase Edge Function: join-notify
// Public, but it can only do one thing: hand new applications to the team, each exactly once.
//   • "Join P31 Collective" (thep31collective.org/join) → email members@ + a row in P31's Google Sheet
//   • Vendor applications (p31market.com/apply)        → email the market team + a row in the vendor sheet
// Both pages call it right after someone applies; calling it again sends nothing new.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY, EMAIL_FROM            email (EMAIL_FROM is the marketplace sender)
//   COLLECTIVE_EMAIL_FROM                 optional sender for Collective emails
//   JOIN_NOTIFY_TO, VENDOR_NOTIFY_TO      optional comma lists; defaults below
//   JOIN_SHEET_URL, JOIN_SHEET_TOKEN      Apps Script web app for the Collective sheet (tools/google-sheet-intake.gs)
//   VENDOR_SHEET_URL                      Apps Script web app in the vendor sheet (same script); token defaults to JOIN_SHEET_TOKEN
//   VENDOR_SHEET_TAB                      or: the vendor tab's name, when vendors live in the Collective spreadsheet
// Deploy: supabase functions deploy join-notify --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, layout, esc, emailConfigured } from '../_shared/email.ts';

const env = (k: string) => Deno.env.get(k) || '';
const list = (k: string, fallback: string[]) => {
  const v = env(k).split(',').map((s) => s.trim()).filter(Boolean);
  return v.length ? v : fallback;
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;
const eastern = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
const easternDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: 'America/New_York' });

// ── Email pieces ──────────────────────────────────────────────
const tr = (label: string, value: string) =>
  `<tr><td style="padding:7px 12px 7px 0;color:#6E6580;font-size:13px;vertical-align:top;white-space:nowrap">${esc(label)}</td>`
  + `<td style="padding:7px 0;font-size:14px;color:#201431">${value}</td></tr>`;
const lines = (items: string[]) => (items?.length ? items.map((i) => esc(i)).join('<br>') : '<span style="color:#6E6580">—</span>');
const text = (v: string | null) => (v && String(v).trim() ? esc(v).replace(/\n/g, '<br>') : '<span style="color:#6E6580">—</span>');
const mail = (e: string) => `<a href="mailto:${esc(e)}" style="color:#5E2A8C">${esc(e)}</a>`;
const tel = (p: string) => `<a href="tel:${esc(String(p).replace(/[^\d+]/g, ''))}" style="color:#5E2A8C">${esc(p)}</a>`;
const button = (href: string, label: string) =>
  `<p style="margin:22px 0 0"><a href="${href}" style="display:inline-block;background:#F2CE4D;color:#2a1a00;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px">${esc(label)}</a></p>`;
const intro = (a: Row, what: string) =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${esc(a.full_name)} ${what} on ${esc(eastern(a.created_at))} (Eastern). Reply to this email to write back to them directly.</p>`;
const table = (rows: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #eee">${rows}</table>`;

// ── The two application types ─────────────────────────────────
type Flow = {
  name: string; table: string; fields: string;
  to: () => string[]; from: () => string | undefined;
  subject: (a: Row) => string; email: (a: Row) => string;
  sheet: () => { url: string; token: string; tab?: string } | null;
  sheetRow: (a: Row) => Row;
};

const FLOWS: Flow[] = [
  {
    name: 'collective',
    table: 'collective_applications',
    fields: 'id, full_name, business_name, email, phone, city_state, birthday, socials, heard_from, business_description, inspiration, growth_areas, interests, agreed, source, created_at',
    // founder@ is on the list for testing; change with JOIN_NOTIFY_TO.
    to: () => list('JOIN_NOTIFY_TO', ['members@thep31collective.org', 'founder@thep31collective.org']),
    from: () => env('COLLECTIVE_EMAIL_FROM') || undefined,
    subject: (a) => `New P31 Collective application: ${a.full_name}`,
    email: (a) => layout(`New application: ${a.full_name}`, intro(a, 'applied to join The P31 Collective') + table(
      tr('Name', esc(a.full_name)) + tr('Business or ministry', text(a.business_name)) + tr('Email', mail(a.email)) + tr('Phone', tel(a.phone))
      + tr('City / state', esc(a.city_state)) + tr('Birthday', esc(a.birthday)) + tr('Social media', text(a.socials))
      + tr('Found us through', esc(a.heard_from)) + tr('Their business', text(a.business_description))
      + tr('What inspired them', text(a.inspiration)) + tr('Hoping to grow in', lines(a.growth_areas)) + tr('Interested in', lines(a.interests)),
    ) + button('https://www.thep31collective.org/systems/applications', 'Review in Systems → Applications'),
    'thep31collective.org · The P31 Collective by NEBA', 'THE PROVERBS 31 COLLECTIVE'),
    sheet: () => (env('JOIN_SHEET_URL') ? { url: env('JOIN_SHEET_URL'), token: env('JOIN_SHEET_TOKEN'), tab: env('JOIN_SHEET_TAB') || undefined } : null),
    // Keyed by the Join form questions, so the Apps Script can match the sheet's headings.
    sheetRow: (a) => ({
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
    }),
  },
  {
    name: 'vendor',
    table: 'vendor_applications',
    fields: 'id, serious, full_name, business_name, email, phone, website_social, referred_by, categories, notes, agreed, source, created_at',
    // founder@ is on the list for testing; change with VENDOR_NOTIFY_TO.
    to: () => list('VENDOR_NOTIFY_TO', ['vendor@p31market.com', 'founder@thep31collective.org']),
    from: () => env('MARKET_EMAIL_FROM') || undefined,
    subject: (a) => `New vendor application: ${a.business_name} (${a.full_name})`,
    email: (a) => layout(`New vendor application: ${a.business_name}`, intro(a, `applied to vend at the Proverbs 31 Market for ${a.business_name}`) + table(
      tr('Name', esc(a.full_name)) + tr('Business / brand', esc(a.business_name)) + tr('Email', mail(a.email)) + tr('Phone', tel(a.phone))
      + tr('Website / social', text(a.website_social)) + tr('Sells or offers', lines(a.categories))
      + tr('Serious about joining', esc(a.serious)) + tr('Referred by', text(a.referred_by)) + tr('Anything else', text(a.notes)),
    ) + button('https://www.thep31collective.org/systems/vendors', 'Review in Systems → Vendor applications')),
    sheet: () => {
      const tab = env('VENDOR_SHEET_TAB');
      if (env('VENDOR_SHEET_URL')) return { url: env('VENDOR_SHEET_URL'), token: env('VENDOR_SHEET_TOKEN') || env('JOIN_SHEET_TOKEN'), tab: tab || undefined };
      if (tab && env('JOIN_SHEET_URL')) return { url: env('JOIN_SHEET_URL'), token: env('JOIN_SHEET_TOKEN'), tab };
      return null;
    },
    // Keyed by the Google Form questions (spelling included), so the Apps Script can match the sheet's headings.
    sheetRow: (a) => ({
      'Timestamp': eastern(a.created_at),
      'Are you a woman who is serious about joining and participating in this community?': a.serious,
      'Full Name': a.full_name,
      'Business / Brand Name': a.business_name,
      'Email Address': a.email,
      'Phone Number': a.phone,
      'Website/Social Media Handle': a.website_social,
      'If you were referred by another Vendor, please enter their first and last name here. (Optional)': a.referred_by || '',
      'What best describes what you sell or offer? (Choose up to 2 catergories)': (a.categories || []).join(', '),
      'Anything you’d like us to know?(Optional)': a.notes || '',
      'Agreement': a.agreed ? 'I Agree' : '',
      'Today’s Date': easternDate(a.created_at),
      'Source': `Website (${a.source || 'apply page'})`,
    }),
  },
];

async function addToSheet(target: { url: string; token: string; tab?: string }, row: Row) {
  const res = await fetch(target.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: target.token, tab: target.tab, row }),
    redirect: 'follow',
  });
  const out = await res.text();
  if (!res.ok || !out.includes('"ok":true')) throw new Error(`Sheet said: ${out.slice(0, 200)}`);
}

// Take the recent rows not yet handled. The update only matches rows still unhandled,
// so two calls at once can't both take (and send) the same one.
async function claim(admin: ReturnType<typeof createClient>, f: Flow, column: 'notified_at' | 'sheet_synced_at') {
  const since = new Date(Date.now() - 2 * 864e5).toISOString();
  const { data, error } = await admin.from(f.table)
    .update({ [column]: new Date().toISOString() })
    .is(column, null).gte('created_at', since).select(f.fields);
  if (error) throw new Error(error.message);
  return (data || []) as Row[];
}
const release = (admin: ReturnType<typeof createClient>, f: Flow, column: string, id: string) =>
  admin.from(f.table).update({ [column]: null }).eq('id', id);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const result: Row = { ok: true };

  for (const f of FLOWS) {
    const r = { emailed: 0, sheet: 0, waiting: [] as string[] };
    // Email (left waiting until Resend is set up; they go out on the next call).
    if (emailConfigured()) {
      try {
        for (const a of await claim(admin, f, 'notified_at')) {
          const res = await sendEmail(f.to(), f.subject(a), f.email(a), a.email, f.from());
          if (res.ok) r.emailed += 1; else await release(admin, f, 'notified_at', a.id);
        }
      } catch (e) { console.error(`join-notify ${f.name} email`, e); }
    } else r.waiting.push('email');

    // Google Sheet (left waiting until that sheet is connected).
    const target = f.sheet();
    if (target) {
      try {
        for (const a of await claim(admin, f, 'sheet_synced_at')) {
          try { await addToSheet(target, f.sheetRow(a)); r.sheet += 1; } catch (e) { console.error(`join-notify ${f.name} sheet`, e); await release(admin, f, 'sheet_synced_at', a.id); }
        }
      } catch (e) { console.error(`join-notify ${f.name} sheet claim`, e); }
    } else r.waiting.push('sheet');
    result[f.name] = r;
  }
  // Same top-level shape as before for the Collective, so earlier checks keep working.
  return json({ ...result, emailed: result.collective.emailed, sheet: result.collective.sheet, waiting: result.collective.waiting });
});
