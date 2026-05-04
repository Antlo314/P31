/* ==========================================================
   P31 MARKETPLACE — VENDOR APPROVALS MIGRATION
   ========================================================== */

-- 1. Create Pre-Approved Vendors Table
CREATE TABLE IF NOT EXISTS vendor_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT,
  last_name TEXT,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id)
);

-- 2. Enable Security
ALTER TABLE vendor_approvals ENABLE ROW LEVEL SECURITY;

-- 3. Security Policies
-- Admins defined in AuthContext: info@lumenlabsatl.com, proverbs31markets@gmail.com
-- For Postgres RLS, we can check the email directly from auth.jwt()
CREATE POLICY "Admins can manage vendor approvals" ON vendor_approvals
  FOR ALL TO authenticated
  USING (
    auth.jwt() ->> 'email' IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
  );

CREATE POLICY "Public can check approval status" ON vendor_approvals
  FOR SELECT TO public
  USING (true);
