/* ============================================================
   P31 - v47: private coaching intake forms
   Run after v46. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v47_coaching_forms.sql
   The result is one row: intakes_ready true, forms_ready true,
   sign_ready true, details_ready true, package_plans 4.

   The three Google Forms a new private-coaching client signed
   (Business Coaching Agreement, Confidentiality Agreement, Client
   Safety and Emergency Contact) now live on the site, in that order,
   on one private page: thep31collective.org/coaching/forms/<token>.
   A mentor sends the link from the mentor console (or Systems); the
   client signs each form in turn; each signed form is emailed to the
   team and ceo@p31market.com, with a PDF copy to the client.

   1. coaching_intakes: one row per invited client, with the private
      link token (sent by email through join-notify).
   2. coaching_forms: one row per signed form (three per client).
   3. coaching_intake_details(token): what the page shows the client.
   4. coaching_form_sign(token, kind, answers): checks and saves a
      signed form, in order.
   5. The four coaching packages become monthly plans on the Business
      Mentorship (Option 1 199, Option 2 325, Option 3 375, Option 4
      599 dollars a month), so the enrollment link charges the package
      she chose. Prices stay in the database: the page shows them only
      through a private link. Edit them in Systems, Academy.
   ============================================================ */

-- ----------------------------------------------------------
-- 0. Who runs private coaching: admins, the classroom dashboard, and every mentor
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_run_coaching()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_academy_admin()
    OR 'classroom' = ANY (public.my_team_tools())
    OR EXISTS (SELECT 1 FROM academy_mentors m WHERE m.user_id = auth.uid()));
$fn$;

-- ----------------------------------------------------------
-- 1. Intakes (the private links)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coaching_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  email TEXT NOT NULL,
  full_name TEXT,
  program_id UUID REFERENCES public.academy_programs(id) ON DELETE SET NULL,
  inquiry_id UUID REFERENCES public.academy_inquiries(id) ON DELETE SET NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'in_progress', 'complete', 'revoked')),
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 days',
  notified_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS coaching_intakes_recent ON public.coaching_intakes (created_at DESC);
ALTER TABLE public.coaching_intakes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Mentors manage intakes" ON public.coaching_intakes;
CREATE POLICY "Mentors manage intakes" ON public.coaching_intakes
  FOR ALL TO authenticated
  USING (public.can_run_coaching())
  WITH CHECK (public.can_run_coaching());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coaching_intakes TO authenticated;

-- ----------------------------------------------------------
-- 2. Signed forms
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coaching_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id UUID NOT NULL REFERENCES public.coaching_intakes(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('coaching', 'confidentiality', 'safety')),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  package TEXT,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature TEXT,
  signed_name TEXT NOT NULL,
  signed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  terms_version TEXT NOT NULL DEFAULT '2026-10',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ,
  UNIQUE (intake_id, kind)
);
CREATE INDEX IF NOT EXISTS coaching_forms_recent ON public.coaching_forms (created_at DESC);
ALTER TABLE public.coaching_forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Mentors read signed forms" ON public.coaching_forms;
CREATE POLICY "Mentors read signed forms" ON public.coaching_forms
  FOR SELECT TO authenticated
  USING (public.can_run_coaching());
DROP POLICY IF EXISTS "Admins delete signed forms" ON public.coaching_forms;
CREATE POLICY "Admins delete signed forms" ON public.coaching_forms
  FOR DELETE TO authenticated USING (public.is_academy_admin());
GRANT SELECT, DELETE ON public.coaching_forms TO authenticated;

-- ----------------------------------------------------------
-- 2b. The four packages as plans (one monthly plan per package)
-- ----------------------------------------------------------
ALTER TABLE public.academy_plans ADD COLUMN IF NOT EXISTS package TEXT;
DO $plans$
DECLARE r RECORD;
BEGIN
  -- One plan per program and billing was the rule; now one per program, billing and package.
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.academy_plans'::regclass AND contype = 'u'
             AND pg_get_constraintdef(oid) = 'UNIQUE (program_id, billing)' LOOP
    EXECUTE format('ALTER TABLE public.academy_plans DROP CONSTRAINT %I', r.conname);
  END LOOP;
END;
$plans$;
CREATE UNIQUE INDEX IF NOT EXISTS academy_plans_one_per_package ON public.academy_plans (program_id, billing, coalesce(package, ''));
INSERT INTO public.academy_plans (program_id, billing, label, price_cents, package)
SELECT p.id, 'month', x.label, x.cents, x.pkg
FROM public.academy_programs p
CROSS JOIN (VALUES
  ('Option 1', 'Coaching Option 1: Business Strategy and Development (biweekly, 60 min)', 19900),
  ('Option 2', 'Coaching Option 2: Hybrid Mentorship and Business Coaching (biweekly, 90 min)', 32500),
  ('Option 3', 'Coaching Option 3: Business Strategy and Development (weekly, 60 min)', 37500),
  ('Option 4', 'Coaching Option 4: VIP Hybrid Mentorship and Business Coaching (weekly, 90 min)', 59900)
) AS x(pkg, label, cents)
WHERE p.slug = 'business'
  AND NOT EXISTS (SELECT 1 FROM public.academy_plans q WHERE q.program_id = p.id AND q.package = x.pkg);

-- ----------------------------------------------------------
-- 3. What the private page shows (no prices leave this unless the token is right)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_intake_details(p_token TEXT)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'full_name', i.full_name,
    'email', i.email,
    'status', i.status,
    'expired', i.expires_at < now() OR i.status = 'revoked',
    'program', p.title,
    'packages', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', pl.package, 'price_cents', pl.price_cents) ORDER BY pl.package), '[]'::jsonb)
                   FROM academy_plans pl JOIN academy_programs bp ON bp.id = pl.program_id
                   WHERE bp.slug = 'business' AND pl.package IS NOT NULL AND pl.is_active AND pl.price_cents IS NOT NULL),
    'signed', (SELECT coalesce(jsonb_object_agg(f.kind, jsonb_build_object('signed_on', f.signed_on, 'signed_name', f.signed_name, 'package', f.package)), '{}'::jsonb)
                 FROM coaching_forms f WHERE f.intake_id = i.id))
  FROM coaching_intakes i LEFT JOIN academy_programs p ON p.id = i.program_id
  WHERE i.token = p_token AND length(p_token) >= 32;
$fn$;
GRANT EXECUTE ON FUNCTION public.coaching_intake_details(TEXT) TO anon, authenticated;

-- ----------------------------------------------------------
-- 4. Signing a form (in order: coaching, confidentiality, safety)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.coaching_form_sign(p_token TEXT, p_kind TEXT, p JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_intake coaching_intakes%ROWTYPE;
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
    IF v_package IS NULL OR v_package NOT IN ('Option 1', 'Option 2', 'Option 3', 'Option 4') THEN RAISE EXCEPTION 'Please select your business coaching package.'; END IF;
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

-- ----------------------------------------------------------
-- 5. Record this script, then one row to prove it
-- ----------------------------------------------------------
DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (47, 'coaching forms') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  to_regclass('public.coaching_intakes') IS NOT NULL AS intakes_ready,
  to_regclass('public.coaching_forms') IS NOT NULL AS forms_ready,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'coaching_form_sign') AS sign_ready,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'coaching_intake_details') AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_run_coaching') AS details_ready,
  (SELECT count(*) FROM public.academy_plans WHERE package IS NOT NULL) AS package_plans;
