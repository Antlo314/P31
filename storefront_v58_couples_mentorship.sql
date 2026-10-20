/* ============================================================
   P31 - v58: Couples Private Mentorship
   Run after v57. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v58_couples_mentorship.sql
   The result is one row: couples_program true, couples_plans 4,
   couples_linked 4, functions_ready true, package_keys_unique true,
   version_recorded true.

   Couples Private Mentorship is its own program (slug couples),
   with four plans on Stripe Payment Links that Melanie keeps:
     Couples Bi-Weekly      monthly, bi-weekly sessions (90 min)
     Couples Weekly         monthly, weekly sessions (90 min)
     Couples Bi-Weekly 6M   6-Month Commitment, bi-weekly sessions
     Couples Weekly 6M      6-Month Commitment, weekly sessions
   No prices in this file: the plans start without one, and the
   Stripe sync (academy-checkout, job p31-plan-sync) copies each
   price and billing from its link. The sync is started once at the
   end of this script, so the plans show within a minute or so.
   This file holds payment links, so it is never bundled into the
   site (Systems > Health shows only the command above for it).

   - academy_programs: the couples row (sort 3, active)
   - academy_plans: the four couples plans, package keys unique
     across every program and at most 20 characters; the 6M plans
     keep 183 days of access as a fallback if Stripe ever charges
     them as a one-time payment
   - coaching_intake_details: returns program_slug; a couples intake
     lists the couples monthly packages in section 5 and the couples
     plans at step 5; any other intake keeps the business packages
     and the business and faith plans
   - coaching_choose_plan: accepts a couples plan for a couples
     intake (and only there)
   - coaching_form_sign: a couples intake signs the coaching
     agreement with Couples Bi-Weekly or Couples Weekly; every other
     intake keeps Option 1 to 4
   ============================================================ */

-- 1. The program (public: title and copy only, never a price).
INSERT INTO public.academy_programs (slug, title, tagline, description, sort_order, is_active)
VALUES ('couples', 'Couples Private Mentorship',
        'Private mentorship for couples, in 90-minute sessions.',
        'Private 90-minute mentorship sessions for couples, bi-weekly or weekly, monthly or as a 6-month commitment. Every enrollment begins with an intro call.',
        3, true)
ON CONFLICT (slug) DO NOTHING;

-- 2. The four plans. price_cents stays empty until the Stripe sync fills it from the link.
INSERT INTO public.academy_plans (program_id, billing, label, price_cents, package, is_active, stripe_payment_link, access_days)
SELECT p.id, x.billing, x.label, NULL, x.pkg, true, x.link, x.days
  FROM public.academy_programs p,
       (VALUES ('month', 'Couples Bi-Weekly', 'Couples Private Mentorship: Bi-Weekly Sessions (90 min)', 'https://buy.stripe.com/28E7sK31Mavs69J1Mc8bS0F', NULL::INTEGER),
               ('month', 'Couples Weekly', 'Couples Private Mentorship: Weekly Sessions (90 min)', 'https://buy.stripe.com/bJe3cugSCcDA0PpfD28bS0G', NULL::INTEGER),
               ('six_months', 'Couples Bi-Weekly 6M', 'Couples Private Mentorship 6-Month Commitment: Bi-Weekly Sessions (90 min)', 'https://buy.stripe.com/8x24gy45QbzwdCbcqQ8bS0H', 183),
               ('six_months', 'Couples Weekly 6M', 'Couples Private Mentorship 6-Month Commitment: Weekly Sessions (90 min)', 'https://buy.stripe.com/eVqdR831M8nkbu3fD28bS0I', 183)
       ) AS x(billing, pkg, label, link, days)
 WHERE p.slug = 'couples'
   AND NOT EXISTS (SELECT 1 FROM public.academy_plans q WHERE q.program_id = p.id AND q.package = x.pkg);

-- 3. The forms page: the packages and plans of her program (couples, or business and faith).
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
                 FROM coaching_forms f WHERE f.intake_id = i.id))
  FROM coaching_intakes i LEFT JOIN academy_programs p ON p.id = i.program_id
  WHERE i.token = p_token AND length(p_token) >= 32;
$fn$;
GRANT EXECUTE ON FUNCTION public.coaching_intake_details(TEXT) TO anon, authenticated;

