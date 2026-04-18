/* ==========================================================
   P31 CHAT REPLIES MIGRATION
   ========================================================== */

-- 1. Add parent_id to allow threaded replies
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS parent_id BIGINT REFERENCES messages(id) ON DELETE SET NULL;

-- 2. Create index for performance on threaded fetches
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages(parent_id);

-- 3. Note for User: 
-- Please run this in your Supabase SQL Editor to enable the "Reply" feature.
