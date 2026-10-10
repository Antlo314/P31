/* ============================================================
   P31 — v27: "Join P31 Collective" applications + booking throttle
   Run after v26. Safe to run more than once.

   1. collective_applications: the P31 Collective membership form,
      built into thep31collective.org/join. Applicants submit through
      submit_collective_application() (bot trap, rate limits, checks);
      only admins and Systems operators can read or review them.
      Every application also lands in the CRM.
   2. crm_log_booking: caps how many Calendly bookings can be logged
      in 10 minutes, so a script can't flood the CRM with fakes.
   ============================================================ */

-- 1. Applications
CREATE TABLE IF NOT EXISTS public.collective_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  business_name TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city_state TEXT NOT NULL,
  birthday TEXT NOT NULL,
  socials TEXT,
  heard_from TEXT NOT NULL,
  business_description TEXT,
  inspiration TEXT,
  growth_areas TEXT[] NOT NULL DEFAULT '{}',
  interests TEXT[] NOT NULL DEFAULT '{}',
  agreed BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'approved', 'waitlist', 'declined')),
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collective_applications_created_idx ON public.collective_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS collective_applications_email_idx ON public.collective_applications (lower(email));

ALTER TABLE public.collective_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team reads applications" ON public.collective_applications;
CREATE POLICY "Team reads applications" ON public.collective_applications FOR SELECT TO authenticated
  USING (public.is_academy_admin() OR public.is_operator());
DROP POLICY IF EXISTS "Team reviews applications" ON public.collective_applications;
CREATE POLICY "Team reviews applications" ON public.collective_applications FOR UPDATE TO authenticated
  USING (public.is_academy_admin() OR public.is_operator())
  WITH CHECK (public.is_academy_admin() OR public.is_operator());
-- No insert policy: applications come in only through submit_collective_application().

