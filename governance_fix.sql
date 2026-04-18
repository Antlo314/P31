/* ==========================================================
   P31 GOVERNANCE & ARCHITECTURAL FEEDBACK FIX
   ========================================================== */

-- 1. Ensure admin_feedback column exists for guidance
ALTER TABLE curator_data 
ADD COLUMN IF NOT EXISTS admin_feedback TEXT;

-- 2. Update default status to 'draft' instead of 'pending'
-- This prevents new accounts from bypassing the submission workflow
ALTER TABLE curator_data 
ALTER COLUMN status SET DEFAULT 'draft';

-- 3. Reset any erroneously 'pending' accounts that haven't actually submitted
-- (Optional cleanup, but safer for existing data)
UPDATE curator_data 
SET status = 'draft' 
WHERE status = 'pending' AND is_published = FALSE;

-- 4. Enable efficient filtering for Governance
CREATE INDEX IF NOT EXISTS idx_curator_status ON curator_data(status);
