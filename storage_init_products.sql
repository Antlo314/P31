/* 
  P31 MARKETPLACE — STORAGE INITIALIZATION
  Run this in the Supabase SQL Editor to enable product image uploads.
*/

-- 1. Create the 'products' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'products', 
  'products', 
  true, 
  5242880, -- 5MB limit for Supabase Free Tier optimization
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Drop existing policies to avoid conflicts during re-run
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Curator Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Curator Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Curator Delete Access" ON storage.objects;

-- 3. Create fresh policies for the 'products' bucket
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'products');

CREATE POLICY "Curator Upload Access" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'products' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Curator Update Access" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'products' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Curator Delete Access" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'products' 
  AND auth.role() = 'authenticated'
);
