/* ==========================================================
   P31 MARKETPLACE — V9 PRESTIGE FEATURES & ANALYTICS
   ========================================================== */

-- 1. Pinned Messages in Chat
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- 2. Custom Titles for Curators
ALTER TABLE curator_data 
ADD COLUMN IF NOT EXISTS custom_title TEXT; -- e.g. "Master Artisan", "Founding Curator"

-- 3. Multi-Image Support for Products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

-- 4. Analytics Location Tracking
ALTER TABLE curator_analytics 
ADD COLUMN IF NOT EXISTS visitor_location TEXT; -- City, State or Region

-- 5. Pinned Message RLS Policy (Admins can pin)
-- Note: We already have update policies, but let's be sure.
CREATE POLICY "Admins can pin messages" 
ON messages FOR UPDATE 
TO authenticated 
USING (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND email IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
));
