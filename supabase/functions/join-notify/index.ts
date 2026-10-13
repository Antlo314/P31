// Supabase Edge Function: join-notify
// Public, but it can only do one thing: hand new form submissions to the team, each exactly once.
//   • "Join P31 Collective" (thep31collective.org/join)      → email members@ + a row in P31's Google Sheet
//   • Vendor applications (p31market.com/apply)             → email the market team + a row in the vendor sheet
//   • Storefront agreements (p31market.com/vendors/agreement) → email the market team + a signed copy to the vendor
//   • Market registrations (p31market.com/vendors/register) → email the market team + a confirmation to the vendor
//   • Vendor feedback surveys (p31market.com/vendors/feedback) → email the market team (+ a thank-you when an email was left)
//   • Volunteer acknowledgments (p31market.com/volunteer)   → email outreach@ + a copy to the volunteer
//   • Survey invitations (v38): businesses that said "I'm in for the next market" get invited when a market announces its date
//   • Mentorship intro-call requests (v43)                   → email members@ + a copy to the person
// Every team email also goes to ceo@p31market.com, and every person who submits gets their copy
// with a PDF of what they sent attached (the team email carries the same PDF).
// Every page calls it right after someone submits, and the scheduler calls it every 10 minutes (v38),
// so nothing waits on a visitor's browser. Calling it again sends nothing new.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY, EMAIL_FROM            email (EMAIL_FROM is the marketplace sender)
//   COLLECTIVE_EMAIL_FROM                 optional sender for Collective emails
//   MARKET_EMAIL_FROM                     optional sender for marketplace emails
//   JOIN_NOTIFY_TO, VENDOR_NOTIFY_TO, VOLUNTEER_NOTIFY_TO, FEEDBACK_NOTIFY_TO   optional comma lists; defaults below
//   JOIN_SHEET_URL, JOIN_SHEET_TOKEN      Apps Script web app for the Collective sheet (tools/google-sheet-intake.gs)
//   VENDOR_SHEET_URL                      Apps Script web app in the vendor sheet (same script); token defaults to JOIN_SHEET_TOKEN
//   VENDOR_SHEET_TAB                      or: the vendor tab's name, when vendors live in the Collective spreadsheet
// Deploy: supabase functions deploy join-notify --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendEmail, layout, esc, emailConfigured } from '../_shared/email.ts';
import { formPdf, toBase64, type PdfSpec } from '../_shared/form-pdf.ts';

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
const longDate = (d: string) => new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const SYSTEMS = 'https://www.thep31collective.org/systems';
const MARKET = 'https://www.p31market.com';
const MARKET_FOOT = 'p31market.com · Where her gifts make room.';
const VENDOR_EMAIL = 'vendor@p31market.com';
const OUTREACH_EMAIL = 'outreach@p31market.com';
const MEMBERS_EMAIL = 'members@thep31collective.org';
const CEO_EMAIL = 'ceo@p31market.com';
const COLLECTIVE_FOOT = 'thep31collective.org · The P31 Collective by NEBA';
const withCeo = (to: string[]) => [...new Set([...to, CEO_EMAIL])];

