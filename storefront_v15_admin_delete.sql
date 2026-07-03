/* ==========================================================
   P31 MARKETPLACE — V15: ADMIN REMOVAL CONTROLS
   Lets the Master Architect accounts permanently remove a
   curator and all of their products (e.g. placeholder / test
   accounts, or vendors who have left).
   Run this in the Supabase SQL Editor.
   ========================================================== */

-- Admin emails must match the adminEmails list in src/context/AuthContext.jsx
-- and src/pages/CuratorDashboard.jsx (deleteCurator).

-- 1. Admins may delete any curator_data row
DROP POLICY IF EXISTS "Admins delete curators" ON curator_data;
CREATE POLICY "Admins delete curators"
ON curator_data FOR DELETE
USING (
  (auth.jwt() ->> 'email') IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
);

-- 2. Admins may delete any product (removing a curator clears their catalog)
DROP POLICY IF EXISTS "Admins delete any product" ON products;
CREATE POLICY "Admins delete any product"
ON products FOR DELETE
USING (
  (auth.jwt() ->> 'email') IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
);

-- Note: this removes the curator from the marketplace (their storefront and
-- products). Their underlying auth.users login is not deleted here — remove
-- that from the Supabase Auth dashboard if a full account wipe is needed.
