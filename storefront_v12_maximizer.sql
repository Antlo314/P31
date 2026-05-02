/* ==========================================================
   P31 MARKETPLACE — V12 MAXIMIZER EXPANSION
   ========================================================== */

-- 1. Extend Curator Data for Advanced Aesthetics
ALTER TABLE curator_data 
ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'classic_gold',
ADD COLUMN IF NOT EXISTS branding_package_unlocked BOOLEAN DEFAULT FALSE;

-- 2. Activity Pulse Table
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curator_id UUID REFERENCES curator_data(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'view', 'click', 'rsvp', 'broadcast'
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Chat Media Support
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'text';

-- 4. RLS for Activity Logs
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Curators can view their own activity logs" 
ON activity_logs FOR SELECT 
TO authenticated 
USING (auth.uid() = curator_id OR EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND email IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
));

-- 5. Trigger for View Logging (Optional: could be handled via RPC or client-side)
-- For now, we'll implement client-side logging to the activity_logs table.
