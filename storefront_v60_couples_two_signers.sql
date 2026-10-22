/* ============================================================
   P31 - v60: Couples Private Mentorship, two signers and one payment
   Run after v59. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v60_couples_two_signers.sql
   The result is one row: couple_column true, functions_ready true,
   enroll_trigger true, version_recorded true.

   A couples enrollment is two intakes (one per partner) that share a
   couple_id. Each partner gets their own private link and signs all
   three forms. Either partner can then choose the plan and pay, but
   only once BOTH partners have signed all three forms, and only one
   checkout per couple. When the payment comes through, both intakes
   are marked enrolled.
   - coaching_intakes.couple_id
   - coaching_intake_details: adds partners (name, forms signed, status),
     couple_ready and partner_paying
   - coaching_choose_plan: waits for both partners, one checkout per couple
   - trigger: enrolling one partner enrolls the other
   ============================================================ */

ALTER TABLE public.coaching_intakes ADD COLUMN IF NOT EXISTS couple_id UUID;
CREATE INDEX IF NOT EXISTS coaching_intakes_couple ON public.coaching_intakes (couple_id) WHERE couple_id IS NOT NULL;

-- 1. The forms page: the partner and whether both have signed.
CREATE OR REPLACE FUNCTION public.coaching_intake_details(p_token TEXT)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'full_name', i.full_name,
    'email', i.email,
    'status', i.status,
    'created_at', i.created_at,
    'expired', i.expires_at < now() OR i.status = 'revoked',
    'program', p.title,
    'program_slug', p.slug,
    'packages', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', pl.package, 'price_cents', pl.price_cents) ORDER BY pl.package), '[]'::jsonb)
                   FROM academy_plans pl JOIN academy_programs bp ON bp.id = pl.program_id
                   WHERE bp.slug = CASE WHEN p.slug = 'couples' THEN 'couples' ELSE 'business' END
                     AND pl.package IS NOT NULL AND pl.billing = 'month' AND pl.is_active AND pl.price_cents IS NOT NULL),
    'plans', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', pl.id, 'program', ap.slug, 'program_title', ap.title, 'package', pl.package, 'label', pl.label, 'price_cents', pl.price_cents, 'billing', pl.billing) ORDER BY ap.slug, (pl.billing = 'six_months'), pl.price_cents), '[]'::jsonb)
                FROM academy_plans pl JOIN academy_programs ap ON ap.id = pl.program_id
                WHERE ap.slug IN ('business', 'faith', 'couples')
                  AND (ap.slug = 'couples') = (coalesce(p.slug, '') = 'couples')
                  AND pl.package IS NOT NULL AND pl.is_active AND pl.price_cents IS NOT NULL),
    'chosen_plan', i.plan_id,
    'checkout_token', (SELECT inv.token FROM academy_invites inv WHERE inv.id = i.invite_id AND inv.used_at IS NULL AND inv.expires_at > now()),
    'enrolled', i.status = 'enrolled',
    'signed', (SELECT coalesce(jsonb_object_agg(f.kind, jsonb_build_object('signed_on', f.signed_on, 'signed_name', f.signed_name, 'package', f.package)), '{}'::jsonb)
                 FROM coaching_forms f WHERE f.intake_id = i.id),
    'partners', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                    'full_name', o.full_name,
                    'signed', (SELECT count(DISTINCT f.kind) FROM coaching_forms f WHERE f.intake_id = o.id),
                    'status', o.status) ORDER BY o.created_at), '[]'::jsonb)
                   FROM coaching_intakes o WHERE i.couple_id IS NOT NULL AND o.couple_id = i.couple_id AND o.id <> i.id AND o.status <> 'revoked'),
    'couple_ready', NOT EXISTS (SELECT 1 FROM coaching_intakes o
                     WHERE i.couple_id IS NOT NULL AND o.couple_id = i.couple_id AND o.status <> 'revoked'
                       AND (SELECT count(DISTINCT f.kind) FROM coaching_forms f WHERE f.intake_id = o.id) < 3),
    'partner_paying', EXISTS (SELECT 1 FROM coaching_intakes o
                     WHERE i.couple_id IS NOT NULL AND o.couple_id = i.couple_id AND o.id <> i.id AND o.status IN ('checkout', 'enrolled')))
  FROM coaching_intakes i LEFT JOIN academy_programs p ON p.id = i.program_id
  WHERE i.token = p_token AND length(p_token) >= 32;
$fn$;
GRANT EXECUTE ON FUNCTION public.coaching_intake_details(TEXT) TO anon, authenticated;

