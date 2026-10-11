/* ============================================================
   P31 — v38: the site runs itself a little more
   Run after v37. Safe to run more than once.

   1. One admin list. Admins live in site_admins (Systems -> Team access
      adds and removes them); is_admin() reads it, so nothing is hard-coded.
   2. Markets know whether they take vendors (has_vendors) and when vendors
      check in (load_in). The December luncheon takes no vendors.
   3. Survey to lineup. When a vendor market announces its date, every
      business that answered "I am in for the next market" in the last six
      months is invited into its lineup, and join-notify emails them.
   4. Vendors see their own markets in the curator studio (my_markets).
   5. The scheduler (pg_cron + pg_net):
        every 10 minutes  join-notify   every form email goes out, even if the
                                        visitor closed the page before it was sent
        8 AM Eastern      team-digest   one morning email of what came in
        the 20th          studio-autocreate  next month of engagement posts,
                                        drafted as pre-posts for review
   ============================================================ */

-- ──────────────────────────────────────────────────────────
-- 1. One admin list
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_admins (
  email TEXT PRIMARY KEY CHECK (email = lower(email) AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name TEXT,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The two admins the site has always had (they were written into is_admin until now).
INSERT INTO public.site_admins (email, full_name) VALUES
  ('info@lumenlabsatl.com', 'Lumen Labs'),
  ('proverbs31markets@gmail.com', 'Proverbs 31 Marketplace')
ON CONFLICT (email) DO NOTHING;

-- Admins added later must have confirmed their email; the original two are trusted as before.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u JOIN public.site_admins a ON a.email = lower(u.email)
    WHERE u.id = auth.uid() AND (u.email_confirmed_at IS NOT NULL OR a.added_by IS NULL)
  );
$fn$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

ALTER TABLE public.site_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read admins" ON public.site_admins;
CREATE POLICY "Admins read admins" ON public.site_admins FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admins add admins" ON public.site_admins;
CREATE POLICY "Admins add admins" ON public.site_admins FOR INSERT TO authenticated WITH CHECK (public.is_admin() AND added_by = auth.uid());
DROP POLICY IF EXISTS "Admins remove admins" ON public.site_admins;
CREATE POLICY "Admins remove admins" ON public.site_admins FOR DELETE TO authenticated USING (public.is_admin());

-- Never leave the site without an admin.
CREATE OR REPLACE FUNCTION public.site_admins_keep_one()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF (SELECT count(*) FROM site_admins) <= 1 THEN RAISE EXCEPTION 'The site needs at least one admin.'; END IF;
  RETURN OLD;
END;
$fn$;
DROP TRIGGER IF EXISTS site_admins_keep_one ON public.site_admins;
CREATE TRIGGER site_admins_keep_one BEFORE DELETE ON public.site_admins FOR EACH ROW EXECUTE FUNCTION public.site_admins_keep_one();

-- ──────────────────────────────────────────────────────────
-- 2. Markets: vendors or not, and vendor check-in time
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.market_events
  ADD COLUMN IF NOT EXISTS has_vendors BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS load_in TEXT;          -- e.g. 3:15 PM (vendors check in by)
UPDATE public.market_events SET has_vendors = false WHERE title = 'Business and Leadership Luncheon';

-- ──────────────────────────────────────────────────────────
-- 3. Survey to lineup, automatically
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.event_vendors
  ADD COLUMN IF NOT EXISTS source TEXT,           -- application | registration | feedback | manual
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS event_vendors_invite_idx ON public.event_vendors (created_at) WHERE notified_at IS NULL AND source = 'feedback';

CREATE OR REPLACE FUNCTION public.market_invite_returning()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NEW.date_public IS TRUE AND NEW.is_active IS TRUE AND NEW.has_vendors IS TRUE AND NEW.event_date >= CURRENT_DATE
     AND (TG_OP = 'INSERT' OR OLD.date_public IS DISTINCT FROM true) THEN
    INSERT INTO event_vendors (event_id, application_id, business_name, email, categories, status, notes, source)
    SELECT NEW.id,
           (SELECT a.id FROM vendor_applications a WHERE f.email IS NOT NULL AND lower(a.email) = lower(f.email) ORDER BY a.created_at DESC LIMIT 1),
           f.business_name, f.email, '{}', 'invited',
           'Said "in for the next market" on the survey for ' || f.market_label, 'feedback'
      FROM (SELECT DISTINCT ON (lower(business_name)) * FROM vendor_feedback
             WHERE again = 'in' AND created_at > now() - interval '180 days'
             ORDER BY lower(business_name), created_at DESC) f
    ON CONFLICT (event_id, business_name) DO NOTHING;

    UPDATE vendor_feedback f SET lineup_id = v.id
      FROM event_vendors v
     WHERE v.event_id = NEW.id AND v.source = 'feedback' AND lower(v.business_name) = lower(f.business_name)
       AND f.again = 'in' AND f.lineup_id IS NULL;
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS market_invite_returning ON public.market_events;
CREATE TRIGGER market_invite_returning AFTER INSERT OR UPDATE OF date_public ON public.market_events
  FOR EACH ROW EXECUTE FUNCTION public.market_invite_returning();

-- ──────────────────────────────────────────────────────────
-- 4. A vendor sees her own markets
-- ──────────────────────────────────────────────────────────
-- Matched by her account (lineup curator) or by her email once it is confirmed.
-- Only market details and her own status come back, never anyone else.
CREATE OR REPLACE FUNCTION public.my_markets()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  WITH me AS (
    SELECT u.id, CASE WHEN u.email_confirmed_at IS NOT NULL THEN lower(u.email) END AS email
      FROM auth.users u WHERE u.id = auth.uid()
  ),
  ev AS (
    SELECT id, title, event_date, date_public, month_public, start_time, venue, address, load_in, has_vendors
      FROM market_events WHERE is_active AND event_date >= CURRENT_DATE - 45
  )
  SELECT jsonb_build_object(
    'registrations', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', r.id, 'event_id', r.event_id, 'event_label', r.event_label, 'status', r.status,
               'in_lineup', r.lineup_id IS NOT NULL, 'created_at', r.created_at) ORDER BY r.created_at DESC)
        FROM vendor_registrations r, me
       WHERE me.email IS NOT NULL AND lower(r.email) = me.email AND r.created_at > now() - interval '1 year'), '[]'::jsonb),
    'lineup', coalesce((
      SELECT jsonb_agg(jsonb_build_object('event_id', v.event_id, 'status', v.status, 'booth', v.booth,
               'checked_in', v.checked_in_at IS NOT NULL) ORDER BY v.created_at DESC)
        FROM event_vendors v, me
       WHERE v.event_id IN (SELECT id FROM ev)
         AND (v.curator_id = me.id OR (me.email IS NOT NULL AND lower(v.email) = me.email))), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(to_jsonb(ev) ORDER BY ev.event_date) FROM ev), '[]'::jsonb)
  );
