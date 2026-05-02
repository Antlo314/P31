/* ==========================================================
   P31 MARKETPLACE — V6 VERIFICATION & THEMES
   ========================================================== */

-- 1. Add Verification Badges to Curator Data
ALTER TABLE curator_data 
ADD COLUMN IF NOT EXISTS verification_badges JSONB DEFAULT '[]'::jsonb; -- e.g. ["Handmade", "Organic", "Black-Owned"]

-- 2. Add Theme Preference to Curator Data
ALTER TABLE curator_data 
ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'classic_gold'; -- 'classic_gold', 'midnight_obsidian', 'botanical_green'

-- 3. Add Announcement Banner to Curator Data
ALTER TABLE curator_data 
ADD COLUMN IF NOT EXISTS shop_announcement TEXT;
