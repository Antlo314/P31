/* ============================================================
   P31 - v62: mentorship plans and programs managed from Systems
   Run after v61. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v62_plans_admin.sql
   The result is one row: insert_policy true, delete_policy true,
   delete_guard true, package_length true, package_unique true,
   version_recorded true.

   Systems > Mentorship > Plans can now add, edit and delete plans
   and add, rename, hide and show programs, without SQL:
   - academy_plans: admins may INSERT and DELETE (UPDATE was already
     allowed; programs already had an admin policy for everything)
   - a plan that any enrollment, invite or coaching intake points at
     can not be deleted (the database refuses it); mark it
     unavailable instead. This also keeps invites, which would be
     removed together with their plan, safe.
   - package keys: at most 20 characters and unique across every
     program (the forms and the agreements look plans up by key).
     If the live data already breaks a rule, the rule is added for
     new rows only (length) or skipped (unique) and the
     verification row shows false.
   No prices in this file: prices still come from the Stripe
   Payment Links through the academy-checkout sync.
   ============================================================ */

-- 1. Admins add and delete plans.
DROP POLICY IF EXISTS "Admins add plans" ON public.academy_plans;
CREATE POLICY "Admins add plans" ON public.academy_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_academy_admin());
DROP POLICY IF EXISTS "Admins delete plans" ON public.academy_plans;
CREATE POLICY "Admins delete plans" ON public.academy_plans FOR DELETE TO authenticated
  USING (public.is_academy_admin());

-- 2. A plan in use can not be deleted.
CREATE OR REPLACE FUNCTION public.academy_plan_delete_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_enr INTEGER := 0;
  v_inv INTEGER := 0;
  v_int INTEGER := 0;
BEGIN
  SELECT count(*) INTO v_enr FROM academy_enrollments WHERE plan_id = OLD.id;
  SELECT count(*) INTO v_inv FROM academy_invites WHERE plan_id = OLD.id;
  IF to_regclass('public.coaching_intakes') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.coaching_intakes WHERE plan_id = $1' INTO v_int USING OLD.id;
  END IF;
  IF v_enr + v_inv + v_int > 0 THEN
    RAISE EXCEPTION 'This plan is in use (% enrollments, % invites, % coaching intakes). Mark it unavailable instead of deleting it.', v_enr, v_inv, v_int
      USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END;
$fn$;
REVOKE ALL ON FUNCTION public.academy_plan_delete_guard() FROM public, anon, authenticated;
DROP TRIGGER IF EXISTS academy_plan_delete_guard ON public.academy_plans;
CREATE TRIGGER academy_plan_delete_guard BEFORE DELETE ON public.academy_plans
  FOR EACH ROW EXECUTE FUNCTION public.academy_plan_delete_guard();

-- 3. Package keys: 20 characters at most, unique across programs.
DO $pkg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academy_plans_package_length'
                   AND conrelid = 'public.academy_plans'::regclass) THEN
    IF EXISTS (SELECT 1 FROM public.academy_plans WHERE char_length(package) > 20) THEN
      ALTER TABLE public.academy_plans ADD CONSTRAINT academy_plans_package_length
        CHECK (package IS NULL OR char_length(package) <= 20) NOT VALID;
    ELSE
      ALTER TABLE public.academy_plans ADD CONSTRAINT academy_plans_package_length
        CHECK (package IS NULL OR char_length(package) <= 20);
    END IF;
  END IF;
  IF to_regclass('public.academy_plans_package_unique') IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.academy_plans WHERE package IS NOT NULL
                      GROUP BY lower(package) HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX academy_plans_package_unique ON public.academy_plans (lower(package)) WHERE package IS NOT NULL;
  END IF;
END;
$pkg$;

-- 4. Version.
DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (62, 'plans admin') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_plans' AND policyname = 'Admins add plans' AND cmd = 'INSERT') AS insert_policy,
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'academy_plans' AND policyname = 'Admins delete plans' AND cmd = 'DELETE') AS delete_policy,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'academy_plan_delete_guard' AND tgrelid = 'public.academy_plans'::regclass) AS delete_guard,
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academy_plans_package_length' AND convalidated) AS package_length,
  to_regclass('public.academy_plans_package_unique') IS NOT NULL AS package_unique,
  CASE WHEN to_regclass('public.schema_versions') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM public.schema_versions WHERE version = 62', false, true, '')::text <> ''
  END AS version_recorded;
