/* ==========================================================
   P31 MARKETPLACE — V14: ADMIN COMMERCE OVERSIGHT
   Lets the Master Architect accounts see every order in the
   Governance → Marketplace Commerce console.
   Run this in the Supabase SQL Editor (after v13).
   ========================================================== */

-- Admin emails must match the adminEmails list in src/context/AuthContext.jsx
DROP POLICY IF EXISTS "Admins view all orders" ON orders;
CREATE POLICY "Admins view all orders"
ON orders FOR SELECT
USING (
  (auth.jwt() ->> 'email') IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
);
