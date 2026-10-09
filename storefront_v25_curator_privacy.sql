/* ============================================================
   P31 — v25: keep curator applications private
   Run after v24. Safe to run more than once.

   Until now every curator row was public ("USING (true)"), so
   pending and rejected applications, including any phone, email
   or payment fields, could be read by anyone with the site's
   public key. Now:
     - everyone sees APPROVED curators (shop, directory, storefronts)
     - applicants always see their own row, whatever its status
     - admins and Systems operators see every application
   ============================================================ */

DROP POLICY IF EXISTS "Curator data is public" ON public.curator_data;
DROP POLICY IF EXISTS "Approved curators are public" ON public.curator_data;
CREATE POLICY "Approved curators are public" ON public.curator_data FOR SELECT
  USING (
    status = 'approved'
    OR id = auth.uid()
    OR public.is_admin()
    OR public.is_operator()
  );
