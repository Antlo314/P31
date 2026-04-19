/* ==========================================================
   P31 MARKETPLACE — STOREFRONT V2 (REVIEW SYSTEM)
   ========================================================== */

-- 1. Update Curator Data Schema
ALTER TABLE curator_data 
ALTER COLUMN status SET DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS admin_feedback TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- 2. Migrate existing 'pending' to 'draft' if they haven't been reviewed yet
-- (Optional safety measure for local dev)
UPDATE curator_data SET status = 'draft' WHERE status = 'pending';

-- 3. Ensure RLS allows Admins to see feedback and status
-- (Assuming standard Admin roles are already handled in RLS)

-- 4. Note for User: 
-- Please run this in your Supabase SQL Editor to enable the new review lifecycle.
