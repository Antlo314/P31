/* ==========================================================
   P31 MARKETPLACE — ADMIN RESET SCRIPT
   ========================================================== 
   Email: proverbs31markets@gmail.com
   Purpose: Clear public data to allow for fresh re-provisioning.
   
   IMPORTANT: This script deletes public data. You MUST also 
   delete the user from the Supabase Authentication dashboard 
   to allow them to "Sign Up" again with the same email.
   ========================================================== */

-- 1. Identify the user ID
DO $$
DECLARE
    target_id UUID;
BEGIN
    SELECT id INTO target_id FROM profiles WHERE email = 'proverbs31markets@gmail.com';
    
    IF target_id IS NOT NULL THEN
        -- 2. Delete from dependent tables (ON DELETE CASCADE should handle most, but being explicit)
        DELETE FROM curator_data WHERE id = target_id;
        DELETE FROM profiles WHERE id = target_id;
        
        RAISE NOTICE 'Public data for proverbs31markets@gmail.com has been cleared.';
    ELSE
        RAISE NOTICE 'No profile found for proverbs31markets@gmail.com.';
    END IF;
END $$;
