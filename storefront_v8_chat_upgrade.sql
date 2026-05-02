/* ==========================================================
   P31 MARKETPLACE — V8 CHAT UPGRADE (DMs & THREADS)
   ========================================================== */

-- 1. Add recipient_id for Direct Messaging
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 2. Add parent_id for Message Threading (Replies)
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES messages(id) ON DELETE CASCADE;

-- 3. Update RLS Policies for Private Messaging
-- Existing policy "Authenticated users can see chat" might be too broad for DMs
-- Let's replace it with a more secure one

DROP POLICY IF EXISTS "Authenticated users can see chat" ON messages;

CREATE POLICY "Users can see relevant messages" 
ON messages FOR SELECT 
TO authenticated 
USING (
  -- Public Channel Message
  (recipient_id IS NULL) 
  OR 
  -- Private DM (Sender or Receiver)
  (auth.uid() = profile_id OR auth.uid() = recipient_id)
);

-- Existing policy "Authenticated users can post chat" is mostly fine, but let's be explicit
DROP POLICY IF EXISTS "Authenticated users can post chat" ON messages;

CREATE POLICY "Users can post to relevant channels" 
ON messages FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = profile_id
);

-- 4. Add Deletion Policy
CREATE POLICY "Users can delete own messages" 
ON messages FOR DELETE 
TO authenticated 
USING (auth.uid() = profile_id OR EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND email IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
));