-- 2. Step 5: a couple pays once, after both partners have signed all three forms.
CREATE OR REPLACE FUNCTION public.coaching_choose_plan(p_token TEXT, p_plan UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_intake coaching_intakes%ROWTYPE;
  v_plan academy_plans%ROWTYPE;
  v_slug TEXT;
  v_intake_slug TEXT;
  v_count INTEGER;
  v_invite academy_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_intake FROM coaching_intakes WHERE token = p_token AND length(p_token) >= 32;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is not valid. Ask your mentor for a new one.'; END IF;
  IF v_intake.expires_at < now() OR v_intake.status = 'revoked' THEN RAISE EXCEPTION 'This link has expired. Ask your mentor for a new one.'; END IF;
  IF v_intake.status = 'enrolled' THEN RAISE EXCEPTION 'You are already enrolled. Sign in from the member portal.'; END IF;
  SELECT count(DISTINCT kind) INTO v_count FROM coaching_forms WHERE intake_id = v_intake.id;
  IF v_count < 3 THEN RAISE EXCEPTION 'Please complete all three forms first.'; END IF;
  IF v_intake.couple_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM coaching_intakes o WHERE o.couple_id = v_intake.couple_id AND o.status <> 'revoked'
                 AND (SELECT count(DISTINCT f.kind) FROM coaching_forms f WHERE f.intake_id = o.id) < 3) THEN
      RAISE EXCEPTION 'Payment opens once both partners have signed all three forms.';
    END IF;
    IF EXISTS (SELECT 1 FROM coaching_intakes o WHERE o.couple_id = v_intake.couple_id AND o.id <> v_intake.id
                 AND o.status IN ('checkout', 'enrolled')) THEN
      RAISE EXCEPTION 'Your partner has already started checkout for you both. They can finish it from their own link.';
    END IF;
  END IF;
  SELECT * INTO v_plan FROM academy_plans WHERE id = p_plan;
  SELECT slug INTO v_slug FROM academy_programs WHERE id = v_plan.program_id;
  SELECT slug INTO v_intake_slug FROM academy_programs WHERE id = v_intake.program_id;
  IF v_plan.id IS NULL OR v_slug NOT IN ('business', 'faith', 'couples') OR v_plan.package IS NULL OR NOT v_plan.is_active OR v_plan.price_cents IS NULL
     OR (v_slug = 'couples') <> (coalesce(v_intake_slug, '') = 'couples') THEN
    RAISE EXCEPTION 'Please choose one of the plans shown.';
  END IF;
  -- The same tier again: reuse the unused link.
  SELECT * INTO v_invite FROM academy_invites
   WHERE id = v_intake.invite_id AND plan_id = p_plan AND used_at IS NULL AND expires_at > now();
  IF v_invite.id IS NULL THEN
    INSERT INTO academy_invites (program_id, plan_id, email, full_name, inquiry_id, expires_at, created_by)
    VALUES (v_plan.program_id, v_plan.id, v_intake.email, v_intake.full_name, v_intake.inquiry_id, now() + interval '7 days', v_intake.created_by)
    RETURNING * INTO v_invite;
  END IF;
  UPDATE coaching_intakes SET plan_id = v_plan.id, invite_id = v_invite.id, status = 'checkout', program_id = v_plan.program_id WHERE id = v_intake.id;
  RETURN v_invite.token;
END;
$fn$;
REVOKE ALL ON FUNCTION public.coaching_choose_plan(TEXT, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.coaching_choose_plan(TEXT, UUID) TO anon, authenticated;

-- 3. When one partner pays and is enrolled, the other partner intake is enrolled too.
CREATE OR REPLACE FUNCTION public.coaching_couple_enrolled()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.status = 'enrolled' AND NEW.couple_id IS NOT NULL THEN
    UPDATE coaching_intakes SET status = 'enrolled', enrolled_at = coalesce(enrolled_at, now())
     WHERE couple_id = NEW.couple_id AND id <> NEW.id AND status NOT IN ('enrolled', 'revoked');
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS coaching_couple_enrolled ON public.coaching_intakes;
CREATE TRIGGER coaching_couple_enrolled AFTER UPDATE OF status ON public.coaching_intakes
  FOR EACH ROW WHEN (NEW.status = 'enrolled' AND NEW.couple_id IS NOT NULL)
  EXECUTE FUNCTION public.coaching_couple_enrolled();

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (60, 'couples two signers') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coaching_intakes' AND column_name = 'couple_id') AS couple_column,
  (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
    WHERE n.nspname = 'public' AND pr.proname IN ('coaching_intake_details', 'coaching_choose_plan') AND pr.prosrc LIKE '%couple_id%') = 2 AS functions_ready,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'coaching_couple_enrolled') AS enroll_trigger,
  CASE WHEN to_regclass('public.schema_versions') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM public.schema_versions WHERE version = 60', false, true, '')::text <> ''
  END AS version_recorded;
