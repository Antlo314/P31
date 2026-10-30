/* ============================================================
   P31 - v66: Couples Private Mentorship Agreement, four plans
   Run after v65. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v66_couples_agreement.sql
   The result is one row: details_ready true, sign_ready true,
   version_recorded true.

   Couples now sign the Couples Private Mentorship Agreement (its text
   is in the site code), whose section 6 offers all four couples plans:
   the two monthly plans and the two six-month commitments.
   - coaching_intake_details: a couples intake lists all four couples
     plans (with their prices from Stripe) in the agreement
   - coaching_form_sign: a couples agreement accepts any of the four
     plan keys; the order message no longer names Business Coaching
   ============================================================ */

-- 1. The agreement lists all four couples plans.
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
                     AND pl.package IS NOT NULL AND (pl.billing = 'month' OR p.slug = 'couples') AND pl.is_active AND pl.price_cents IS NOT NULL),
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

-- 2. Signing: any of the four couples plans.
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
  IF p_kind <> 'coaching' AND v_count = 0 THEN RAISE EXCEPTION 'Please sign the agreement first.'; END IF;
  SELECT count(*) INTO v_count FROM coaching_forms WHERE intake_id = v_intake.id AND kind = 'confidentiality';
  IF p_kind = 'safety' AND v_count = 0 THEN RAISE EXCEPTION 'Please sign the Confidentiality Agreement first.'; END IF;

  IF p_kind = 'coaching' THEN
    IF v_package IS NULL OR NOT (CASE WHEN v_slug = 'couples' THEN v_package IN ('Couples Bi-Weekly', 'Couples Weekly', 'Couples Bi-Weekly 6M', 'Couples Weekly 6M')
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

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (66, 'couples agreement') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  (SELECT prosrc LIKE '%OR p.slug = %couples%' FROM pg_proc WHERE proname = 'coaching_intake_details' LIMIT 1) AS details_ready,
  (SELECT prosrc LIKE '%Couples Weekly 6M%' FROM pg_proc WHERE proname = 'coaching_form_sign' LIMIT 1) AS sign_ready,
  CASE WHEN to_regclass('public.schema_versions') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM public.schema_versions WHERE version = 66', false, true, '')::text <> ''
  END AS version_recorded;