// The words people agree to, shared by their email copy and their PDF copy.
const AGREEMENT_BENEFITS = [
  'A direct storefront link to promote and share your business site',
  'Ability to list and sell up to 10 products and/or services.',
  'Increased visibility through Proverbs 31 Marketplace marketing efforts, including organic traffic and SEO optimization to help drive discovery of your storefront.',
  'Ongoing promotional exposure through targeted campaigns on platforms such as Google, Meta (Facebook/Instagram), and social media to expand your reach and brand awareness.',
  'Access to a community chat with other Proverbs 31 women creatives',
  'Web technical support for your storefront',
  'A professional, uniform storefront layout with customizable product listings',
];
const AGREEMENT_DUTIES = [
  'Collect, report, and remit any applicable sales tax related to your sales through Proverbs 31 Marketplace',
  'Manage your own shipping and handling',
  'Create and maintain your own refund and exchange policies',
  'Provide customers with a direct method of contact',
  'Manage your product listings once your storefront is set up',
];
const AGREEMENT_TERMS = [
  'My storefront is 100% complimentary for 3 months from date of activation',
  'Proverbs 31 Marketplace will deduct a 5% transaction fee from each sale',
  'After the complimentary period, I will have the option to continue my storefront for a $14.99 monthly platform fee. At that time, I will receive a subscription link to enroll if I choose to keep my storefront active. The 5% transaction fee per order will remain applicable.',
  'I may cancel my storefront subscription at any time with a minimum 2-week notice',
];
const MARKET_RULES = [
  'Arrive and check in no later than 3:15 PM. Late arrivals will not be permitted to set up.',
  'Bring your own 6-foot table and a covering that sweeps the ground (an 8-foot table and skirt are provided for Package A only). One table per vendor space, a maximum of two chairs, and one assistant.',
  'It is an indoor event: no tents or canopies. Keep storage hidden beneath the table and remove carts after setup.',
  'No cooking at your booth; consumables must be sealed in closed-lid containers or fully packaged, with no open samples.',
  'You handle your own payment processing and sales tax. Please do not break down before the official closing time.',
  'Vendor fees are non-refundable and non-transferable, including cancellations, no-shows and late arrivals.',
  'In an emergency on the day, call the P31 Market Team at 470-562-2852.',
];
const VOLUNTEER_ACKS = [
  'I will assist with tasks as assigned by the event organizer and report any issues directly to them.',
  'I may be photographed or recorded by official event photographers/videographers.',
  'I will conduct myself respectfully and follow all safety guidelines while on-site.',
  'I understand that Proverbs 31 Marketplace is not responsible for personal injury or loss of personal belongings.',
  'I understand that any information discussed in team meetings, or otherwise made known to me, as well as any materials provided to me, belong to Proverbs 31 Marketplace Company, and its owner, and cannot be shared publicly.',
];
const plainAddress = (a: Row) => { const x = a.address || {}; return [x.street, x.line2, [x.city, x.state, x.zip].filter(Boolean).join(', '), x.country].filter(Boolean).join(', '); };
const stars5 = (n: number | null) => (n ? `${n} of 5` : '');
const join = (v: string[] | null) => (v || []).join(', ');

// ── Email pieces ──────────────────────────────────────────────
const tr = (label: string, value: string) =>
  `<tr><td style="padding:7px 12px 7px 0;color:#74657A;font-size:13px;vertical-align:top;white-space:nowrap">${esc(label)}</td>`
  + `<td style="padding:7px 0;font-size:14px;color:#2A1526">${value}</td></tr>`;
const lines = (items: string[]) => (items?.length ? items.map((i) => esc(i)).join('<br>') : '<span style="color:#74657A">—</span>');
const text = (v: string | null) => (v && String(v).trim() ? esc(v).replace(/\n/g, '<br>') : '<span style="color:#74657A">—</span>');
const mail = (e: string) => `<a href="mailto:${esc(e)}" style="color:#3A1C36">${esc(e)}</a>`;
const tel = (p: string) => `<a href="tel:${esc(String(p).replace(/[^\d+]/g, ''))}" style="color:#3A1C36">${esc(p)}</a>`;
const link = (href: string, label?: string) => `<a href="${esc(href)}" style="color:#3A1C36">${esc(label || href)}</a>`;
const button = (href: string, label: string) =>
  `<p style="margin:22px 0 0"><a href="${href}" style="display:inline-block;background:#F2CE4D;color:#2a1a00;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px">${esc(label)}</a></p>`;