CREATE OR REPLACE FUNCTION public.submit_collective_application(p JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_email TEXT := lower(trim(coalesce(p->>'email', '')));
  v_name TEXT := trim(coalesce(p->>'full_name', ''));
  v_phone TEXT := trim(coalesce(p->>'phone', ''));
  v_heard TEXT := trim(coalesce(p->>'heard_from', ''));
  v_growth TEXT[];
  v_interests TEXT[];
  v_id UUID;
  c_heard CONSTANT TEXT[] := ARRAY['P31 Vendor', 'P31 Panelist', 'P31 Collective Member', 'Social Media'];
  c_growth CONSTANT TEXT[] := ARRAY['Business Development', 'Marketing', 'Networking', 'Leadership', 'Accountability',
    'Faith/Obedience', 'Personal Growth/Purpose', 'Healthy Lifestyle', 'Public Speaking'];
  c_interests CONSTANT TEXT[] := ARRAY['Private Faith-Based Mentorship', 'Healthy Lifestyle Coaching', 'Marketing Strategy Coaching',
    'P31 Marketplace virtual storefront', 'Not right now'];
BEGIN
  IF coalesce(p->>'trap', '') <> '' THEN RETURN true; END IF;              -- bot: pretend it worked

  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO v_growth FROM jsonb_array_elements_text(coalesce(p->'growth_areas', '[]')) x WHERE x = ANY (c_growth);
  SELECT coalesce(array_agg(DISTINCT x), '{}') INTO v_interests FROM jsonb_array_elements_text(coalesce(p->'interests', '[]')) x WHERE x = ANY (c_interests);

  IF length(v_name) < 2 THEN RAISE EXCEPTION 'Please add your first and last name.'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Please add a valid email address.'; END IF;
  IF length(regexp_replace(v_phone, '\D', '', 'g')) < 7 THEN RAISE EXCEPTION 'Please add a phone number we can reach you at.'; END IF;
  IF length(trim(coalesce(p->>'city_state', ''))) < 2 THEN RAISE EXCEPTION 'Please add your city and state.'; END IF;
  IF length(trim(coalesce(p->>'birthday', ''))) < 3 THEN RAISE EXCEPTION 'Please add your birthday (month and day).'; END IF;
  IF NOT (v_heard = ANY (c_heard) OR (v_heard LIKE 'Other:%' AND length(v_heard) > 7)) THEN
    RAISE EXCEPTION 'Please tell us how you found our community.';
  END IF;
  IF cardinality(v_growth) NOT BETWEEN 1 AND 4 THEN RAISE EXCEPTION 'Choose up to 4 areas you hope to grow in.'; END IF;
  IF cardinality(v_interests) < 1 THEN RAISE EXCEPTION 'Choose what you would be interested in (or “Not right now”).'; END IF;
  IF coalesce((p->>'agreed')::boolean, false) IS NOT TRUE THEN RAISE EXCEPTION 'Please agree to the membership terms to apply.'; END IF;

  IF EXISTS (SELECT 1 FROM collective_applications WHERE lower(email) = v_email AND created_at > now() - interval '10 minutes') THEN
    RETURN true;                                                            -- double submit
  END IF;
  IF (SELECT count(*) FROM collective_applications WHERE created_at > now() - interval '1 hour') > 60 THEN
    RAISE EXCEPTION 'We''re getting a lot of applications right now. Please try again shortly.';
  END IF;

  INSERT INTO collective_applications (full_name, business_name, email, phone, city_state, birthday, socials, heard_from,
    business_description, inspiration, growth_areas, interests, agreed, user_id, source)
  VALUES (left(v_name, 120), left(nullif(trim(coalesce(p->>'business_name', '')), ''), 160), v_email, left(v_phone, 40),
    left(trim(p->>'city_state'), 120), left(trim(p->>'birthday'), 20), left(nullif(trim(coalesce(p->>'socials', '')), ''), 300),
    left(v_heard, 160), left(nullif(trim(coalesce(p->>'business_description', '')), ''), 2000),
    left(nullif(trim(coalesce(p->>'inspiration', '')), ''), 2000), v_growth, v_interests, true, auth.uid(),
    left(nullif(trim(coalesce(p->>'source', '')), ''), 60))
  RETURNING id INTO v_id;

  PERFORM public.crm_add(v_email, v_name, v_phone, auth.uid(), 'collective_application', 'Applied to join P31 Collective',
    jsonb_build_object('business', p->>'business_name', 'city', p->>'city_state', 'heard_from', v_heard,
      'growth', v_growth, 'interests', v_interests), 'join form', 'prospect', v_id::text);
  RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.submit_collective_application(JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_collective_application(JSONB) TO anon, authenticated;

-- 2. Calendly bookings: same function, plus a 10-minute cap.
CREATE OR REPLACE FUNCTION public.crm_log_booking(p_kind TEXT, p_event_uri TEXT, p_invitee_uri TEXT,
                                                  p_name TEXT DEFAULT NULL, p_email TEXT DEFAULT NULL, p_page TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $fn$
DECLARE v_label TEXT;
BEGIN
  IF coalesce(p_invitee_uri, '') !~ '^https://api\.calendly\.com/' THEN RETURN; END IF;
  IF p_kind NOT IN ('intro', 'session', 'connect', 'unknown') THEN RETURN; END IF;
  IF (SELECT count(*) FROM crm_activities WHERE kind LIKE 'calendly\_%' AND occurred_at > now() - interval '10 minutes') >= 30 THEN
    RETURN;                                                                 -- far more than real bookings: ignore
  END IF;
  v_label := CASE p_kind WHEN 'intro' THEN 'Booked a mentorship intro call' WHEN 'session' THEN 'Booked a private mentorship session'
                         WHEN 'connect' THEN 'Booked a connect / collab call with Melanie' ELSE 'Booked a call' END;
  PERFORM public.crm_add(p_email, p_name, NULL, auth.uid(), 'calendly_' || p_kind, v_label,
    jsonb_build_object('event_uri', p_event_uri, 'invitee_uri', p_invitee_uri, 'page', left(p_page, 200)),
    'calendly', CASE WHEN p_kind = 'intro' THEN 'prospect' END, p_invitee_uri);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.crm_log_booking(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
