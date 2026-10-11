/* ============================================================
   P31 - v40: direct-message notifications for The Gathering
   Run after v39. Safe to run more than once.

   A member who misses a direct message gets one email, a few minutes
   after it arrives, with the newest lines and a link back to the
   conversation. Read it in time and no email is sent. Members can turn
   the emails off from their own card in The Gathering.
     chat_prefs        each member: email me about direct messages (on by default)
     chat_dm_notices   what was emailed, so nobody gets more than one email
                       per conversation every 30 minutes
     chat-notify       the function the scheduler calls every 5 minutes
   ============================================================ */

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS chat_messages_unnotified_idx ON public.chat_messages (created_at) WHERE notified_at IS NULL AND thread_root IS NULL;

CREATE TABLE IF NOT EXISTS public.chat_prefs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dm_email BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own chat preferences" ON public.chat_prefs;
CREATE POLICY "Own chat preferences" ON public.chat_prefs FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.chat_dm_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  message_count INTEGER NOT NULL DEFAULT 1,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_dm_notices_idx ON public.chat_dm_notices (user_id, channel_id, sent_at DESC);
ALTER TABLE public.chat_dm_notices ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.chat_set_prefs(p_dm_email BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  INSERT INTO chat_prefs (user_id, dm_email) VALUES (auth.uid(), coalesce(p_dm_email, true))
  ON CONFLICT (user_id) DO UPDATE SET dm_email = EXCLUDED.dm_email, updated_at = now();
  RETURN jsonb_build_object('dm_email', coalesce(p_dm_email, true));
END;
$fn$;
REVOKE ALL ON FUNCTION public.chat_set_prefs(BOOLEAN) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_set_prefs(BOOLEAN) TO authenticated;

-- chat_me() now carries the preference, so the card shows the switch.
CREATE OR REPLACE FUNCTION public.chat_me()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT jsonb_build_object('id', auth.uid(), 'member', public.chat_is_member(), 'moderator', public.chat_can_moderate(),
                            'overseer', public.is_admin(), 'audiences', to_jsonb(public.chat_audiences()),
                            'roles', CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.chat_roles(auth.uid()) END,
                            'dm_email', coalesce((SELECT dm_email FROM chat_prefs WHERE user_id = auth.uid()), true));
$fn$;

-- The scheduler has to be on (v38 turns it on; repeating this is harmless).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
DO $grants$
BEGIN
  GRANT USAGE ON SCHEMA cron TO postgres;
  GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'cron grants left as they were: %', SQLERRM;
END;
$grants$;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Every 5 minutes: email anyone who missed a direct message.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'p31-chat-notify';
SELECT cron.schedule('p31-chat-notify', '*/5 * * * *', $job$
  SELECT net.http_post(
    url := 'https://xsnhxjttdizljaawpumz.supabase.co/functions/v1/chat-notify',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source": "cron"}'::jsonb,
    timeout_milliseconds := 30000);
$job$);
