/* ============================================================
   P31 - v44: the Design studio
   Run after v43. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v44_design_studio.sql
   The result is one row: designs_ready true, tracks_ready true,
   shared_file_rules 3, team_photos_ok true.

   1. studio_designs: designs saved from Content Studio > Design, shared
      by everyone with a Studio seat (admins, Studio seats, and the
      content, social and email dashboards). Each row holds the design
      itself (words, colours, layout, music choice) and a small preview.
      Until this runs, the Design page keeps saved designs in the browser.
   2. studio_tracks: the team music library (songs uploaded for videos
      and reels). The files sit in the private studio bucket under
      shared/music/.
   3. Storage rules: Studio members can read, add and delete files under
      shared/ in the studio bucket. Personal folders are unchanged.
   4. Team photos: Savannah Campbell and Shanay Prince had each other
      as their portrait in Systems > Team access (photo keys b and c are
      swapped back, as the team confirmed on 2026-10-14).
   ============================================================ */

-- ----------------------------------------------------------
-- 1. Saved designs
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.studio_designs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Untitled design',
  doc JSONB NOT NULL,
  thumb TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS studio_designs_updated_idx ON public.studio_designs (updated_at DESC);
ALTER TABLE public.studio_designs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Studio team designs" ON public.studio_designs;
CREATE POLICY "Studio team designs" ON public.studio_designs
  FOR ALL TO authenticated
  USING (public.is_studio_member())
  WITH CHECK (public.is_studio_member());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_designs TO authenticated;

-- ----------------------------------------------------------
-- 2. The team music library
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.studio_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  seconds INTEGER,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.studio_tracks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Studio team music" ON public.studio_tracks;
CREATE POLICY "Studio team music" ON public.studio_tracks
  FOR ALL TO authenticated
  USING (public.is_studio_member())
  WITH CHECK (public.is_studio_member());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.studio_tracks TO authenticated;

-- ----------------------------------------------------------
-- 3. Shared files in the studio bucket (shared/...)
-- ----------------------------------------------------------
DROP POLICY IF EXISTS "Studio team shared files read" ON storage.objects;
CREATE POLICY "Studio team shared files read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'studio' AND (storage.foldername(name))[1] = 'shared' AND public.is_studio_member());

DROP POLICY IF EXISTS "Studio team shared files add" ON storage.objects;
CREATE POLICY "Studio team shared files add" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio' AND (storage.foldername(name))[1] = 'shared' AND public.is_studio_member());

DROP POLICY IF EXISTS "Studio team shared files delete" ON storage.objects;
CREATE POLICY "Studio team shared files delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'studio' AND (storage.foldername(name))[1] = 'shared' AND public.is_studio_member());

-- ----------------------------------------------------------
-- 4. Team photos (Savannah wears the cream top, key c; Shanay the long-sleeved white shirt, key b)
-- ----------------------------------------------------------
DO $photos$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'team_access' AND column_name = 'photo_key') THEN
    UPDATE public.team_access SET photo_key = 'c' WHERE full_name = 'Savannah Campbell' AND photo_key = 'b';
    UPDATE public.team_access SET photo_key = 'b' WHERE full_name = 'Shanay Prince' AND photo_key = 'c';
  END IF;
END;
$photos$;

-- ----------------------------------------------------------
-- 5. Record this script, then one row to prove it
-- ----------------------------------------------------------
DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (44, 'design studio') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  to_regclass('public.studio_designs') IS NOT NULL AS designs_ready,
  to_regclass('public.studio_tracks') IS NOT NULL AS tracks_ready,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'Studio team shared files%') AS shared_file_rules,
  NOT EXISTS (SELECT 1 FROM public.team_access WHERE (full_name = 'Savannah Campbell' AND photo_key = 'b') OR (full_name = 'Shanay Prince' AND photo_key = 'c')) AS team_photos_ok;
