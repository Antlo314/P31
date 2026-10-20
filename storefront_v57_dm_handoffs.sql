/* ============================================================
   P31 - v57: the DM hand-off list knows the brand and the email
   Run after v56. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v57_dm_handoffs.sql
   The result is one row, every column true:
     site_ready true, email_ready true, lead_ready true,
     market_rows_tagged true, version_recorded true.
   (version_recorded is false, not an error, on a database with no
   schema_versions table.)

   - dm_handoffs.site: which brand the message came in for, market
     or collective (empty when Carla could not tell). The TikTok
     account counts as market. Studio > Messages shows it as a
     Marketplace or Collective badge.
   - dm_handoffs.email: the email address someone gave Carla in a
     DM when they asked for more information.
   - kind lead: a new kind of hand-off, an info request. The person
     was promised details within 24 to 48 hours, so the team
     follows up by email.
   - The rows already on the list from the two Market accounts
     (Instagram and the Facebook page) are marked market.
   ============================================================ */

ALTER TABLE public.dm_handoffs ADD COLUMN IF NOT EXISTS site TEXT;
ALTER TABLE public.dm_handoffs ADD COLUMN IF NOT EXISTS email TEXT;

DO $site$
BEGIN
  ALTER TABLE public.dm_handoffs
    ADD CONSTRAINT dm_handoffs_site_check CHECK (site IS NULL OR site IN ('market', 'collective'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$site$;

-- One statement, so the list is never without a kind check while it is swapped.
ALTER TABLE public.dm_handoffs
  DROP CONSTRAINT IF EXISTS dm_handoffs_kind_check,
  ADD CONSTRAINT dm_handoffs_kind_check CHECK (kind IN ('dm', 'comment', 'review', 'lead'));

-- The Market Instagram and the Market Facebook page.
UPDATE public.dm_handoffs SET site = 'market'
WHERE site IS NULL AND account_id IN ('6ac6716d90b16e751447d7fe', '6ac67950507b603704a87454');

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (57, 'dm handoffs site and email') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dm_handoffs' AND column_name = 'site')
    AND EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dm_handoffs'::regclass AND conname = 'dm_handoffs_site_check') AS site_ready,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dm_handoffs' AND column_name = 'email') AS email_ready,
  EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.dm_handoffs'::regclass AND conname = 'dm_handoffs_kind_check'
    AND pg_get_constraintdef(oid) LIKE '%lead%') AS lead_ready,
  NOT EXISTS (SELECT 1 FROM public.dm_handoffs WHERE site IS NULL
    AND account_id IN ('6ac6716d90b16e751447d7fe', '6ac67950507b603704a87454')) AS market_rows_tagged,
  -- Read schema_versions only when it exists, as the DO block above does. A plain subquery
  -- would stop the whole check when the table is missing. query_to_xml runs the read late.
  CASE WHEN to_regclass('public.schema_versions') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM public.schema_versions WHERE version = 57', false, true, '')::text <> ''
  END AS version_recorded;
