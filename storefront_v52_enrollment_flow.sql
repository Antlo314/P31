/* ============================================================
   P31 - v52: the enrollment workflow (P31 Collective by NEBA)
   Run after v51. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v52_enrollment_flow.sql
   The result is one row: choose_ready true, details_ready true,
   enrolled_status_ready true.

   The official sequence (Private Faith Mentorship and Business
   Coaching): 1 interest, 2 intro call and approval, 3 enrollment
   invitation (complete within 48 hours), 4 the three forms,
   5 the client chooses her program and tier, 6 Stripe checkout,
   7 payment decision, 8 confirmation, 9 onboarding.
   This script adds step 5 to the private forms page:
   - coaching_intake_details also returns the tiers she can choose
     (Business Coaching options 1 to 4, Faith Mentorship 2, 3 or 4
     sessions) and her checkout link once chosen
   - coaching_choose_plan(token, plan): only after all three forms,
     makes her private, single-use checkout link for that tier
   - coaching_intakes gains the status enrolled (set by the payment
     webhook) and remembers the tier and checkout link chosen
   ============================================================ */

ALTER TABLE public.coaching_intakes ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.academy_plans(id) ON DELETE SET NULL;
ALTER TABLE public.coaching_intakes ADD COLUMN IF NOT EXISTS invite_id UUID REFERENCES public.academy_invites(id) ON DELETE SET NULL;
ALTER TABLE public.coaching_intakes ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ;
DO $chk$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.coaching_intakes'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%status%' LOOP
    EXECUTE format('ALTER TABLE public.coaching_intakes DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE public.coaching_intakes ADD CONSTRAINT coaching_intakes_status_check
    CHECK (status IN ('sent', 'in_progress', 'complete', 'checkout', 'enrolled', 'revoked'));
END;
$chk$;

-- What the private page shows, now with the tiers to choose from.
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
    'packages', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', pl.package, 'price_cents', pl.price_cents) ORDER BY pl.package), '[]'::jsonb)
                   FROM academy_plans pl JOIN academy_programs bp ON bp.id = pl.program_id
                   WHERE bp.slug = 'business' AND pl.package IS NOT NULL AND pl.is_active AND pl.price_cents IS NOT NULL),
    'plans', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', pl.id, 'program', ap.slug, 'program_title', ap.title, 'package', pl.package, 'label', pl.label, 'price_cents', pl.price_cents, 'billing', pl.billing) ORDER BY ap.slug, pl.price_cents), '[]'::jsonb)
                FROM academy_plans pl JOIN academy_programs ap ON ap.id = pl.program_id
                WHERE ap.slug IN ('business', 'faith') AND pl.package IS NOT NULL AND pl.is_active AND pl.price_cents IS NOT NULL),
    'chosen_plan', i.plan_id,
    'checkout_token', (SELECT inv.token FROM academy_invites inv WHERE inv.id = i.invite_id AND inv.used_at IS NULL AND inv.expires_at > now()),
    'enrolled', i.status = 'enrolled',
    'signed', (SELECT coalesce(jsonb_object_agg(f.kind, jsonb_build_object('signed_on', f.signed_on, 'signed_name', f.signed_name, 'package', f.package)), '{}'::jsonb)
                 FROM coaching_forms f WHERE f.intake_id = i.id))
  FROM coaching_intakes i LEFT JOIN academy_programs p ON p.id = i.program_id
  WHERE i.token = p_token AND length(p_token) >= 32;
$fn$;
GRANT EXECUTE ON FUNCTION public.coaching_intake_details(TEXT) TO anon, authenticated;

-- Step 5: she chooses her program and tier; only after all three forms are signed.
CREATE OR REPLACE FUNCTION public.coaching_choose_plan(p_token TEXT, p_plan UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_intake coaching_intakes%ROWTYPE;
  v_plan academy_plans%ROWTYPE;
  v_slug TEXT;
  v_count INTEGER;
  v_invite academy_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_intake FROM coaching_intakes WHERE token = p_token AND length(p_token) >= 32;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is not valid. Ask your mentor for a new one.'; END IF;
  IF v_intake.expires_at < now() OR v_intake.status = 'revoked' THEN RAISE EXCEPTION 'This link has expired. Ask your mentor for a new one.'; END IF;
  IF v_intake.status = 'enrolled' THEN RAISE EXCEPTION 'You are already enrolled. Sign in from the member portal.'; END IF;
  SELECT count(DISTINCT kind) INTO v_count FROM coaching_forms WHERE intake_id = v_intake.id;
  IF v_count < 3 THEN RAISE EXCEPTION 'Please complete all three forms first.'; END IF;
  SELECT * INTO v_plan FROM academy_plans WHERE id = p_plan;
  SELECT slug INTO v_slug FROM academy_programs WHERE id = v_plan.program_id;
  IF v_plan.id IS NULL OR v_slug NOT IN ('business', 'faith') OR v_plan.package IS NULL OR NOT v_plan.is_active OR v_plan.price_cents IS NULL THEN
    RAISE EXCEPTION 'Please choose one of the plans shown.';
  END IF;
  -- The same tier again: reuse her unused link.
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

-- Re-signing a form later must not move an intake back from checkout or enrolled.
CREATE OR REPLACE FUNCTION public.coaching_intake_status_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  -- Re-signing a form later must not move an intake back from checkout or enrolled.
  IF OLD.status IN ('checkout', 'enrolled') AND NEW.status IN ('in_progress', 'complete') THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS coaching_intake_status_guard ON public.coaching_intakes;
CREATE TRIGGER coaching_intake_status_guard BEFORE UPDATE OF status ON public.coaching_intakes
  FOR EACH ROW EXECUTE FUNCTION public.coaching_intake_status_guard();

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (52, 'enrollment flow') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'coaching_choose_plan') AS choose_ready,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'coaching_intake_details') AS details_ready,
  EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'coaching_intakes_status_check' AND pg_get_constraintdef(oid) LIKE '%enrolled%') AS enrolled_status_ready;
