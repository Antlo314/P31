/* ============================================================
   P31 - v64: the public team directory, editable by admins
   Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v64_team_directory.sql
   The result is one row: table_ready true, rls_on true, seeded true,
   bucket_ready true, photo_policies true, version_recorded true.

   - public.team_directory: the people on the Team sections of both
     sites (name, role, blurb, mailboxes, which site, photo, order).
     Anyone reads the visible rows; site admins manage every row.
   - Seeded once (only while the table is empty) with the team list
     that lives in the site code today, in the same order. photo_path
     stays empty, so the bundled photos keep being used until an admin
     uploads a new one.
   - A public storage bucket team-photos: anyone can view, admins
     upload, replace and remove.
   ============================================================ */

CREATE TABLE IF NOT EXISTS public.team_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order INTEGER NOT NULL DEFAULT 100,
  name TEXT NOT NULL,
  role TEXT,
  blurb TEXT,
  emails TEXT[] NOT NULL DEFAULT '{}',
  site TEXT NOT NULL DEFAULT 'both',
  photo_path TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_directory DROP CONSTRAINT IF EXISTS team_directory_site_check;
ALTER TABLE public.team_directory ADD CONSTRAINT team_directory_site_check
  CHECK (site IN ('market', 'collective', 'both'));

CREATE INDEX IF NOT EXISTS team_directory_order_idx ON public.team_directory (sort_order, name);

-- Keep updated_at current on every change.
CREATE OR REPLACE FUNCTION public.team_directory_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS team_directory_touch ON public.team_directory;
CREATE TRIGGER team_directory_touch BEFORE UPDATE ON public.team_directory
  FOR EACH ROW EXECUTE FUNCTION public.team_directory_touch();

ALTER TABLE public.team_directory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone sees the visible team" ON public.team_directory;
CREATE POLICY "Anyone sees the visible team" ON public.team_directory FOR SELECT TO anon, authenticated
  USING (is_visible);
DROP POLICY IF EXISTS "Admins manage the team directory" ON public.team_directory;
CREATE POLICY "Admins manage the team directory" ON public.team_directory FOR ALL TO authenticated
  USING (public.is_academy_admin()) WITH CHECK (public.is_academy_admin());
GRANT SELECT ON public.team_directory TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.team_directory TO authenticated;

-- The team as it is in the site code today (src/lib/team.js), only while the table is empty.
INSERT INTO public.team_directory (sort_order, name, role, blurb, emails, site)
SELECT v.sort_order, v.name, v.role, v.blurb, v.emails, 'both'
FROM (VALUES
  (10, 'Melanie JC', 'Founder & CEO', 'Vision & leadership' || chr(10) || 'Partnerships & decisions',
    ARRAY['founder@thep31collective.org', 'ceo@p31market.com']),
  (20, 'Savannah Campbell', 'Executive Assistant', 'Administrative support' || chr(10) || 'Outreach communications',
    ARRAY['secretary@thep31collective.org', 'secretary@p31market.com']),
  (30, 'Yanni Bratcher', 'Marketing Strategist', 'Marketing strategy' || chr(10) || 'Organization awareness',
    ARRAY['marketing@p31market.com']),
  (40, 'Alexia Thomas', 'Member Liaison', 'Community experience' || chr(10) || 'Event planning',
    ARRAY['members@thep31collective.org', 'outreach@p31market.com']),
  (50, 'Shanay Prince', 'Support Coordinator', 'Grants & partnerships' || chr(10) || 'Operations support',
    ARRAY['grants@thep31collective.org', 'grants@p31market.com', 'coordinator@p31market.com']),
  (60, 'Anthony Carr', 'Marketplace Tech Support', 'Virtual marketplace troubleshooting' || chr(10) || 'Vendor support',
    ARRAY['vendor@p31market.com'])
) AS v (sort_order, name, role, blurb, emails)
WHERE NOT EXISTS (SELECT 1 FROM public.team_directory);

-- The photo bucket and its policies (only where Supabase storage exists).
DO $st$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('team-photos', 'team-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Anyone sees team photos" ON storage.objects;
    CREATE POLICY "Anyone sees team photos" ON storage.objects FOR SELECT TO anon, authenticated
      USING (bucket_id = 'team-photos');
    DROP POLICY IF EXISTS "Admins add team photos" ON storage.objects;
    CREATE POLICY "Admins add team photos" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'team-photos' AND public.is_academy_admin());
    DROP POLICY IF EXISTS "Admins change team photos" ON storage.objects;
    CREATE POLICY "Admins change team photos" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'team-photos' AND public.is_academy_admin());
    DROP POLICY IF EXISTS "Admins remove team photos" ON storage.objects;
    CREATE POLICY "Admins remove team photos" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'team-photos' AND public.is_academy_admin());
  END IF;
END;
$st$;

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (64, 'team directory') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  to_regclass('public.team_directory') IS NOT NULL AS table_ready,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.team_directory'::regclass) AS rls_on,
  (SELECT count(*) FROM public.team_directory) > 0 AS seeded,
  CASE WHEN to_regclass('storage.buckets') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM storage.buckets WHERE id = ''team-photos'' AND public', false, true, '')::text <> ''
  END AS bucket_ready,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname IN ('Anyone sees team photos', 'Admins add team photos', 'Admins change team photos', 'Admins remove team photos')) = 4 AS photo_policies,
  CASE WHEN to_regclass('public.schema_versions') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM public.schema_versions WHERE version = 64', false, true, '')::text <> ''
  END AS version_recorded;
