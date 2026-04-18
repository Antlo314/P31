/* ==========================================================
   P31 REALTIME PERSISTENCE FIX
   ========================================================== */

-- 1. Ensure the messages table broadcasts full data during DELETE
-- This allows the frontend to receive the 'id' of the deleted message
ALTER TABLE messages REPLICA IDENTITY FULL;

-- 2. Add the messages table to the realtime publication
-- (If not already included in the 'supabase_realtime' publication)
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE messages, profiles, curator_data;
COMMIT;
