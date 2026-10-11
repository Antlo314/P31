/* ============================================================
   P31 — v37: the four vendor forms move from JotForm to the site
   Run after v36. Safe to run more than once.

   p31market.com now hosts these forms in the site design, word for word:
     /vendors/agreement  Proverbs 31 Marketplace Storefront Agreement Form   -> vendor_agreements
     /vendors/register   P31 Marketplace Vendor Reservation (rules, signature, logo) -> vendor_registrations
     /vendors/feedback   Proverbs 31 Marketplace Vendor Feedback Survey      -> vendor_feedback
     /volunteer          Volunteer Day-of-Event Acknowledgment               -> volunteer_signups

   Everyone submits through submit_form(kind, answers): bot trap, checks,
   rate limits, a CRM entry. The team reads and reviews everything in
   Systems -> Market -> Vendor forms. The join-notify function emails the
   team and sends the signer a copy, once per row (notified_at).

   Connections
     - A signed storefront agreement is linked to the curator now (same
       email) or when she registers later (curator_data.agreement_signed_at).
     - A market registration, or a survey answer of "I am in for the next
       market", can be added to that market lineup in one step. The logo
       uploaded with a registration travels to the lineup and shows on the
       public Market dates page.
     - agreement_preapprove() lets the team pre-approve the email on an
       agreement so her account opens on sign-up (the 7-10 day link).
   ============================================================ */

