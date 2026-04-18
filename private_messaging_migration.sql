/* ==========================================================
   P31 PRIVATE MESSAGING & PERSISTENCE MIGRATION
   ========================================================== */

-- 1. Add recipient_id to allow Direct Messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 2. Refine RLS Policies for robust security and persistence
-- Dropping old policies to replace with a specialized multi-layer system
DROP POLICY IF EXISTS "Authenticated users can see chat" ON messages;
DROP POLICY IF EXISTS "Authenticated users can post chat" ON messages;
DROP POLICY IF EXISTS "Messages visibility" ON messages;
DROP POLICY IF EXISTS "Messages insertion" ON messages;
DROP POLICY IF EXISTS "Messages deletion" ON messages;

-- SELECT POLICY: Users see public messages OR private ones they are part of
CREATE POLICY "Messages visibility" ON messages
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  (recipient_id IS NULL) -- Public channels are open to all authenticated seekers
  OR 
  (auth.uid() = profile_id OR auth.uid() = recipient_id) -- Private DMs are exclusive
);

-- INSERT POLICY: Users can only sow messages into the collective as themselves
CREATE POLICY "Messages insertion" ON messages
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = profile_id);

-- DELETE POLICY: Persistence until explicit withdrawal by Owner or Architect (Admin)
CREATE POLICY "Messages deletion" ON messages
AS PERMISSIVE FOR DELETE
TO authenticated
USING (
  auth.uid() = profile_id -- The original author can withdraw their word
  OR
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND email IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
  )) -- P31 Architects have global maintenance authority
);