const fullName = (a: Row) => a.full_name || [a.first_name, a.last_name].filter(Boolean).join(' ') || a.business_name || 'Someone';
const intro = (a: Row, what: string) =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.5">${esc(fullName(a))} ${what} on ${esc(eastern(a.created_at))} (Eastern).${a.email ? ' Reply to this email to write back to them directly.' : ''}</p>`;
const table = (rows: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #eee">${rows}</table>`;
const bullets = (items: string[]) => `<ul style="margin:6px 0 14px;padding-left:20px;line-height:1.55">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
const stars = (n: number | null) => (n ? `${'★'.repeat(n)}${'☆'.repeat(5 - n)} <span style="color:#74657A">(${n}/5)</span>` : '<span style="color:#74657A">—</span>');
const address = (a: Row) => {
  const x = a.address || {};
  return lines([x.street, x.line2, [x.city, x.state, x.zip].filter(Boolean).join(', '), x.country].filter(Boolean));
};
const AGAIN: Record<string, string> = { in: 'I’m in for the next market!', waitlist: 'Keep me on the waitlist for the future events.', no: 'No thank you P31 is not the right fit for me.' };

// ── The form types ────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
type Admin = any; // the service-role client (typed loosely: the generated schema types are not used here)
type Flow = {
  name: string; table: string; fields: string;
  to: (a: Row) => string[]; from: () => string | undefined;
  subject: (a: Row) => string; email: (a: Row) => string;
  /** Who a reply goes to (default: the person on the row). */
  replyTo?: (a: Row) => string | undefined;
  /** Only rows that match (e.g. survey invitations, not every lineup row). */
  // deno-lint-ignore no-explicit-any
  scope?: (q: any) => any;
  /** Look up what the emails need beyond the row itself. */
  enrich?: (admin: Admin, a: Row) => Promise<Row>;
  /** After the emails went out. */
  after?: (admin: Admin, a: Row) => Promise<unknown>;
  /** A copy for the person who submitted (their email is on the row). */
  confirm?: (a: Row) => { subject: string; html: string; replyTo: string } | null;
  /** The PDF copy of what they sent (attached to their copy and to the team email). */
  pdf?: (a: Row) => PdfSpec;
  /** Not a team email (the invitation goes to a vendor): no CEO copy. */
  external?: boolean;
  sheet: () => { url: string; token: string; tab?: string } | null;
  sheetRow: (a: Row) => Row;
};

const marketTeam = () => list('VENDOR_NOTIFY_TO', [VENDOR_EMAIL, 'founder@thep31collective.org']);
const marketFrom = () => env('MARKET_EMAIL_FROM') || undefined;

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
    ) + button(`${SYSTEMS}/applications`, 'Review in Systems → Applications'),
    COLLECTIVE_FOOT, 'THE PROVERBS 31 COLLECTIVE'),
    confirm: (a) => ({
      replyTo: MEMBERS_EMAIL,
      subject: 'We received your P31 Collective application',
      html: layout('Thank you for applying', `<p>Hi ${esc(String(a.full_name).split(' ')[0])},</p>
<p>Thank you for applying to join The P31 Collective. Your application is in, and a copy of everything you sent is attached as a PDF.</p>
<p>Our team reviews every application personally and will be in touch by email with next steps.</p>
<p>Questions? Reply to this email or write to ${mail(MEMBERS_EMAIL)}.</p>`, COLLECTIVE_FOOT, 'THE PROVERBS 31 COLLECTIVE'),
    }),
    pdf: (a) => ({
      brand: 'collective', title: 'Join P31 Collective application', submittedAt: a.created_at, reference: a.id,
      sections: [
        { heading: 'Your details', rows: [['Name', a.full_name], ['Business or ministry', a.business_name], ['Email', a.email], ['Phone', a.phone], ['City and state', a.city_state], ['Birthday', a.birthday], ['Social media', a.socials]] },
        { heading: 'Your answers', rows: [['How you found us', a.heard_from], ['Your business', a.business_description], ['What inspired you to join', a.inspiration], ['Hoping to grow in', join(a.growth_areas)], ['Interested in', join(a.interests)], ['Membership terms', a.agreed ? 'Agreed' : 'Not agreed']] },
      ],
    }),
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
    to: marketTeam,
    from: marketFrom,
    subject: (a) => `New vendor application: ${a.business_name} (${a.full_name})`,
    email: (a) => layout(`New vendor application: ${a.business_name}`, intro(a, `applied to vend at the Proverbs 31 Market for ${a.business_name}`) + table(
      tr('Name', esc(a.full_name)) + tr('Business / brand', esc(a.business_name)) + tr('Email', mail(a.email)) + tr('Phone', tel(a.phone))
      + tr('Website / social', text(a.website_social)) + tr('Sells or offers', lines(a.categories))
      + tr('Serious about joining', esc(a.serious)) + tr('Referred by', text(a.referred_by)) + tr('Anything else', text(a.notes)),
    ) + button(`${SYSTEMS}/vendors`, 'Review in Systems → Vendor applications')),
    confirm: (a) => ({
      replyTo: VENDOR_EMAIL,
      subject: `We received your vendor application: ${a.business_name}`,
      html: layout('Thank you for applying to vend', `<p>Hi ${esc(String(a.full_name).split(' ')[0])},</p>
<p>Thank you for applying to vend with Proverbs 31 Marketplace for <b>${esc(a.business_name)}</b>. Your application is in, and a copy of everything you sent is attached as a PDF.</p>
<p>The market team reviews every application and will email you with a decision and, if approved, your next steps.</p>
<p>Questions? Reply to this email or write to ${mail(VENDOR_EMAIL)}.</p>`, MARKET_FOOT),
    }),
    pdf: (a) => ({
      brand: 'market', title: 'Vendor application', submittedAt: a.created_at, reference: a.id,
      sections: [
        { heading: 'Your details', rows: [['Name', a.full_name], ['Business or brand', a.business_name], ['Email', a.email], ['Phone', a.phone], ['Website or social media', a.website_social]] },
        { heading: 'Your answers', rows: [['Serious about joining and participating', a.serious], ['What you sell or offer', join(a.categories)], ['Referred by', a.referred_by], ['Anything else', a.notes], ['Vendor terms', a.agreed ? 'Agreed' : 'Not agreed']] },
      ],
    }),
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

  // ── The forms that replaced JotForm (v37) ──
  {
    name: 'agreement',
    table: 'vendor_agreements',
    fields: 'id, business_name, first_name, last_name, email, phone, address, signature, signed_name, signed_on, terms_version, curator_id, source, created_at',
    to: marketTeam,
    from: marketFrom,
    subject: (a) => `Storefront agreement signed: ${a.business_name} (${fullName(a)})`,
    email: (a) => layout(`Storefront agreement: ${a.business_name}`, intro(a, `signed the Proverbs 31 Marketplace Storefront Agreement for ${a.business_name}`) + table(
      tr('Business', esc(a.business_name)) + tr('Contact', esc(fullName(a))) + tr('Email', mail(a.email)) + tr('Phone', tel(a.phone))
      + tr('Business address', address(a)) + tr('Signed as', esc(a.signed_name)) + tr('Date signed', esc(longDate(a.signed_on))) + tr('Terms version', esc(a.terms_version))
      + tr('Curator account', a.curator_id ? '<span style="color:#374126">Already has one: her storefront is linked</span>'
      : a.preapproved ? '<span style="color:#374126">Already approved: the link to create her account went out with her copy</span>'
        : 'None yet: pre-approve and send the account link from Systems'),
    ) + (a.curator_id || a.preapproved ? '' : `<p style="margin:16px 0 0;font-size:13px;color:#74657A">She was told she will receive a link to create her account within 7–10 days.</p>`)
      + button(`${SYSTEMS}/forms?tab=agreements`, 'Open in Systems → Vendor forms')),
    confirm: (a) => ({
      replyTo: VENDOR_EMAIL,
      subject: `Your Proverbs 31 Marketplace Storefront Agreement: ${a.business_name}`,
      html: layout('Your storefront agreement', `<p>Hi ${esc(a.first_name)},</p>
<p>Thank you for completing the Proverbs 31 Marketplace Storefront Agreement for <b>${esc(a.business_name)}</b> on ${esc(longDate(a.signed_on))}, signed as <b>${esc(a.signed_name)}</b>. This is your copy of what you agreed to.</p>
<p style="margin:14px 0 4px"><b>P31 Storefront Benefits</b></p>${bullets(AGREEMENT_BENEFITS)}
<p style="margin:14px 0 4px"><b>Vendor Responsibilities</b></p>${bullets(AGREEMENT_DUTIES)}
<p style="margin:14px 0 4px"><b>Terms & Subscription Agreement</b></p>${bullets(AGREEMENT_TERMS)}
<p>A PDF copy of your signed agreement is attached.</p>
<p>The full agreement, including liability, termination, legal compliance and food-product terms, is at ${link(`${MARKET}/vendors/agreement`, 'p31market.com/vendors/agreement')}.</p>
<p><b>What happens next.</b> ${a.curator_id
          ? `You already have a curator account with this email, so your storefront agreement is now on file. Sign in at ${link(`${MARKET}/login`, 'p31market.com/login')}.`
          : a.preapproved
            ? `You are already approved, so there is no wait: create your curator account at ${link(`${MARKET}/register`, 'p31market.com/register')} using this same email (<b>${esc(a.email)}</b>) and your studio opens straight away.`
            : `Within 7–10 days you will receive a link to create your account and set up your storefront. Use this same email (<b>${esc(a.email)}</b>) when you register.`}</p>
<p>Questions? Reply to this email or write to ${mail(VENDOR_EMAIL)}.</p>`, MARKET_FOOT),
    }),
    pdf: (a) => ({
      brand: 'market', title: 'Proverbs 31 Marketplace Storefront Agreement', submittedAt: a.created_at, reference: a.id,
      sections: [
        { heading: 'Business and contact', rows: [['Business', a.business_name], ['Contact', fullName(a)], ['Email', a.email], ['Phone', a.phone], ['Business address', plainAddress(a)], ['Terms version', a.terms_version]] },
        { heading: 'P31 Storefront Benefits', bullets: AGREEMENT_BENEFITS },
        { heading: 'Vendor Responsibilities', bullets: AGREEMENT_DUTIES },
        { heading: 'Terms & Subscription Agreement', bullets: AGREEMENT_TERMS },
        { paragraph: `The full agreement, including liability, termination, legal compliance and food-product terms, is at ${MARKET}/vendors/agreement.` },
      ],
      signature: a.signature, signedName: a.signed_name, signedOn: a.signed_on,
    }),
    // Approved through the vendor application already (v35 pre-approval)? Then the account link goes out now.
    enrich: async (admin, a) => {
      if (a.curator_id) return a;
      const { data } = await admin.from('vendor_approvals').select('id').ilike('email', a.email).limit(1);
      return { ...a, preapproved: !!data?.length };
    },
    after: async (admin, a) => {
      if (a.preapproved && !a.curator_id) {
        await admin.from('vendor_agreements')
          .update({ status: 'account_sent', review_notes: `${new Date().toLocaleDateString('en-US')}: account link sent automatically (already approved)` })
          .eq('id', a.id).eq('status', 'new');
      }
    },
    sheet: () => null,
    sheetRow: (a) => ({ 'Timestamp': eastern(a.created_at), 'Business Name': a.business_name, 'Contact': fullName(a), 'Email': a.email, 'Phone': a.phone }),
  },
  {
    name: 'registration',
    table: 'vendor_registrations',
    fields: 'id, event_id, event_label, business_name, first_name, last_name, email, phone, website, social, products, logo_url, signature, signed_name, signed_on, source, created_at',
    to: marketTeam,
    from: marketFrom,
    subject: (a) => `Market registration: ${a.business_name} for ${a.event_label}`,
    email: (a) => layout(`Market registration: ${a.business_name}`, intro(a, `registered ${a.business_name} for ${a.event_label} and signed the Vendor Rules & Regulations`) + table(
      tr('Event', esc(a.event_label)) + tr('Business', esc(a.business_name)) + tr('Contact', esc(fullName(a))) + tr('Email', mail(a.email)) + tr('Phone', tel(a.phone))
      + tr('Website', text(a.website)) + tr('Social media', text(a.social)) + tr('Products or services', text(a.products))
      + tr('Logo', a.logo_url ? link(a.logo_url, 'Open the logo') : '<span style="color:#74657A">Not uploaded</span>')
      + tr('Signed as', esc(a.signed_name)) + tr('Date', esc(longDate(a.signed_on))),
    ) + button(`${SYSTEMS}/forms?tab=registrations`, 'Confirm and add to the lineup in Systems')),
    confirm: (a) => ({
      replyTo: VENDOR_EMAIL,
      subject: `We received your registration: ${a.business_name} for ${a.event_label}`,
      html: layout('Your market registration is in', `<p>Hi ${esc(a.first_name)},</p>
<p>Thank you for registering <b>${esc(a.business_name)}</b> for the P31 Marketplace, <b>${esc(a.event_label)}</b>, and for signing the Vendor Rules & Regulations on ${esc(longDate(a.signed_on))}.</p>
<p>The market team will confirm your space and send booth placement, load-in time and payment details by email.</p>
<p style="margin:14px 0 4px"><b>A few reminders for market day</b></p>${bullets(MARKET_RULES)}
<p>A PDF copy of your registration is attached.</p>
<p>The full rules are at ${link(`${MARKET}/vendors/register`, 'p31market.com/vendors/register')}. Questions? Reply to this email or write to ${mail(VENDOR_EMAIL)}.</p>`, MARKET_FOOT),
    }),
    sheet: () => null,
    pdf: (a) => ({
      brand: 'market', title: `Market registration: ${a.event_label}`, submittedAt: a.created_at, reference: a.id,
      sections: [
        { heading: 'Your registration', rows: [['Event', a.event_label], ['Business', a.business_name], ['Contact', fullName(a)], ['Email', a.email], ['Phone', a.phone], ['Website', a.website], ['Social media', a.social], ['Products or services', a.products], ['Logo', a.logo_url ? 'Uploaded' : 'Not uploaded']] },
        { heading: 'Market-day reminders', bullets: MARKET_RULES },
        { paragraph: `You signed the Vendor Rules & Regulations. The full rules are at ${MARKET}/vendors/register.` },
      ],
      signature: a.signature, signedName: a.signed_name, signedOn: a.signed_on,
    }),
    sheetRow: (a) => ({ 'Timestamp': eastern(a.created_at), 'Event': a.event_label, 'Business Name': a.business_name, 'Contact': fullName(a), 'Email': a.email, 'Phone': a.phone }),
  },
  {
    name: 'feedback',
    table: 'vendor_feedback',
    fields: 'id, market_label, business_name, email, overall, venue, dj, organization, sales, again, enjoyed, improve, comments, source, created_at',
    to: () => list('FEEDBACK_NOTIFY_TO', marketTeam()),
    from: marketFrom,
    subject: (a) => `Vendor feedback: ${a.business_name} on ${a.market_label} (${a.overall}/5)`,
    email: (a) => layout(`Vendor feedback: ${a.business_name}`, intro(a, `sent feedback on ${a.market_label}`) + table(
      tr('Market', esc(a.market_label)) + tr('Business', esc(a.business_name)) + (a.email ? tr('Email', mail(a.email)) : '')
      + tr('Overall experience', stars(a.overall)) + tr('Venue and atmosphere', stars(a.venue)) + tr('DJ and sounds', stars(a.dj)) + tr('Organization, host and team', stars(a.organization))
      + tr('Sales vs. traffic', esc(a.sales)) + tr('Vending again', esc(AGAIN[a.again] || a.again))
      + tr('Enjoyed most', text(a.enjoyed)) + tr('Could improve', text(a.improve)) + tr('Comments', text(a.comments)),
    ) + button(`${SYSTEMS}/forms?tab=feedback`, 'See every survey in Systems')),
    confirm: (a) => (a.email ? {
      replyTo: VENDOR_EMAIL,
      subject: `Thank you for your feedback on ${a.market_label}`,
      html: layout('Thank you for your honest feedback', `<p>Thank you for taking the time to tell us how <b>${esc(a.market_label)}</b> went for <b>${esc(a.business_name)}</b>. We read every survey and use it to shape the next market.</p>
${a.again === 'in' ? `<p>You said you are in for the next market. The team will reach out as the next date is set.</p>` : a.again === 'waitlist' ? `<p>You asked to stay on the waitlist for future events. We will keep you posted.</p>` : ''}
<p>A PDF copy of your answers is attached. Questions or anything else to add? Reply to this email or write to ${mail(VENDOR_EMAIL)}.</p>`, MARKET_FOOT),
    } : null),
    pdf: (a) => ({
      brand: 'market', title: `Vendor feedback survey: ${a.market_label}`, submittedAt: a.created_at, reference: a.id,
      sections: [
        { heading: 'About you', rows: [['Market', a.market_label], ['Business', a.business_name], ['Email', a.email]] },
        { heading: 'Your ratings', rows: [['Overall experience', stars5(a.overall)], ['Venue and atmosphere', stars5(a.venue)], ['DJ and sounds', stars5(a.dj)], ['Organization, host and team', stars5(a.organization)], ['Sales vs. traffic', a.sales]] },
        { heading: 'Your answers', rows: [['Vending with P31 again', AGAIN[a.again] || a.again], ['Enjoyed most', a.enjoyed], ['Could improve', a.improve], ['Additional comments', a.comments]] },
      ],
    }),
    sheet: () => null,
    sheetRow: (a) => ({ 'Timestamp': eastern(a.created_at), 'Market': a.market_label, 'Business Name': a.business_name, 'Overall': a.overall }),
  },
  {
    name: 'volunteer',
    table: 'volunteer_signups',
    fields: 'id, event_id, first_name, last_name, phone, email, emergency_contact, signature, signed_name, signed_on, source, created_at',
    to: () => list('VOLUNTEER_NOTIFY_TO', [OUTREACH_EMAIL, 'founder@thep31collective.org']),
    from: marketFrom,
    subject: (a) => `New volunteer: ${fullName(a)}`,
    email: (a) => layout(`New volunteer: ${fullName(a)}`, intro(a, 'signed the Volunteer Day-of-Event Acknowledgment') + table(
      tr('Name', esc(fullName(a))) + tr('Email', mail(a.email)) + tr('Phone', tel(a.phone)) + tr('Emergency contact', text(a.emergency_contact))
      + tr('Signed as', esc(a.signed_name)) + tr('Date', esc(longDate(a.signed_on))),
    ) + button(`${SYSTEMS}/forms?tab=volunteers`, 'Open in Systems → Vendor forms')),
    confirm: (a) => ({
      replyTo: OUTREACH_EMAIL,
      subject: 'Thank you for volunteering with Proverbs 31 Marketplace',
      html: layout('Thank you for serving with us', `<p>Hi ${esc(a.first_name)},</p>
<p>Thank you for signing the Volunteer Day-of-Event Acknowledgment on ${esc(longDate(a.signed_on))}. The market team will reach out with your assignment and arrival time.</p>
<p style="margin:14px 0 4px"><b>What you acknowledged</b></p>${bullets(VOLUNTEER_ACKS)}
<p>A PDF copy of your signed acknowledgment is attached.</p>
<p>Emergency contact on file: ${esc(a.emergency_contact)}. If anything changes, reply to this email or write to ${mail(OUTREACH_EMAIL)}.</p>`, MARKET_FOOT),
    }),
    sheet: () => null,
    pdf: (a) => ({
      brand: 'market', title: 'Volunteer Day-of-Event Acknowledgment', submittedAt: a.created_at, reference: a.id,
      sections: [
        { heading: 'Your details', rows: [['Name', fullName(a)], ['Email', a.email], ['Phone', a.phone], ['Emergency contact', a.emergency_contact]] },
        { heading: 'What you acknowledged', bullets: VOLUNTEER_ACKS },
      ],
      signature: a.signature, signedName: a.signed_name, signedOn: a.signed_on,
    }),
    sheetRow: (a) => ({ 'Timestamp': eastern(a.created_at), 'Name': fullName(a), 'Email': a.email, 'Phone': a.phone }),
  },
  // Mentorship intro-call requests (thep31collective.org/mentorship): v43 gives the table notified_at.
  {
    name: 'introcall',
    table: 'academy_inquiries',
    fields: 'id, program_id, full_name, email, phone, message, preferred_times, created_at',
    to: () => list('INTRO_NOTIFY_TO', [MEMBERS_EMAIL, 'founder@thep31collective.org']),
    from: () => env('COLLECTIVE_EMAIL_FROM') || undefined,
    enrich: async (admin, a) => {
      const { data } = a.program_id ? await admin.from('academy_programs').select('title, slug').eq('id', a.program_id).maybeSingle() : { data: null };
      return { ...a, program: data?.title || 'Mentorship', slug: data?.slug || 'business' };
    },
    subject: (a) => `Intro call request: ${a.full_name} (${a.program})`,
    email: (a) => layout(`Intro call request: ${a.full_name}`, intro(a, `asked for an intro call about the ${a.program}`) + table(
      tr('Name', esc(a.full_name)) + tr('Program', esc(a.program)) + tr('Email', mail(a.email)) + (a.phone ? tr('Phone', tel(a.phone)) : '')
      + tr('Best times', text(a.preferred_times)) + tr('Message', text(a.message)),
    ) + button(`https://www.thep31collective.org/academy/${a.slug}/teach/calls`, 'Open in the mentor console'), COLLECTIVE_FOOT, 'THE PROVERBS 31 COLLECTIVE'),
    confirm: (a) => ({
      replyTo: MEMBERS_EMAIL,
      subject: `We received your intro call request: ${a.program}`,
      html: layout('Thank you for reaching out', `<p>Hi ${esc(String(a.full_name).split(' ')[0])},</p>
<p>Thank you for asking about the <b>${esc(a.program)}</b>. Your request is in, and a copy is attached as a PDF.</p>
<p>A mentor will reach out to set a time for your intro call${a.preferred_times ? ', keeping your best times in mind' : ''}.</p>
<p>Questions? Reply to this email or write to ${mail(MEMBERS_EMAIL)}.</p>`, COLLECTIVE_FOOT, 'THE PROVERBS 31 COLLECTIVE'),
    }),
    pdf: (a) => ({
      brand: 'collective', title: `Intro call request: ${a.program}`, submittedAt: a.created_at, reference: a.id,
      sections: [{ heading: 'Your request', rows: [['Name', a.full_name], ['Program', a.program], ['Email', a.email], ['Phone', a.phone], ['Best times', a.preferred_times], ['Message', a.message]] }],
    }),
    sheet: () => null,
    sheetRow: (a) => ({ 'Timestamp': eastern(a.created_at), 'Name': a.full_name, 'Email': a.email }),
  },
];

