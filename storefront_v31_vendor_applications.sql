/* ============================================================
   P31 — v31: vendor applications for the Proverbs 31 Market
   Run after v30. Safe to run more than once.

   The vendor interest form now lives on p31market.com/apply in the
   site design (same questions as the Google Form). Applicants submit
   through submit_vendor_application() (bot trap, rate limits, checks).
   Only admins and Systems operators can read or review them
   (Systems, Market, Vendor applications). Each applicant also lands in
   the CRM. The join-notify function emails the team and adds a row to
   the vendor Google Sheet, once per application (notified_at and
   sheet_synced_at record that).
   ============================================================ */

CREATE TABLE IF NOT EXISTS public.vendor_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  serious TEXT NOT NULL CHECK (serious IN ('Yes', 'No')),
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  business_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  website_social TEXT NOT NULL,
  referred_by TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  agreed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'approved', 'waitlist', 'declined')),
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source TEXT,
  notified_at TIMESTAMPTZ,
  sheet_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_applications_created_idx ON public.vendor_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS vendor_applications_email_idx ON public.vendor_applications (lower(email));

ALTER TABLE public.vendor_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team reads vendor applications" ON public.vendor_applications;
CREATE POLICY "Team reads vendor applications" ON public.vendor_applications FOR SELECT TO authenticated
  USING (public.is_academy_admin() OR public.is_operator());
DROP POLICY IF EXISTS "Team reviews vendor applications" ON public.vendor_applications;
CREATE POLICY "Team reviews vendor applications" ON public.vendor_applications FOR UPDATE TO authenticated
  USING (public.is_academy_admin() OR public.is_operator())
  WITH CHECK (public.is_academy_admin() OR public.is_operator());
-- No insert policy: applications come in only through submit_vendor_application().

CREATE OR REPLACE FUNCTION public.submit_vendor_application(p JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_email TEXT := lower(trim(coalesce(p->>'email', '')));
  v_name TEXT := trim(coalesce(p->>'full_name', ''));
  v_phone TEXT := trim(coalesce(p->>'phone', ''));
  v_serious TEXT := trim(coalesce(p->>'serious', ''));
  v_business TEXT := trim(coalesce(p->>'business_name', ''));
  v_social TEXT := trim(coalesce(p->>'website_social', ''));
  v_cats TEXT[];
  v_other TEXT;
  v_id UUID;
  c_cats CONSTANT TEXT[] := ARRAY['Natural body care products', 'Apparel, Accessories, Jewelry (no on-site piercing)',
    'Wellness goods, Tea blends, Herbs (pre-packaged only)', 'Art, Painting, Photography',
    'Professional Services (Home, Health Care, Legal, Financial, Travel, Educational)', 'Baked goods, Wrapped candies & treats',
    'Candles & Home fragrance', 'Handmade crafts, baskets & gifts', 'Pet products (no pets allowed; indoor event)',
    'Coaching, Books, Journals, Devotionals (Self-written)', 'Crafts, Home décor (non-electrical)',
    'Plants (non-toxic, potted only)', 'Make-up Artist'];
BEGIN
  IF coalesce(p->>'trap', '') <> '' THEN RETURN true; END IF;              -- bot: pretend it worked

  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO v_cats FROM jsonb_array_elements_text(coalesce(p->'categories', '[]')) x WHERE x = ANY (c_cats);
  v_other := left(nullif(trim(coalesce(p->>'category_other', '')), ''), 120);
  IF v_other IS NOT NULL THEN v_cats := v_cats || ('Other: ' || v_other); END IF;

  IF v_serious NOT IN ('Yes', 'No') THEN RAISE EXCEPTION 'Please answer whether you are serious about joining this community.'; END IF;
  IF length(v_name) < 2 THEN RAISE EXCEPTION 'Please add your full name.'; END IF;
  IF length(v_business) < 2 THEN RAISE EXCEPTION 'Please add your business or brand name.'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Please add a valid email address.'; END IF;
  IF length(regexp_replace(v_phone, '\D', '', 'g')) < 7 THEN RAISE EXCEPTION 'Please add a phone number we can reach you at.'; END IF;
  IF length(v_social) < 2 THEN RAISE EXCEPTION 'Please add your website or social media handle.'; END IF;
  IF cardinality(v_cats) NOT BETWEEN 1 AND 2 THEN RAISE EXCEPTION 'Choose up to 2 categories that describe what you sell or offer.'; END IF;
  IF coalesce((p->>'agreed')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'Please agree to the vendor terms to apply.'; END IF;

  IF EXISTS (SELECT 1 FROM vendor_applications WHERE lower(email) = v_email AND created_at > now() - interval '10 minutes') THEN
    RETURN true;                                                            -- double submit
  END IF;
  IF (SELECT count(*) FROM vendor_applications WHERE created_at > now() - interval '1 hour') > 60 THEN
    RAISE EXCEPTION 'We are getting a lot of applications right now. Please try again shortly.';
  END IF;

  INSERT INTO vendor_applications (serious, full_name, business_name, email, phone, website_social, referred_by,
    categories, notes, agreed, user_id, source)
  VALUES (v_serious, left(v_name, 120), left(v_business, 160), v_email, left(v_phone, 40), left(v_social, 500),
    left(nullif(trim(coalesce(p->>'referred_by', '')), ''), 120), v_cats,
    left(nullif(trim(coalesce(p->>'notes', '')), ''), 2000), true, auth.uid(),
    left(nullif(trim(coalesce(p->>'source', '')), ''), 60))
  RETURNING id INTO v_id;

  PERFORM public.crm_add(v_email, v_name, v_phone, auth.uid(), 'vendor_application', 'Applied to vend at the Proverbs 31 Market',
    jsonb_build_object('business', v_business, 'social', v_social, 'categories', v_cats, 'referred_by', p->>'referred_by'),
    'vendor form', 'prospect', v_id::text);
  RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.submit_vendor_application(JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_vendor_application(JSONB) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS vendor_applications_unnotified_idx
  ON public.vendor_applications (created_at) WHERE notified_at IS NULL;
CREATE INDEX IF NOT EXISTS vendor_applications_unsynced_idx
  ON public.vendor_applications (created_at) WHERE sheet_synced_at IS NULL;