$fn$;
REVOKE ALL ON FUNCTION public.my_markets() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_markets() TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 5. The morning digest remembers which days it has sent
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_digests (
  day DATE PRIMARY KEY,                 -- the Eastern date it covers
  sent_at TIMESTAMPTZ,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_digests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team reads digests" ON public.team_digests;
CREATE POLICY "Team reads digests" ON public.team_digests FOR SELECT TO authenticated USING (public.is_academy_admin() OR public.is_operator());

-- ──────────────────────────────────────────────────────────
-- 6. The scheduler
-- ──────────────────────────────────────────────────────────
-- Supabase ships both extensions; this turns them on (Database -> Extensions shows them too).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Replace any earlier copies of these jobs, then schedule them (times are UTC).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('p31-join-notify', 'p31-team-digest', 'p31-studio-autocreate');

SELECT cron.schedule('p31-join-notify', '*/10 * * * *', $job$
  SELECT net.http_post(
    url := 'https://xsnhxjttdizljaawpumz.supabase.co/functions/v1/join-notify',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source": "cron"}'::jsonb,
    timeout_milliseconds := 30000);
$job$);

-- 12:05 and 13:05 UTC: one of them is 8:05 AM Eastern whatever the season; the function sends once a day.
SELECT cron.schedule('p31-team-digest', '5 12,13 * * *', $job$
  SELECT net.http_post(
    url := 'https://xsnhxjttdizljaawpumz.supabase.co/functions/v1/team-digest',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source": "cron"}'::jsonb,
    timeout_milliseconds := 30000);
$job$);

-- The 20th at 14:00 UTC (10 AM Eastern): draft next month, once per month.
SELECT cron.schedule('p31-studio-autocreate', '0 14 20 * *', $job$
  SELECT net.http_post(
    url := 'https://xsnhxjttdizljaawpumz.supabase.co/functions/v1/studio-autocreate',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source": "cron"}'::jsonb,
    timeout_milliseconds := 60000);
$job$);