// Survey invitations: v38 adds them to a lineup when a vendor market announces its date.
FLOWS.push({
  name: 'invite',
  external: true,
  table: 'event_vendors',
  fields: 'id, event_id, business_name, email, created_at',
  scope: (q) => q.eq('source', 'feedback').not('email', 'is', null),
  to: (a) => [a.email],
  replyTo: () => VENDOR_EMAIL,
  from: marketFrom,
  enrich: async (admin, a) => {
    const { data } = await admin.from('market_events').select('title, event_date, start_time, venue, address, load_in').eq('id', a.event_id).maybeSingle();
    return { ...a, ev: data || {} };
  },
  subject: (a) => `You're invited: ${a.ev.title || 'the next Proverbs 31 Market'}`,
  email: (a) => layout('You said you were in. Here is your invitation.', `<p>Hi ${esc(a.business_name)},</p>
<p>After the last market you told us you were in for the next one. It is here: <b>${esc(a.ev.title || 'the next Proverbs 31 Market')}</b>${a.ev.event_date ? `, ${esc(longDate(a.ev.event_date))}` : ''}${a.ev.start_time ? ` at ${esc(a.ev.start_time)}` : ''}${a.ev.venue ? `, ${esc(a.ev.venue)}` : ''}.</p>
<p>Your business is on the invitation list. To reserve your space, complete the market registration and sign the Vendor Rules &amp; Regulations (have your logo handy):</p>
${button(`${MARKET}/vendors/register`, 'Register for this market')}
<p style="margin-top:18px">${a.ev.load_in ? `Vendors check in by ${esc(a.ev.load_in)} on the day. ` : ''}Booth placement and payment details follow once you are confirmed. Questions? Reply to this email.</p>`, MARKET_FOOT),
  sheet: () => null,
  sheetRow: (a) => ({ 'Business Name': a.business_name }),
});

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
async function claim(admin: Admin, f: Flow, column: 'notified_at' | 'sheet_synced_at') {
  const since = new Date(Date.now() - 2 * 864e5).toISOString();
  let q = admin.from(f.table)
    .update({ [column]: new Date().toISOString() })
    .is(column, null).gte('created_at', since);
  if (f.scope) q = f.scope(q);
  const { data, error } = await q.select(f.fields);
  if (error) throw new Error(error.message);
  return (data || []) as Row[];
}
const release = (admin: Admin, f: Flow, column: string, id: string) =>
  admin.from(f.table).update({ [column]: null }).eq('id', id);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const result: Row = { ok: true };

  for (const f of FLOWS) {
    const r = { emailed: 0, confirmed: 0, sheet: 0, waiting: [] as string[] };
    // Email (left waiting until Resend is set up; they go out on the next call).
    if (emailConfigured()) {
      try {
        for (const raw of await claim(admin, f, 'notified_at')) {
          const a = f.enrich ? await f.enrich(admin, raw).catch(() => raw) : raw;
          // The PDF copy of what they sent: best effort (the emails still go if it cannot be made).
          let files: { filename: string; content: string }[] | undefined;
          if (f.pdf) {
            try {
              const spec = f.pdf(a);
              const slug = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
              files = [{ filename: `${slug}-${String(a.id).slice(0, 8)}.pdf`, content: toBase64(await formPdf(spec)) }];
            } catch (e) { console.error(`join-notify ${f.name} pdf`, e); }
          }
          const to = f.external ? f.to(a) : withCeo(f.to(a));
          const res = await sendEmail(to, f.subject(a), f.email(a), (f.replyTo ? f.replyTo(a) : a.email) || undefined, f.from(), files);
          if (!res.ok) { await release(admin, f, 'notified_at', a.id); continue; }
          r.emailed += 1;
          if (f.after) await f.after(admin, a).catch((e) => console.error(`join-notify ${f.name} after`, e));
          // Their copy, with the PDF: best effort, never blocks the team email.
          const c = f.confirm?.(a);
          if (c && a.email) {
            try { const sent = await sendEmail(a.email, c.subject, c.html, c.replyTo, f.from(), files); if (sent.ok) r.confirmed += 1; } catch (e) { console.error(`join-notify ${f.name} confirm`, e); }
          }
        }
      } catch (e) {
        // A table that does not exist yet (migration not run) is not an error worth retrying.
        if (!/does not exist|schema cache/.test(String(e))) console.error(`join-notify ${f.name} email`, e);
      }
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
