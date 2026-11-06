/* ============================================================
   P31 - v67: digital products (a PDF the buyer downloads)
   Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --remote=xsnhxjttdizljaawpumz -f storefront_v67_digital_products.sql
   The result is one row: columns_ready true, bucket_ready true,
   bucket_private true, file_policies true, version_recorded true.

   - products.digital_file_path / digital_file_name / digital_file_size:
     a shop owner attaches a PDF to a product. The path points into the
     private storage bucket digital-products.
   - digital-products is PRIVATE: nobody can open a file by its address.
     The shop owner uploads into a folder named after her own account
     and can replace or remove only her own files. Buyers get the file
     only through the digital-download function, which checks that the
     order is paid and then hands out a short-lived signed link.
   - PDF only, up to 50 MB.
   ============================================================ */

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS digital_file_path TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS digital_file_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS digital_file_size BIGINT;

DO $st$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('digital-products', 'digital-products', false, 52428800, ARRAY['application/pdf'])
    ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
  END IF;
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Shop owners see their digital files" ON storage.objects;
    CREATE POLICY "Shop owners see their digital files" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'digital-products' AND (storage.foldername(name))[1] = auth.uid()::text);
    DROP POLICY IF EXISTS "Shop owners add digital files" ON storage.objects;
    CREATE POLICY "Shop owners add digital files" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'digital-products' AND (storage.foldername(name))[1] = auth.uid()::text);
    DROP POLICY IF EXISTS "Shop owners change digital files" ON storage.objects;
    CREATE POLICY "Shop owners change digital files" ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'digital-products' AND (storage.foldername(name))[1] = auth.uid()::text);
    DROP POLICY IF EXISTS "Shop owners remove digital files" ON storage.objects;
    CREATE POLICY "Shop owners remove digital files" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'digital-products' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END;
$st$;

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (67, 'digital products') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products'
    AND column_name IN ('digital_file_path', 'digital_file_name', 'digital_file_size')) = 3 AS columns_ready,
  CASE WHEN to_regclass('storage.buckets') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM storage.buckets WHERE id = ''digital-products''', false, true, '')::text <> ''
  END AS bucket_ready,
  CASE WHEN to_regclass('storage.buckets') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM storage.buckets WHERE id = ''digital-products'' AND NOT public', false, true, '')::text <> ''
  END AS bucket_private,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname IN ('Shop owners see their digital files', 'Shop owners add digital files', 'Shop owners change digital files', 'Shop owners remove digital files')) = 4 AS file_policies,
  CASE WHEN to_regclass('public.schema_versions') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM public.schema_versions WHERE version = 67', false, true, '')::text <> ''
  END AS version_recorded;