-- ──────────────────────────────────────────────────────────
-- 1. Storefront agreements
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,       -- street, line2, city, state, zip, country
  agreed BOOLEAN NOT NULL DEFAULT true,
  signature TEXT,                                    -- drawn signature (PNG data URL)
  signed_name TEXT NOT NULL,                         -- the name typed under the signature
  signed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  terms_version TEXT NOT NULL DEFAULT '2026-10',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'account_sent', 'active', 'cancelled')),
  curator_id UUID REFERENCES public.curator_data(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  source TEXT,
  notified_at TIMESTAMPTZ,
  sheet_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_agreements_created_idx ON public.vendor_agreements (created_at DESC);
CREATE INDEX IF NOT EXISTS vendor_agreements_email_idx ON public.vendor_agreements (lower(email));
CREATE INDEX IF NOT EXISTS vendor_agreements_unnotified_idx ON public.vendor_agreements (created_at) WHERE notified_at IS NULL;

ALTER TABLE public.vendor_agreements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team reads agreements" ON public.vendor_agreements;
CREATE POLICY "Team reads agreements" ON public.vendor_agreements FOR SELECT TO authenticated
  USING (public.is_academy_admin() OR public.is_operator());
DROP POLICY IF EXISTS "Team reviews agreements" ON public.vendor_agreements;
CREATE POLICY "Team reviews agreements" ON public.vendor_agreements FOR UPDATE TO authenticated
  USING (public.is_academy_admin() OR public.is_operator()) WITH CHECK (public.is_academy_admin() OR public.is_operator());
DROP POLICY IF EXISTS "Admins remove agreements" ON public.vendor_agreements;
CREATE POLICY "Admins remove agreements" ON public.vendor_agreements FOR DELETE TO authenticated USING (public.is_academy_admin());
-- No insert policy: rows come in only through submit_form().

-- The curator record remembers the agreement.
ALTER TABLE public.curator_data
  ADD COLUMN IF NOT EXISTS agreement_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS agreement_id UUID REFERENCES public.vendor_agreements(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────────────────
-- 2. Market registrations (the vendor reservation)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.market_events(id) ON DELETE SET NULL,
  event_label TEXT NOT NULL,                         -- the month/year typed, or the market picked
  business_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  website TEXT,
  social TEXT,
  products TEXT NOT NULL,
  logo_url TEXT,
  agreed BOOLEAN NOT NULL DEFAULT true,              -- signed the Vendor Rules & Regulations
  signature TEXT,
  signed_name TEXT NOT NULL,
  signed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'waitlist', 'declined', 'cancelled')),
  lineup_id UUID REFERENCES public.event_vendors(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.vendor_applications(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  source TEXT,
  notified_at TIMESTAMPTZ,
  sheet_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_registrations_created_idx ON public.vendor_registrations (created_at DESC);
CREATE INDEX IF NOT EXISTS vendor_registrations_email_idx ON public.vendor_registrations (lower(email));
CREATE INDEX IF NOT EXISTS vendor_registrations_event_idx ON public.vendor_registrations (event_id, status);
CREATE INDEX IF NOT EXISTS vendor_registrations_unnotified_idx ON public.vendor_registrations (created_at) WHERE notified_at IS NULL;

ALTER TABLE public.vendor_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team reads registrations" ON public.vendor_registrations;
CREATE POLICY "Team reads registrations" ON public.vendor_registrations FOR SELECT TO authenticated
  USING (public.is_academy_admin() OR public.is_operator());
DROP POLICY IF EXISTS "Team reviews registrations" ON public.vendor_registrations;
CREATE POLICY "Team reviews registrations" ON public.vendor_registrations FOR UPDATE TO authenticated
  USING (public.is_academy_admin() OR public.is_operator()) WITH CHECK (public.is_academy_admin() OR public.is_operator());
DROP POLICY IF EXISTS "Admins remove registrations" ON public.vendor_registrations;
CREATE POLICY "Admins remove registrations" ON public.vendor_registrations FOR DELETE TO authenticated USING (public.is_academy_admin());

-- Lineups carry the logo now, so Market dates can show it.
ALTER TABLE public.event_vendors ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ──────────────────────────────────────────────────────────
-- 3. Vendor feedback survey
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.market_events(id) ON DELETE SET NULL,
  market_label TEXT NOT NULL,                        -- which market (month/year), or the market picked
  business_name TEXT NOT NULL,
  email TEXT,                                        -- optional, for a reply
  overall SMALLINT NOT NULL CHECK (overall BETWEEN 1 AND 5),
  venue SMALLINT NOT NULL CHECK (venue BETWEEN 1 AND 5),
  dj SMALLINT CHECK (dj BETWEEN 1 AND 5),
  organization SMALLINT NOT NULL CHECK (organization BETWEEN 1 AND 5),
  sales TEXT NOT NULL CHECK (sales IN ('Excellent', 'Good', 'Below my expectations', 'Poor')),
  again TEXT NOT NULL CHECK (again IN ('in', 'waitlist', 'no')),  -- in = I am in for the next market
  enjoyed TEXT,
  improve TEXT,
  comments TEXT,
  lineup_id UUID REFERENCES public.event_vendors(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT,
  notified_at TIMESTAMPTZ,
  sheet_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_feedback_created_idx ON public.vendor_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS vendor_feedback_unnotified_idx ON public.vendor_feedback (created_at) WHERE notified_at IS NULL;

ALTER TABLE public.vendor_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team reads feedback" ON public.vendor_feedback;
CREATE POLICY "Team reads feedback" ON public.vendor_feedback FOR SELECT TO authenticated
  USING (public.is_academy_admin() OR public.is_operator());
DROP POLICY IF EXISTS "Team reviews feedback" ON public.vendor_feedback;
CREATE POLICY "Team reviews feedback" ON public.vendor_feedback FOR UPDATE TO authenticated
  USING (public.is_academy_admin() OR public.is_operator()) WITH CHECK (public.is_academy_admin() OR public.is_operator());
DROP POLICY IF EXISTS "Admins remove feedback" ON public.vendor_feedback;
CREATE POLICY "Admins remove feedback" ON public.vendor_feedback FOR DELETE TO authenticated USING (public.is_academy_admin());

-- ──────────────────────────────────────────────────────────
-- 4. Volunteer sign-ups (Day-of-Event Acknowledgment)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.volunteer_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.market_events(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  emergency_contact TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT true,
  signature TEXT,
  signed_name TEXT NOT NULL,
  signed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'declined')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  source TEXT,
  notified_at TIMESTAMPTZ,
  sheet_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS volunteer_signups_created_idx ON public.volunteer_signups (created_at DESC);
CREATE INDEX IF NOT EXISTS volunteer_signups_unnotified_idx ON public.volunteer_signups (created_at) WHERE notified_at IS NULL;

ALTER TABLE public.volunteer_signups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team reads volunteers" ON public.volunteer_signups;
CREATE POLICY "Team reads volunteers" ON public.volunteer_signups FOR SELECT TO authenticated
  USING (public.is_academy_admin() OR public.is_operator());
DROP POLICY IF EXISTS "Team reviews volunteers" ON public.volunteer_signups;
CREATE POLICY "Team reviews volunteers" ON public.volunteer_signups FOR UPDATE TO authenticated
  USING (public.is_academy_admin() OR public.is_operator()) WITH CHECK (public.is_academy_admin() OR public.is_operator());
DROP POLICY IF EXISTS "Admins remove volunteers" ON public.volunteer_signups;
CREATE POLICY "Admins remove volunteers" ON public.volunteer_signups FOR DELETE TO authenticated USING (public.is_academy_admin());

-- ──────────────────────────────────────────────────────────
-- 5. Logos uploaded with a registration (public bucket, images only, 5 MB)
-- ──────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vendor-logos', 'vendor-logos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Anyone sees vendor logos" ON storage.objects;
CREATE POLICY "Anyone sees vendor logos" ON storage.objects FOR SELECT USING (bucket_id = 'vendor-logos');
-- The registration form uploads into registrations/; a soft cap keeps a bot from filling the bucket.
DROP POLICY IF EXISTS "Registrations upload a logo" ON storage.objects;
CREATE POLICY "Registrations upload a logo" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'vendor-logos' AND (storage.foldername(name))[1] = 'registrations'
    AND (SELECT count(*) FROM storage.objects o WHERE o.bucket_id = 'vendor-logos' AND o.created_at > now() - interval '1 hour') < 200
  );
DROP POLICY IF EXISTS "Team manages vendor logos" ON storage.objects;
CREATE POLICY "Team manages vendor logos" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'vendor-logos' AND (public.is_academy_admin() OR public.is_operator()))
  WITH CHECK (bucket_id = 'vendor-logos' AND (public.is_academy_admin() OR public.is_operator()));

-- ──────────────────────────────────────────────────────────
-- 6. submit_form(kind, answers): the one door for all four forms
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_form(p_kind TEXT, p JSONB)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $fn$
DECLARE
  v_email TEXT := lower(trim(coalesce(p->>'email', '')));
  v_first TEXT := left(trim(coalesce(p->>'first_name', '')), 80);
  v_last TEXT := left(trim(coalesce(p->>'last_name', '')), 80);
  v_name TEXT;
  v_phone TEXT := left(trim(coalesce(p->>'phone', '')), 40);
  v_business TEXT := left(trim(coalesce(p->>'business_name', '')), 160);
  v_sig TEXT := nullif(p->>'signature', '');
  v_signed TEXT := left(trim(coalesce(p->>'signed_name', '')), 120);
  v_on DATE := CASE WHEN coalesce(p->>'signed_on', '') ~ '^\d{4}-\d{2}-\d{2}$' THEN (p->>'signed_on')::date ELSE CURRENT_DATE END;
  v_source TEXT := left(nullif(trim(coalesce(p->>'source', '')), ''), 60);
  v_event UUID := CASE WHEN coalesce(p->>'event_id', '') ~ '^[0-9a-f-]{36}$' THEN (p->>'event_id')::uuid END;
  v_label TEXT;
  v_logo TEXT := nullif(trim(coalesce(p->>'logo_url', '')), '');
  v_curator UUID;
  v_app UUID;
  v_id UUID;
  v_rating SMALLINT[];
BEGIN
  IF coalesce(p->>'trap', '') <> '' THEN RETURN gen_random_uuid(); END IF;    -- bot: pretend it worked
  IF p_kind NOT IN ('agreement', 'registration', 'feedback', 'volunteer') THEN RAISE EXCEPTION 'Unknown form.'; END IF;
  v_name := trim(v_first || ' ' || v_last);

  -- Checks every form shares
  IF p_kind <> 'feedback' OR v_email <> '' THEN
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Please add a valid email address.'; END IF;
  END IF;
  IF p_kind <> 'feedback' THEN
    IF length(v_first) < 1 OR length(v_last) < 1 THEN RAISE EXCEPTION 'Please add your first and last name.'; END IF;
    IF length(regexp_replace(v_phone, '\D', '', 'g')) < 7 THEN RAISE EXCEPTION 'Please add a phone number we can reach you at.'; END IF;
    IF v_sig IS NOT NULL AND (v_sig !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' OR length(v_sig) > 400000) THEN
      RAISE EXCEPTION 'The signature could not be read. Please clear it and sign again.';
    END IF;
    IF v_sig IS NULL AND length(v_signed) < 2 THEN RAISE EXCEPTION 'Please sign the form.'; END IF;
    IF length(v_signed) < 2 THEN v_signed := v_name; END IF;
  END IF;
  IF p_kind IN ('agreement', 'registration', 'feedback') AND length(v_business) < 2 THEN RAISE EXCEPTION 'Please add your business name.'; END IF;
  IF v_event IS NOT NULL AND NOT EXISTS (SELECT 1 FROM market_events WHERE id = v_event) THEN v_event := NULL; END IF;
  IF v_event IS NOT NULL THEN
    SELECT title || ' · ' || to_char(event_date, 'FMMonth YYYY') INTO v_label FROM market_events WHERE id = v_event;
  END IF;

  -- ── Storefront agreement ──
  IF p_kind = 'agreement' THEN
    IF coalesce((p->>'agreed')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'Please confirm you have read and agree to the agreement terms.'; END IF;
    IF length(trim(coalesce(p->'address'->>'street', ''))) < 3 OR length(trim(coalesce(p->'address'->>'city', ''))) < 2 THEN
      RAISE EXCEPTION 'Please add your business address.';
    END IF;
    SELECT id INTO v_id FROM vendor_agreements WHERE lower(email) = v_email AND created_at > now() - interval '10 minutes' ORDER BY created_at DESC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;                               -- double submit
    IF (SELECT count(*) FROM vendor_agreements WHERE created_at > now() - interval '1 hour') > 60 THEN
      RAISE EXCEPTION 'We are getting a lot of forms right now. Please try again shortly.';
    END IF;
    SELECT c.id INTO v_curator FROM curator_data c JOIN auth.users u ON u.id = c.id WHERE lower(u.email) = v_email LIMIT 1;

    INSERT INTO vendor_agreements (business_name, first_name, last_name, email, phone, address, agreed, signature, signed_name, signed_on,
      status, curator_id, user_id, source)
    VALUES (v_business, v_first, v_last, v_email, v_phone,
      jsonb_build_object(
        'street', left(trim(coalesce(p->'address'->>'street', '')), 160), 'line2', left(trim(coalesce(p->'address'->>'line2', '')), 160),
        'city', left(trim(coalesce(p->'address'->>'city', '')), 80), 'state', left(trim(coalesce(p->'address'->>'state', '')), 80),
        'zip', left(trim(coalesce(p->'address'->>'zip', '')), 20), 'country', left(trim(coalesce(nullif(p->'address'->>'country', ''), 'United States')), 80)),
      true, v_sig, v_signed, v_on, CASE WHEN v_curator IS NULL THEN 'new' ELSE 'active' END, v_curator, auth.uid(), v_source)
    RETURNING id INTO v_id;

    IF v_curator IS NOT NULL THEN
      PERFORM set_config('p31.trusted', 'on', true);
      UPDATE curator_data SET agreement_signed_at = now(), agreement_id = v_id WHERE id = v_curator;
    END IF;
    PERFORM public.crm_add(v_email, v_name, v_phone, auth.uid(), 'storefront_agreement', 'Signed the Storefront Agreement',
      jsonb_build_object('business', v_business, 'has_account', v_curator IS NOT NULL), 'storefront agreement', 'curator', v_id::text);
    RETURN v_id;
  END IF;

  -- ── Market registration ──
  IF p_kind = 'registration' THEN
    v_label := coalesce(v_label, left(trim(coalesce(p->>'event_label', '')), 120));
    IF length(coalesce(v_label, '')) < 3 THEN RAISE EXCEPTION 'Please tell us the month and year of the event you are registering for.'; END IF;
    IF length(trim(coalesce(p->>'products', ''))) < 3 THEN RAISE EXCEPTION 'Please describe the products or services you will be offering on event day.'; END IF;
    IF coalesce((p->>'agreed')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'Please sign to agree to the Vendor Rules and Regulations.'; END IF;
    IF v_logo IS NOT NULL AND v_logo !~ '^https://[a-z0-9-]+\.supabase\.(co|in)/storage/v1/object/public/vendor-logos/' THEN v_logo := NULL; END IF;
    SELECT id INTO v_id FROM vendor_registrations WHERE lower(email) = v_email AND created_at > now() - interval '10 minutes' ORDER BY created_at DESC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
    IF (SELECT count(*) FROM vendor_registrations WHERE created_at > now() - interval '1 hour') > 60 THEN
      RAISE EXCEPTION 'We are getting a lot of forms right now. Please try again shortly.';
    END IF;
    SELECT id INTO v_app FROM vendor_applications WHERE lower(email) = v_email ORDER BY created_at DESC LIMIT 1;

    INSERT INTO vendor_registrations (event_id, event_label, business_name, first_name, last_name, email, phone, website, social, products,
      logo_url, agreed, signature, signed_name, signed_on, application_id, user_id, source)
    VALUES (v_event, v_label, v_business, v_first, v_last, v_email, v_phone,
      left(nullif(trim(coalesce(p->>'website', '')), ''), 200), left(nullif(trim(coalesce(p->>'social', '')), ''), 200),
      left(trim(p->>'products'), 2000), v_logo, true, v_sig, v_signed, v_on, v_app, auth.uid(), v_source)
    RETURNING id INTO v_id;

    PERFORM public.crm_add(v_email, v_name, v_phone, auth.uid(), 'market_registration', 'Registered to vend: ' || v_label,
      jsonb_build_object('business', v_business, 'event', v_label, 'products', left(p->>'products', 500)), 'vendor registration', 'curator', v_id::text);
    RETURN v_id;
  END IF;

  -- ── Feedback survey ──
  IF p_kind = 'feedback' THEN
    v_label := coalesce(v_label, left(trim(coalesce(p->>'market_label', '')), 120));
    IF length(coalesce(v_label, '')) < 3 THEN RAISE EXCEPTION 'Which market did you attend? Please add the month and year.'; END IF;
    v_rating := ARRAY[
      CASE WHEN coalesce(p->>'overall', '') ~ '^[1-5]$' THEN (p->>'overall')::smallint END,
      CASE WHEN coalesce(p->>'venue', '') ~ '^[1-5]$' THEN (p->>'venue')::smallint END,
      CASE WHEN coalesce(p->>'dj', '') ~ '^[1-5]$' THEN (p->>'dj')::smallint END,
      CASE WHEN coalesce(p->>'organization', '') ~ '^[1-5]$' THEN (p->>'organization')::smallint END];
    IF v_rating[1] IS NULL THEN RAISE EXCEPTION 'Please rate your overall experience (1 to 5).'; END IF;
    IF v_rating[2] IS NULL THEN RAISE EXCEPTION 'Please rate the venue and atmosphere (1 to 5).'; END IF;
    IF v_rating[4] IS NULL THEN RAISE EXCEPTION 'Please rate the organization of the event (1 to 5).'; END IF;
    IF coalesce(p->>'sales', '') NOT IN ('Excellent', 'Good', 'Below my expectations', 'Poor') THEN RAISE EXCEPTION 'Please tell us how your sales were.'; END IF;
    IF coalesce(p->>'again', '') NOT IN ('in', 'waitlist', 'no') THEN RAISE EXCEPTION 'Please tell us whether you would vend with P31 again.'; END IF;
    SELECT id INTO v_id FROM vendor_feedback WHERE lower(business_name) = lower(v_business) AND market_label = v_label AND created_at > now() - interval '10 minutes' ORDER BY created_at DESC LIMIT 1;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
    IF (SELECT count(*) FROM vendor_feedback WHERE created_at > now() - interval '1 hour') > 60 THEN
      RAISE EXCEPTION 'We are getting a lot of forms right now. Please try again shortly.';
    END IF;

    INSERT INTO vendor_feedback (event_id, market_label, business_name, email, overall, venue, dj, organization, sales, again, enjoyed, improve, comments, user_id, source)
    VALUES (v_event, v_label, v_business, nullif(v_email, ''), v_rating[1], v_rating[2], v_rating[3], v_rating[4], p->>'sales', p->>'again',
      left(nullif(trim(coalesce(p->>'enjoyed', '')), ''), 3000), left(nullif(trim(coalesce(p->>'improve', '')), ''), 3000),
      left(nullif(trim(coalesce(p->>'comments', '')), ''), 3000), auth.uid(), v_source)
    RETURNING id INTO v_id;

    IF v_email <> '' THEN
      PERFORM public.crm_add(v_email, NULL, NULL, auth.uid(), 'vendor_feedback', 'Sent market feedback: ' || v_label,
        jsonb_build_object('business', v_business, 'overall', v_rating[1], 'sales', p->>'sales', 'again', p->>'again'), 'feedback survey', NULL, v_id::text);
    END IF;
    RETURN v_id;
  END IF;

  -- ── Volunteer acknowledgment ──
  IF length(trim(coalesce(p->>'emergency_contact', ''))) < 5 THEN RAISE EXCEPTION 'Please tell us who to contact in an emergency (name and phone number).'; END IF;
  IF coalesce((p->>'acknowledged')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'Please acknowledge the statements above to continue.'; END IF;
  SELECT id INTO v_id FROM volunteer_signups WHERE lower(email) = v_email AND created_at > now() - interval '10 minutes' ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF (SELECT count(*) FROM volunteer_signups WHERE created_at > now() - interval '1 hour') > 60 THEN
    RAISE EXCEPTION 'We are getting a lot of forms right now. Please try again shortly.';
  END IF;

  INSERT INTO volunteer_signups (event_id, first_name, last_name, phone, email, emergency_contact, acknowledged, signature, signed_name, signed_on, user_id, source)
  VALUES (v_event, v_first, v_last, v_phone, v_email, left(trim(p->>'emergency_contact'), 300), true, v_sig, v_signed, v_on, auth.uid(), v_source)
  RETURNING id INTO v_id;

  PERFORM public.crm_add(v_email, v_name, v_phone, auth.uid(), 'volunteer', 'Signed up to volunteer' || CASE WHEN v_label IS NULL THEN '' ELSE ': ' || v_label END,
    jsonb_build_object('event', v_label), 'volunteer form', NULL, v_id::text);
  RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.submit_form(TEXT, JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_form(TEXT, JSONB) TO anon, authenticated;

-- ──────────────────────────────────────────────────────────
-- 7. When she registers later, her account picks up the agreement she signed
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.curator_link_agreement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $fn$
DECLARE v_email TEXT; a RECORD;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = NEW.id;
  IF v_email IS NULL THEN RETURN NEW; END IF;
  SELECT id, created_at INTO a FROM vendor_agreements WHERE lower(email) = v_email AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  IF a.id IS NULL THEN RETURN NEW; END IF;
  PERFORM set_config('p31.trusted', 'on', true);
  UPDATE curator_data SET agreement_signed_at = coalesce(agreement_signed_at, a.created_at), agreement_id = coalesce(agreement_id, a.id) WHERE id = NEW.id;
  UPDATE vendor_agreements SET curator_id = NEW.id, status = CASE WHEN status IN ('new', 'account_sent') THEN 'active' ELSE status END
   WHERE id = a.id AND curator_id IS NULL;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS curator_link_agreement ON public.curator_data;
CREATE TRIGGER curator_link_agreement AFTER INSERT ON public.curator_data
  FOR EACH ROW EXECUTE FUNCTION public.curator_link_agreement();

-- ──────────────────────────────────────────────────────────
-- 8. Team actions
-- ──────────────────────────────────────────────────────────
-- Pre-approve the email on an agreement so her account opens on sign-up (and open it now if she already has one).
CREATE OR REPLACE FUNCTION public.agreement_preapprove(p_agreement UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $fn$
DECLARE a RECORD; v_curator UUID;
BEGIN
  IF NOT (public.is_academy_admin() OR public.is_operator()) THEN RAISE EXCEPTION 'Team only.'; END IF;
  SELECT * INTO a FROM vendor_agreements WHERE id = p_agreement;
  IF a.id IS NULL THEN RAISE EXCEPTION 'Agreement not found.'; END IF;

  INSERT INTO vendor_approvals (first_name, last_name, email, approved_by)
  VALUES (a.first_name, a.last_name, lower(a.email), auth.uid())
  ON CONFLICT (email) DO NOTHING;

  SELECT c.id INTO v_curator FROM curator_data c JOIN auth.users u ON u.id = c.id WHERE lower(u.email) = lower(a.email) LIMIT 1;
  IF v_curator IS NOT NULL THEN
    PERFORM set_config('p31.trusted', 'on', true);
    UPDATE curator_data SET status = 'approved', is_paid = TRUE, is_published = TRUE,
      agreement_signed_at = coalesce(agreement_signed_at, a.created_at), agreement_id = coalesce(agreement_id, a.id)
     WHERE id = v_curator AND (status IS DISTINCT FROM 'approved' OR is_paid IS DISTINCT FROM TRUE OR agreement_id IS NULL);
    UPDATE vendor_agreements SET curator_id = v_curator, status = 'active', reviewed_by = auth.uid(), reviewed_at = now() WHERE id = a.id;
  ELSE
    UPDATE vendor_agreements SET reviewed_by = auth.uid(), reviewed_at = now() WHERE id = a.id;
  END IF;
  RETURN jsonb_build_object('has_account', v_curator IS NOT NULL, 'curator_id', v_curator, 'preapproved', true);
END;
$fn$;
REVOKE ALL ON FUNCTION public.agreement_preapprove(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.agreement_preapprove(UUID) TO authenticated;

-- A registration goes into the market lineup as a confirmed vendor (logo included).
CREATE OR REPLACE FUNCTION public.registration_to_lineup(p_registration UUID, p_event UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE r RECORD; v_event UUID; v_id UUID;
BEGIN
  IF NOT (public.is_academy_admin() OR public.is_operator()) THEN RAISE EXCEPTION 'Team only.'; END IF;
  SELECT * INTO r FROM vendor_registrations WHERE id = p_registration;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Registration not found.'; END IF;
  v_event := coalesce(p_event, r.event_id);
  IF v_event IS NULL THEN RAISE EXCEPTION 'Pick the market this registration is for.'; END IF;

  INSERT INTO event_vendors (event_id, application_id, business_name, contact_name, email, website_social, categories, status, logo_url, notes)
  VALUES (v_event, r.application_id, r.business_name, trim(r.first_name || ' ' || r.last_name), r.email,
          nullif(concat_ws(' · ', r.website, r.social), ''), '{}', 'confirmed', r.logo_url, left(r.products, 500))
  ON CONFLICT (event_id, business_name) DO UPDATE SET
    application_id = coalesce(EXCLUDED.application_id, event_vendors.application_id),
    contact_name = EXCLUDED.contact_name, email = EXCLUDED.email,
    website_social = coalesce(EXCLUDED.website_social, event_vendors.website_social),
    logo_url = coalesce(EXCLUDED.logo_url, event_vendors.logo_url),
    status = CASE WHEN event_vendors.status IN ('invited', 'cancelled', 'no_show') THEN 'confirmed' ELSE event_vendors.status END
  RETURNING id INTO v_id;

  UPDATE vendor_registrations SET lineup_id = v_id, event_id = v_event, status = CASE WHEN status = 'new' THEN 'confirmed' ELSE status END,
    reviewed_by = auth.uid(), reviewed_at = now()
   WHERE id = p_registration;
  RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.registration_to_lineup(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.registration_to_lineup(UUID, UUID) TO authenticated;

-- "I am in for the next market": invite the business into a lineup straight from the survey.
CREATE OR REPLACE FUNCTION public.feedback_to_lineup(p_feedback UUID, p_event UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE f RECORD; v_id UUID; v_app UUID;
BEGIN
  IF NOT (public.is_academy_admin() OR public.is_operator()) THEN RAISE EXCEPTION 'Team only.'; END IF;
  SELECT * INTO f FROM vendor_feedback WHERE id = p_feedback;
  IF f.id IS NULL THEN RAISE EXCEPTION 'Survey answer not found.'; END IF;
  IF p_event IS NULL THEN RAISE EXCEPTION 'Pick the market to invite them to.'; END IF;
  IF f.email IS NOT NULL THEN SELECT id INTO v_app FROM vendor_applications WHERE lower(email) = lower(f.email) ORDER BY created_at DESC LIMIT 1; END IF;

  INSERT INTO event_vendors (event_id, application_id, business_name, email, categories, status, notes)
  VALUES (p_event, v_app, f.business_name, f.email, '{}', 'invited', 'From the feedback survey: ' || f.market_label)
  ON CONFLICT (event_id, business_name) DO UPDATE SET email = coalesce(EXCLUDED.email, event_vendors.email)
  RETURNING id INTO v_id;

  UPDATE vendor_feedback SET lineup_id = v_id WHERE id = p_feedback;
  RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.feedback_to_lineup(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.feedback_to_lineup(UUID, UUID) TO authenticated;

-- The public lineup now carries each logo (the return type changes, so the function is rebuilt).
DROP FUNCTION IF EXISTS public.event_lineup(UUID);
CREATE FUNCTION public.event_lineup(p_event UUID)
RETURNS TABLE (business_name TEXT, website_social TEXT, categories TEXT[], booth TEXT, logo_url TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT v.business_name, v.website_social, v.categories, v.booth, v.logo_url
  FROM event_vendors v JOIN market_events e ON e.id = v.event_id
  WHERE v.event_id = p_event AND e.lineup_public AND e.is_active AND v.is_public
    AND v.status IN ('confirmed', 'paid', 'checked_in')
  ORDER BY v.booth NULLS LAST, v.business_name;
$fn$;
GRANT EXECUTE ON FUNCTION public.event_lineup(UUID) TO anon, authenticated;

-- ──────────────────────────────────────────────────────────
-- 9. A market can announce its month before the day is set
--    (Systems -> Markets & events -> "Announce the month"; the site then
--    reads "December · date coming soon" instead of "Coming soon")
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.market_events ADD COLUMN IF NOT EXISTS month_public BOOLEAN NOT NULL DEFAULT false;

-- ──────────────────────────────────────────────────────────
-- 10. The December event is the Business and Leadership Luncheon
--     Saturday December 19 2026, 1:30 PM, The Four Event Center; tickets on Eventbrite.
--     The date is announced (date_public), so the site shows it in full.
-- ──────────────────────────────────────────────────────────
UPDATE public.market_events
   SET title = 'Business and Leadership Luncheon',
       event_date = DATE '2026-12-19',
       start_time = '1:30 PM',
       venue = 'The Four Event Center',
       address = '8599 Roswell Rd, Suite B, Atlanta, GA 30350',
       description = 'An afternoon for women in business and leadership, rooted in faith and inspired by the Proverbs 31 woman: connection, encouragement, leadership tips and business moves. Open to business owners, aspiring entrepreneurs and anyone ready to start. Your ticket includes a seated meal; business casual attire.',
       rsvp_url = 'https://www.eventbrite.com/e/proverbs-31-business-leadership-luncheon-tickets-2002850002272',
       date_public = true,
       month_public = true,
       is_active = true
 WHERE title IN ('Winter Gala', 'Business and Leadership Luncheon');

-- ──────────────────────────────────────────────────────────
-- 11. New site paths are not available as shop links
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.curator_data DROP CONSTRAINT IF EXISTS slug_not_reserved;
ALTER TABLE public.curator_data ADD CONSTRAINT slug_not_reserved CHECK (
  slug NOT IN ('about', 'directory', 'login', 'dashboard', 'visionary', 'apply', 'community', 'register', 'onboarding-exclusive',
    'shop', 'calendar', 'services', 'partner', 'favorites', 'unsubscribe', 'systems', 'mentorship', 'portal', 'enroll', 'academy',
    'studio', 'verify', 'join', 'today', 'vendors', 'volunteer', 'assets', 'icons', 'fonts', 'c')
) NOT VALID;
