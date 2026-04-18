/* ==========================================================
   P31 CHAT CLEANUP & SEED
   ========================================================== */

-- 1. Purge all existing messages
DELETE FROM messages;

-- 2. Seed the initial "Sanctuary Live Test" message
-- Note: This requires a valid profile_id. 
-- Using a common admin email lookup to find an ID.
INSERT INTO messages (profile_id, channel_id, text)
SELECT id, 'general', 'Sanctuary Live Test: The collective has been initialized. Standard chat protocols online.'
FROM profiles 
WHERE email = 'info@lumenlabsatl.com' 
LIMIT 1;

-- If for any reason the above insert fails (no admin profile yet), 
-- the table will just be empty and ready for fresh seeds.
