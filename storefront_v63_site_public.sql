-- ==========================================================
-- P31 v63: public site info (phone, hours, social links, booking links, donate link, podcast links,
-- membership price) that an admin edits in Systems and both public sites read without a deploy.
--
-- The values live in one app_settings row, key site_public. Only the fields an admin changed are
-- stored there; the sites fall back to the defaults in src/lib/siteInfo.js for everything else.
-- This script lets anyone, signed in or not, read that one row (and no other app_settings row).
-- Writing stays admin only through the existing policy from v42.
--
-- Re-runnable. Needs v42 (app_settings).
-- ==========================================================

DO $pol$
BEGIN
  IF to_regclass('public.app_settings') IS NULL THEN
    RAISE EXCEPTION 'public.app_settings is missing: run storefront_v42_operations.sql first';
  END IF;
END;
$pol$;

GRANT SELECT ON public.app_settings TO anon, authenticated;

DROP POLICY IF EXISTS "Read public site info" ON public.app_settings;
CREATE POLICY "Read public site info" ON public.app_settings FOR SELECT TO anon, authenticated
  USING (key = 'site_public');

-- An empty row, so the first admin save is an update. Existing values are kept.
INSERT INTO public.app_settings (key, value) VALUES ('site_public', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (63, 'public site info') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_settings'
    AND policyname = 'Read public site info' AND 'anon' = ANY (roles) AND 'authenticated' = ANY (roles)) AS public_read_policy,
  has_table_privilege('anon', 'public.app_settings', 'SELECT') AS anon_select_grant,
  EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'site_public') AS site_public_row,
  CASE WHEN to_regclass('public.schema_versions') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM public.schema_versions WHERE version = 63', false, true, '')::text <> ''
  END AS version_recorded;
