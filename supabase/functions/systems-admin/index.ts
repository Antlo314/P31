// Supabase Edge Function: systems-admin
// 1. Lets a Systems *owner* set a teammate's password (Systems → Settings).
//    Everyone can already change their own password from the browser.
// 2. Login help for admins (Systems → Team): look up whether someone has an account, email
//    them an invite or a password reset. Works for anyone: team, mentee, vendor.
//    The link is emailed by the site itself (not Supabase's templates, whose Site URL may point
//    elsewhere) and never sent back to the browser.
// Deploy: supabase functions deploy systems-admin
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';
import { sendEmail, emailConfigured, layout, esc } from '../_shared/email.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
// Business errors come back as 200 + { error } so the page can show them.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const MIN_PASSWORD = 8;
const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Only the Collective's /portal handles a password-recovery link (it asks for the new password),
// so every link lands there whichever site the person uses.
const PORTAL = 'https://www.thep31collective.org/portal';
type Site = 'market' | 'collective';
const SITE: Record<Site, { brand: string; name: string; home: string; signIn: string; footer: string; from: () => string | undefined }> = {
  collective: {
    brand: 'THE PROVERBS 31 COLLECTIVE',
    name: 'The P31 Collective',
    home: 'thep31collective.org',
    signIn: `${PORTAL}`,
    footer: 'thep31collective.org · The P31 Collective by NEBA',
    from: () => Deno.env.get('COLLECTIVE_EMAIL_FROM') || undefined,
  },
  market: {
    brand: 'PROVERBS 31 MARKETPLACE',
    name: 'the Proverbs 31 Marketplace',
    home: 'p31market.com',
    signIn: 'https://www.p31market.com/login',
    footer: '',
    from: () => undefined,
  },
};

const button = (href: string, label: string) =>
  `<p style="margin:22px 0 0"><a href="${href}" style="display:inline-block;background:#F2CE4D;color:#2a1a00;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:999px">${esc(label)}</a></p>`;

// supabase-js has no lookup by email, so page through the users (a small user base).
async function findUser(admin: SupabaseClient, email: string): Promise<User | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const hit = (data.users as User[]).find((u: User) => (u.email || '').toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: userData } = await admin.auth.getUser(token);
    const caller = userData?.user;
    if (!caller) return json({ error: 'Sign in to Systems first.' }, 401);

    // deno-lint-ignore no-explicit-any
    let body: any = {};
    try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
    const { action } = body;

    if (action === 'reset-password') {
      const { userId, password } = body;
      const { data: me } = await admin
        .from('system_operators')
        .select('role')
        .eq('user_id', caller.id)
        .maybeSingle();
      if (me?.role !== 'owner') return json({ error: 'Only a Systems owner can do that.' });
      if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
        return json({ error: `Use at least ${MIN_PASSWORD} characters.` });
      }
      // Only Systems operators can be reset from here — never curators or admins.
      const { data: target } = await admin
        .from('system_operators')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (!target) return json({ error: 'That person isn’t on the Systems team.' });

      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message });
      return json({ ok: true });
    }

    if (action === 'lookup' || action === 'sendInvite' || action === 'sendReset') {
      // Site admins and Systems operators only (is_academy_admin covers both), asked as the caller.
      const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: isAdmin } = await asUser.rpc('is_academy_admin');
      if (!isAdmin) return json({ error: 'Only a site admin can do that.' }, 403);

      const email = String(body.email || '').trim().toLowerCase();
      if (!EMAIL_OK.test(email)) return json({ error: 'Enter the full email address, like name@example.com.' });
      const site: Site = body.site === 'market' ? 'market' : 'collective';
      const s = SITE[site];

      // Who did it, in Systems → Activity. Skipped quietly if admin_activity is not there yet.
      const log = async (what: string, changes: Record<string, unknown>) => {
        try {
          await admin.from('admin_activity').insert({
            actor_id: caller.id,
            actor_email: caller.email || null,
            actor_name: (caller.user_metadata?.full_name as string) || null,
            area: 'login_help',
            action: what,
            target_label: email,
            changes,
          });
        } catch { /* no activity log yet */ }
      };

      let user = await findUser(admin, email);

      if (action === 'lookup') {
        await log('lookup', { looked_up: [null, user ? (user.email_confirmed_at ? 'active' : 'not confirmed') : 'no account'] });
        return json({
          ok: true,
          exists: !!user,
          confirmed: !!user?.email_confirmed_at,
          last_sign_in: user?.last_sign_in_at || null,
        });
      }

      if (!emailConfigured()) return json({ error: 'Email isn’t set up yet (RESEND_API_KEY), so nothing was sent.' });
      if (action === 'sendReset' && !user) return json({ error: 'There is no account with that email yet. Send an invite instead.' });

      let created = false;
      if (!user) {
        // A new account with no password yet; the emailed link confirms the email and sets one.
        const name = String(body.name || '').trim().slice(0, 120);
        const { data, error } = await admin.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: name ? { full_name: name } : {},
        });
        if (error || !data.user) return json({ error: error?.message || 'Couldn’t create the account.' });
        user = data.user;
        created = true;
      }

      // A recovery link for both: opening it confirms the email and /portal asks for a password.
      // (An invite or magic link would sign them in with no password and nowhere to choose one.)
      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: PORTAL },
      });
      const url = link?.properties?.action_link;
      if (linkErr || !url) return json({ error: linkErr?.message || 'Couldn’t make the link.' });

      const first = String(body.name || user?.user_metadata?.full_name || '').trim().split(/\s+/)[0];
      const hi = `<p>Hi ${esc(first || 'there')},</p>`;
      const after = site === 'market'
        ? `<p>Once your password is saved you are signed in. Next time, sign in at <a href="${s.signIn}">${s.home}/login</a> with ${esc(email)} and that password.</p>`
        : `<p>Once your password is saved you are signed in. Next time, sign in at <a href="${s.signIn}">${s.home}/portal</a> with ${esc(email)} and that password.</p>`;
      const safety = '<p style="color:#74657A;font-size:13px">The button works once and for a limited time. If it has expired, ask us for a new one or tap “Forgot password” on the sign-in page. Didn’t expect this? You can ignore it; nothing changes until the button is used.</p>';

      const invite = action === 'sendInvite';
      const subject = invite ? `Your ${site === 'market' ? 'P31 Marketplace' : 'P31'} login is ready` : `Reset your ${site === 'market' ? 'P31 Marketplace' : 'P31'} password`;
      const html = invite
        ? layout('Your login is ready', `${hi}
<p>An account has been set up for you with ${esc(s.name)} using <b>${esc(email)}</b>. Tap the button to confirm your email and choose your password.</p>
${button(url, 'Choose my password')}
${after}${safety}`, s.footer, s.brand)
        : layout('Reset your password', `${hi}
<p>We received a request to reset the password for <b>${esc(email)}</b>. Tap the button to choose a new one.</p>
${button(url, 'Choose a new password')}
${after}${safety}`, s.footer, s.brand);

      const sent = await sendEmail(email, subject, html, undefined, s.from());
      if ('error' in sent && sent.error) return json({ error: 'The email couldn’t be sent. Try again in a minute.' });

      await log(invite ? 'invite' : 'reset', {
        status: [null, 'sent'],
        email_kind: [null, invite ? (created ? 'invite, new account' : 'invite') : 'password reset'],
        site: [null, site],
      });
      return json({ ok: true, created, sent: invite ? 'invite' : 'reset' });
    }

    return json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('systems-admin error:', err);
    return json({ error: (err as Error).message || 'Something went wrong.' }, 500);
  }
});
