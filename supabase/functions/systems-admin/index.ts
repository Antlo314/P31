// Supabase Edge Function: systems-admin
// Lets a Systems *owner* set a teammate's password (Systems → Settings).
// Everyone can already change their own password from the browser.
// Deploy: supabase functions deploy systems-admin
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
// Business errors come back as 200 + { error } so the page can show them.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const MIN_PASSWORD = 8;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: userData } = await admin.auth.getUser(token);
    const caller = userData?.user;
    if (!caller) return json({ error: 'Sign in to Systems first.' }, 401);

    const { data: me } = await admin
      .from('system_operators')
      .select('role')
      .eq('user_id', caller.id)
      .maybeSingle();
    if (me?.role !== 'owner') return json({ error: 'Only a Systems owner can do that.' });

    const { action, userId, password } = await req.json();

    if (action === 'reset-password') {
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

    return json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('systems-admin error:', err);
    return json({ error: (err as Error).message || 'Something went wrong.' }, 500);
  }
});
