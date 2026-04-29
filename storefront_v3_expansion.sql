/* ==========================================================
   P31 MARKETPLACE — STOREFRONT V3 (AESTHETICS & EXTERNAL)
   ========================================================== */

-- 1. Expand Curator Data for Storefront Aesthetics
ALTER TABLE curator_data 
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS facebook TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS public_email TEXT,
ADD COLUMN IF NOT EXISTS location TEXT;

-- 2. Expand Products for External Links & Categorization
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS external_url TEXT,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Collection';

-- 3. Storage Buckets (Ensure they exist)
-- These need to be run in Supabase SQL Editor if not already there:
/*
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT DO NOTHING;

-- Policies for Banners
CREATE POLICY "Public Banner Access" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
CREATE POLICY "Curator Banner Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'banners' AND auth.role() = 'authenticated');
CREATE POLICY "Curator Banner Update" ON storage.objects FOR UPDATE USING (bucket_id = 'banners' AND auth.role() = 'authenticated');

-- Policies for Logos
CREATE POLICY "Public Logo Access" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Curator Logo Upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');
CREATE POLICY "Curator Logo Update" ON storage.objects FOR UPDATE USING (bucket_id = 'logos' AND auth.role() = 'authenticated');
*/