-- 4. Step 5: a couples plan for a couples intake; business or faith for every other.
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
  SELECT * INTO v_plan FROM academy_plans WHERE id = p_plan;
  SELECT slug INTO v_slug FROM academy_programs WHERE id = v_plan.program_id;
  SELECT slug INTO v_intake_slug FROM academy_programs WHERE id = v_intake.program_id;
  IF v_plan.id IS NULL OR v_slug NOT IN ('business', 'faith', 'couples') OR v_plan.package IS NULL OR NOT v_plan.is_active OR v_plan.price_cents IS NULL
     OR (v_slug = 'couples') <> (coalesce(v_intake_slug, '') = 'couples') THEN
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

-- 5. Signing a form: a couples intake picks a couples package in the coaching agreement.
CREATE OR REPLACE FUNCTION public.coaching_form_sign(p_token TEXT, p_kind TEXT, p JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_intake coaching_intakes%ROWTYPE;
  v_slug TEXT;
  v_name TEXT := left(trim(coalesce(p->>'full_name', '')), 120);
  v_signed TEXT := left(trim(coalesce(p->>'signed_name', '')), 120);
  v_sig TEXT := nullif(p->>'signature', '');
  v_package TEXT := nullif(left(trim(coalesce(p->>'package', '')), 20), '');
  v_answers JSONB := '{}'::jsonb;
  v_id UUID;
  v_count INTEGER;
BEGIN
  IF coalesce(p->>'trap', '') <> '' THEN RETURN gen_random_uuid(); END IF;
  IF p_kind NOT IN ('coaching', 'confidentiality', 'safety') THEN RAISE EXCEPTION 'Unknown form.'; END IF;
  SELECT * INTO v_intake FROM coaching_intakes WHERE token = p_token AND length(p_token) >= 32;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is not valid. Ask your mentor for a new one.'; END IF;
  IF v_intake.expires_at < now() OR v_intake.status = 'revoked' THEN RAISE EXCEPTION 'This link has expired. Ask your mentor for a new one.'; END IF;
  SELECT slug INTO v_slug FROM academy_programs WHERE id = v_intake.program_id;
  IF length(v_name) < 3 OR position(' ' IN v_name) = 0 THEN RAISE EXCEPTION 'Please enter your full name (first and last).'; END IF;
  IF length(v_signed) < 2 THEN v_signed := v_name; END IF;
  IF v_sig IS NOT NULL AND (v_sig !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' OR length(v_sig) > 400000) THEN
    RAISE EXCEPTION 'The signature could not be read. Please clear it and sign again.';
  END IF;
  -- In order: the coaching agreement first, then confidentiality, then safety.
  SELECT count(*) INTO v_count FROM coaching_forms WHERE intake_id = v_intake.id AND kind = 'coaching';
  IF p_kind <> 'coaching' AND v_count = 0 THEN RAISE EXCEPTION 'Please sign the Business Coaching Agreement first.'; END IF;
  SELECT count(*) INTO v_count FROM coaching_forms WHERE intake_id = v_intake.id AND kind = 'confidentiality';
  IF p_kind = 'safety' AND v_count = 0 THEN RAISE EXCEPTION 'Please sign the Confidentiality Agreement first.'; END IF;

  IF p_kind = 'coaching' THEN
    IF v_package IS NULL OR NOT (CASE WHEN v_slug = 'couples' THEN v_package IN ('Couples Bi-Weekly', 'Couples Weekly')
                                      ELSE v_package IN ('Option 1', 'Option 2', 'Option 3', 'Option 4') END) THEN
      RAISE EXCEPTION 'Please select your coaching package.';
    END IF;
    IF coalesce((p->>'agreed')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'Please confirm you have read and agree to the agreement.'; END IF;
  ELSIF p_kind = 'confidentiality' THEN
    IF coalesce((p->>'agreed')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'Please confirm you have read and agree to the Confidentiality Agreement.'; END IF;
  ELSE
    v_answers := jsonb_build_object(
      'emergency_contact', left(trim(coalesce(p->>'emergency_contact', '')), 400),
      'address', left(trim(coalesce(p->>'address', '')), 300),
      'phone', left(trim(coalesce(p->>'phone', '')), 40),
      'date_of_birth', CASE WHEN coalesce(p->>'date_of_birth', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN p->>'date_of_birth' END);
    IF length(v_answers->>'emergency_contact') < 5 THEN RAISE EXCEPTION 'Please add your emergency contact: their name, relationship and phone number.'; END IF;
    IF length(v_answers->>'address') < 5 THEN RAISE EXCEPTION 'Please add your residential address.'; END IF;
    IF length(regexp_replace(coalesce(v_answers->>'phone', ''), '\D', '', 'g')) < 7 THEN RAISE EXCEPTION 'Please add your best contact number.'; END IF;
    IF v_answers->>'date_of_birth' IS NULL THEN RAISE EXCEPTION 'Please enter your date of birth.'; END IF;
    IF (v_answers->>'date_of_birth')::date > CURRENT_DATE - interval '18 years' THEN RAISE EXCEPTION 'Clients must be 18 or older.'; END IF;
  END IF;

  INSERT INTO coaching_forms (intake_id, kind, email, full_name, package, answers, signature, signed_name, signed_on)
  VALUES (v_intake.id, p_kind, v_intake.email, v_name, v_package, v_answers, v_sig, v_signed, CURRENT_DATE)
  ON CONFLICT (intake_id, kind) DO UPDATE SET full_name = EXCLUDED.full_name, package = coalesce(EXCLUDED.package, coaching_forms.package),
    answers = EXCLUDED.answers, signature = EXCLUDED.signature, signed_name = EXCLUDED.signed_name, signed_on = EXCLUDED.signed_on, notified_at = NULL
  RETURNING id INTO v_id;

  SELECT count(DISTINCT kind) INTO v_count FROM coaching_forms WHERE intake_id = v_intake.id;
  UPDATE coaching_intakes SET
    full_name = coalesce(nullif(full_name, ''), v_name),
    status = CASE WHEN v_count >= 3 THEN 'complete' ELSE 'in_progress' END,
    completed_at = CASE WHEN v_count >= 3 THEN coalesce(completed_at, now()) ELSE completed_at END
  WHERE id = v_intake.id;
  IF v_count >= 3 AND v_intake.inquiry_id IS NOT NULL THEN
    UPDATE academy_inquiries SET status = 'scheduled', updated_at = now() WHERE id = v_intake.inquiry_id AND status = 'new';
  END IF;
  RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.coaching_form_sign(TEXT, TEXT, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.coaching_form_sign(TEXT, TEXT, JSONB) TO anon, authenticated;

-- 6. Copy the four prices from Stripe now (the daily job does it again at 10:15 UTC).
--    The request goes out after this script commits; the reply holds counts only.
DO $sync$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM net.http_post(
      url := 'https://xsnhxjttdizljaawpumz.supabase.co/functions/v1/academy-checkout',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"action": "sync", "source": "v58"}'::jsonb,
      timeout_milliseconds := 60000);
  END IF;
END;
$sync$;

-- 7. Record this script, then one row to prove it.
DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (58, 'couples private mentorship') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  EXISTS (SELECT 1 FROM public.academy_programs WHERE slug = 'couples' AND is_active) AS couples_program,
  (SELECT count(*) FROM public.academy_plans pl JOIN public.academy_programs p ON p.id = pl.program_id
    WHERE p.slug = 'couples' AND pl.is_active
      AND pl.package IN ('Couples Bi-Weekly', 'Couples Weekly', 'Couples Bi-Weekly 6M', 'Couples Weekly 6M')) AS couples_plans,
  (SELECT count(*) FROM public.academy_plans pl JOIN public.academy_programs p ON p.id = pl.program_id
    WHERE p.slug = 'couples' AND pl.stripe_payment_link LIKE 'https://buy.stripe.com/%'
      AND pl.package IN ('Couples Bi-Weekly', 'Couples Weekly', 'Couples Bi-Weekly 6M', 'Couples Weekly 6M')) AS couples_linked,
  (SELECT count(*) FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
    WHERE n.nspname = 'public' AND pr.proname IN ('coaching_intake_details', 'coaching_choose_plan', 'coaching_form_sign')
      AND pr.prosrc LIKE '%couples%') = 3 AS functions_ready,
  NOT EXISTS (SELECT 1 FROM public.academy_plans WHERE package IS NOT NULL GROUP BY package HAVING count(*) > 1) AS package_keys_unique,
  -- Read schema_versions only when it exists, as the DO block above does (query_to_xml runs the read late).
  CASE WHEN to_regclass('public.schema_versions') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM public.schema_versions WHERE version = 58', false, true, '')::text <> ''
  END AS version_recorded;
