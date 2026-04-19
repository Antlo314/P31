/* ==========================================================
   P31 MARKETPLACE — STOREFRONT V2 (REVIEW SYSTEM)
   ========================================================== */

-- 1. Update Curator Data Schema
ALTER TABLE curator_data 
ALTER COLUMN status SET DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS admin_feedback TEXT,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- 2. Security Infrastructure: Empower Curators to Establish their Sanctuaries
-- This resolves the 403 Forbidden errors for new registrations
ALTER TABLE curator_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own curator record" 
ON curator_data FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Ensure update policy is robust
DROP POLICY IF EXISTS "Curators can update own data" ON curator_data;
CREATE POLICY "Curators can update own data" 
ON curator_data FOR UPDATE 
USING (auth.uid() = id);

-- 3. Review Lifecycle Migration
UPDATE curator_data SET status = 'draft' WHERE status IS NULL OR status = 'pending';

-- 4. Note for User: 
-- Please run this in your Supabase SQL Editor to activate the full storefront ecosystem.
