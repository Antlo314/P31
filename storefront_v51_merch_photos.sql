/* ============================================================
   P31 - v51: merch photo galleries
   Run after v50. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v51_merch_photos.sql
   The result is one row: gallery_ready true.

   Each merch product now shows several Printful photos (worn by a
   model, in a lifestyle scene, flat) instead of one. The single
   photos made before this are removed so they are made again with
   the refreshed designs.
   ============================================================ */

ALTER TABLE public.merch_mockups ADD COLUMN IF NOT EXISTS gallery JSONB NOT NULL DEFAULT '[]'::jsonb;
DELETE FROM public.merch_mockups WHERE gallery = '[]'::jsonb;

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (51, 'merch photos') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'merch_mockups' AND column_name = 'gallery') AS gallery_ready;
