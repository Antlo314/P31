/* ============================================================
   P31 — v26: products of unapproved curators stay private
   Run after v25. Safe to run more than once.

   Products were readable by anyone ("USING (true)"), including
   items uploaded by curators whose applications are still pending.
   Now:
     - everyone sees products from APPROVED curators (shop, storefronts)
     - curators always see their own products
     - admins and Systems operators see everything (curator review)
   Writing products is unchanged.
   ============================================================ */

-- 1. Remove the old "anyone can read" rule (its name differs between setups, so find it).
DO $do$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products' AND cmd = 'SELECT' AND qual = 'true'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.products', r.policyname);
    RAISE NOTICE 'Removed public read rule: %', r.policyname;
  END LOOP;
END
$do$;

-- 2. The new read rule.
DROP POLICY IF EXISTS "Products of approved curators are public" ON public.products;
CREATE POLICY "Products of approved curators are public" ON public.products FOR SELECT
  USING (
    curator_id = auth.uid()
    OR public.is_admin()
    OR public.is_operator()
    OR EXISTS (SELECT 1 FROM public.curator_data c WHERE c.id = products.curator_id AND c.status = 'approved')
  );
