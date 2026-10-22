/* ============================================================
   P31 - v61: Couples Private Mentorship, automatic partner access
   Run after v60. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v61_couples_partner_access.sql
   The result is one row: partner_source true, functions_ready true,
   mirror_trigger true, version_recorded true.

   One partner pays for the couple (v60). The other partner now gets
   the same classroom access automatically, with source partner:
   - when the payment comes through, a partner who already has a login
     is enrolled at once;
   - a partner who creates a login later is enrolled on first sign-in
     (the site calls academy_claim_partner);
   - the partner access follows the paid enrollment: renewed, past due,
     canceled or ended, the partner gets the same status and end date.
   ============================================================ */

ALTER TABLE public.academy_enrollments DROP CONSTRAINT IF EXISTS academy_enrollments_source_check;
ALTER TABLE public.academy_enrollments ADD CONSTRAINT academy_enrollments_source_check
  CHECK (source IN ('stripe', 'manual', 'comp', 'partner'));

-- Copy the paid enrollment of a couple onto every other partner who has a login.
CREATE OR REPLACE FUNCTION public.academy_couple_mirror(p_couple UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $fn$
DECLARE
  v_pay academy_enrollments%ROWTYPE;
  v_n INTEGER := 0;
  r RECORD;
BEGIN
  IF p_couple IS NULL THEN RETURN 0; END IF;
  SELECT e.* INTO v_pay
    FROM coaching_intakes i
    JOIN auth.users u ON lower(u.email) = lower(i.email)
    JOIN academy_enrollments e ON e.user_id = u.id AND e.program_id = i.program_id AND e.source = 'stripe'
   WHERE i.couple_id = p_couple AND i.status <> 'revoked'
   ORDER BY e.started_at DESC
   LIMIT 1;
  IF v_pay.id IS NULL THEN RETURN 0; END IF;
  FOR r IN SELECT DISTINCT u.id AS uid
             FROM coaching_intakes i JOIN auth.users u ON lower(u.email) = lower(i.email)
            WHERE i.couple_id = p_couple AND i.status <> 'revoked' AND u.id <> v_pay.user_id LOOP
    INSERT INTO academy_enrollments (user_id, program_id, plan_id, status, source, access_until)
    VALUES (r.uid, v_pay.program_id, v_pay.plan_id, v_pay.status, 'partner', v_pay.access_until)
    ON CONFLICT (user_id, program_id) DO UPDATE
      SET status = EXCLUDED.status, access_until = EXCLUDED.access_until, plan_id = EXCLUDED.plan_id, updated_at = now()
      WHERE academy_enrollments.source = 'partner';
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$fn$;
REVOKE ALL ON FUNCTION public.academy_couple_mirror(UUID) FROM public, anon, authenticated;

-- Whenever a paid enrollment is created or changes, its couple partners follow.
CREATE OR REPLACE FUNCTION public.academy_couple_mirror_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $fn$
DECLARE
  v_couple UUID;
BEGIN
  FOR v_couple IN SELECT DISTINCT i.couple_id
                    FROM coaching_intakes i JOIN auth.users u ON lower(u.email) = lower(i.email)
                   WHERE u.id = NEW.user_id AND i.couple_id IS NOT NULL AND i.program_id = NEW.program_id LOOP
    PERFORM public.academy_couple_mirror(v_couple);
  END LOOP;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS academy_couple_mirror ON public.academy_enrollments;
CREATE TRIGGER academy_couple_mirror AFTER INSERT OR UPDATE OF status, access_until, plan_id ON public.academy_enrollments
  FOR EACH ROW WHEN (NEW.source = 'stripe')
  EXECUTE FUNCTION public.academy_couple_mirror_trigger();

-- A partner who signs in (or creates a login) after the payment picks up the access.
CREATE OR REPLACE FUNCTION public.academy_claim_partner()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $fn$
DECLARE
  v_email TEXT;
  v_couple UUID;
  v_n INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN RETURN 0; END IF;
  FOR v_couple IN SELECT DISTINCT couple_id FROM coaching_intakes
                   WHERE couple_id IS NOT NULL AND lower(email) = lower(v_email) AND status <> 'revoked' LOOP
    v_n := v_n + public.academy_couple_mirror(v_couple);
  END LOOP;
  RETURN v_n;
END;
$fn$;
REVOKE ALL ON FUNCTION public.academy_claim_partner() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.academy_claim_partner() TO authenticated;

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (61, 'couples partner access') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'academy_enrollments_source_check')) LIKE '%partner%' AS partner_source,
  (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
    WHERE n.nspname = 'public' AND pr.proname IN ('academy_couple_mirror', 'academy_couple_mirror_trigger', 'academy_claim_partner')) = 3 AS functions_ready,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'academy_couple_mirror') AS mirror_trigger,
  CASE WHEN to_regclass('public.schema_versions') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM public.schema_versions WHERE version = 61', false, true, '')::text <> ''
  END AS version_recorded;
