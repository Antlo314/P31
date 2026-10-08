/* ============================================================
   P31 — v22: CRM + Zoom classroom sessions
   Run after v21. Safe to run more than once.

   1. CRM: one contact per person (by email) with a timeline of
      everything they do — sign-ups, partnership requests, market
      RSVPs, intro calls, Calendly bookings, invites, enrollments,
      session joins, attendance, Zoom activity, certificates.
   2. Zoom: meetings created per session, host links kept private
      to mentors, one-tap "Join" that records attendance, and Zoom
      webhook events (who joined, for how long, recordings).
   ============================================================ */

-- ──────────────────────────────────────────────────────────
-- 1. CRM tables
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  full_name TEXT,
  phone TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sources TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  stage TEXT NOT NULL DEFAULT 'lead' CHECK (stage IN ('lead', 'prospect', 'member', 'alumni', 'partner', 'curator', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_email_key ON public.crm_contacts (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_contacts_activity_idx ON public.crm_contacts (last_activity_at DESC);

CREATE TABLE IF NOT EXISTS public.crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT,
  ref TEXT,                       -- de-duplication key (e.g. a Calendly invitee URI)
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_activities_contact_idx ON public.crm_activities (contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS crm_activities_kind_idx ON public.crm_activities (kind, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS crm_activities_ref_key ON public.crm_activities (kind, ref) WHERE ref IS NOT NULL;

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team reads contacts" ON public.crm_contacts;
CREATE POLICY "Team reads contacts" ON public.crm_contacts FOR SELECT TO authenticated USING (public.is_academy_admin());
DROP POLICY IF EXISTS "Team edits contacts" ON public.crm_contacts;
CREATE POLICY "Team edits contacts" ON public.crm_contacts FOR UPDATE TO authenticated
  USING (public.is_academy_admin()) WITH CHECK (public.is_academy_admin());
DROP POLICY IF EXISTS "Team removes contacts" ON public.crm_contacts;
CREATE POLICY "Team removes contacts" ON public.crm_contacts FOR DELETE TO authenticated USING (public.is_academy_admin());
DROP POLICY IF EXISTS "Team reads activity" ON public.crm_activities;
CREATE POLICY "Team reads activity" ON public.crm_activities FOR SELECT TO authenticated USING (public.is_academy_admin());
DROP POLICY IF EXISTS "Team adds notes" ON public.crm_activities;
CREATE POLICY "Team adds notes" ON public.crm_activities FOR INSERT TO authenticated
  WITH CHECK (public.is_academy_admin() AND kind = 'note');

-- Find or create the contact for an email (or a signed-in user), and freshen what we know.
CREATE OR REPLACE FUNCTION public.crm_touch(p_email TEXT, p_name TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL,
                                            p_user UUID DEFAULT NULL, p_source TEXT DEFAULT NULL, p_stage TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT := lower(nullif(trim(p_email), ''));
  v_id UUID;
  v_rank JSONB := '{"lead":0,"other":0,"prospect":1,"curator":2,"partner":2,"alumni":3,"member":4}';
BEGIN
  IF v_email IS NULL AND p_user IS NOT NULL THEN SELECT lower(email) INTO v_email FROM auth.users WHERE id = p_user; END IF;
  IF v_email IS NULL THEN RETURN NULL; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM crm_contacts WHERE lower(email) = v_email;
  IF v_id IS NULL THEN
    INSERT INTO crm_contacts (email, full_name, phone, user_id, sources, stage)
    VALUES (v_email, nullif(trim(p_name), ''), nullif(trim(p_phone), ''), p_user,
            CASE WHEN p_source IS NULL THEN '{}' ELSE ARRAY[p_source] END, coalesce(p_stage, 'lead'))
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN SELECT id INTO v_id FROM crm_contacts WHERE lower(email) = v_email; END IF;
  ELSE
    UPDATE crm_contacts SET
      full_name = coalesce(full_name, nullif(trim(p_name), '')),
      phone = coalesce(phone, nullif(trim(p_phone), '')),
      user_id = coalesce(user_id, p_user),
      sources = CASE WHEN p_source IS NULL OR p_source = ANY (sources) THEN sources ELSE sources || p_source END,
      stage = CASE WHEN p_stage IS NOT NULL AND coalesce((v_rank->>p_stage)::int, 0) >= coalesce((v_rank->>stage)::int, 0) THEN p_stage ELSE stage END,
      last_activity_at = now()
    WHERE id = v_id;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.crm_touch(TEXT, TEXT, TEXT, UUID, TEXT, TEXT) FROM public, anon, authenticated;

-- Record something a contact did.
CREATE OR REPLACE FUNCTION public.crm_add(p_email TEXT, p_name TEXT, p_phone TEXT, p_user UUID, p_kind TEXT, p_title TEXT,
                                          p_detail JSONB DEFAULT '{}'::jsonb, p_source TEXT DEFAULT NULL, p_stage TEXT DEFAULT NULL,
                                          p_ref TEXT DEFAULT NULL, p_at TIMESTAMPTZ DEFAULT now())
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE v_contact UUID;
BEGIN
  v_contact := public.crm_touch(p_email, p_name, p_phone, p_user, p_source, p_stage);
  INSERT INTO crm_activities (contact_id, kind, title, detail, source, ref, occurred_at)
  VALUES (v_contact, p_kind, p_title, coalesce(p_detail, '{}'::jsonb), p_source, p_ref, coalesce(p_at, now()))
  ON CONFLICT DO NOTHING;
  RETURN v_contact;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'crm_add skipped: %', SQLERRM;  -- the CRM never blocks the real action
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.crm_add(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM public, anon, authenticated;

-- Calendly bookings, reported by the site when someone finishes booking.
CREATE OR REPLACE FUNCTION public.crm_log_booking(p_kind TEXT, p_event_uri TEXT, p_invitee_uri TEXT,
                                                  p_name TEXT DEFAULT NULL, p_email TEXT DEFAULT NULL, p_page TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE v_label TEXT;
BEGIN
  IF coalesce(p_invitee_uri, '') !~ '^https://api\.calendly\.com/' THEN RETURN; END IF;
  IF p_kind NOT IN ('intro', 'session', 'connect', 'unknown') THEN RETURN; END IF;
  v_label := CASE p_kind WHEN 'intro' THEN 'Booked a mentorship intro call' WHEN 'session' THEN 'Booked a private mentorship session'
                         WHEN 'connect' THEN 'Booked a connect / collab call with Melanie' ELSE 'Booked a call' END;
  PERFORM public.crm_add(p_email, p_name, NULL, auth.uid(), 'calendly_' || p_kind, v_label,
    jsonb_build_object('event_uri', p_event_uri, 'invitee_uri', p_invitee_uri, 'page', left(p_page, 200)),
    'calendly', CASE WHEN p_kind = 'intro' THEN 'prospect' END, p_invitee_uri);
END;
$$;
GRANT EXECUTE ON FUNCTION public.crm_log_booking(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- A contact's whole story, newest first.
CREATE OR REPLACE FUNCTION public.crm_timeline(p_contact UUID)
RETURNS SETOF public.crm_activities LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM crm_activities WHERE public.is_academy_admin() AND contact_id = p_contact ORDER BY occurred_at DESC LIMIT 500;
$$;
REVOKE ALL ON FUNCTION public.crm_timeline(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crm_timeline(UUID) TO authenticated;


-- ──────────────────────────────────────────────────────────
-- 2. Zoom sessions
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.academy_sessions
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT;
CREATE INDEX IF NOT EXISTS academy_sessions_zoom_idx ON public.academy_sessions (zoom_meeting_id);

-- Host ("start") links open the meeting as host, so only mentors can see them.
CREATE TABLE IF NOT EXISTS public.academy_session_hosts (
  session_id UUID PRIMARY KEY REFERENCES public.academy_sessions(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  start_url TEXT,
  passcode TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_session_hosts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Mentors only hosts" ON public.academy_session_hosts;
CREATE POLICY "Mentors only hosts" ON public.academy_session_hosts FOR SELECT TO authenticated USING (public.is_mentor(program_id));

-- Everything Zoom tells us about a meeting.
CREATE TABLE IF NOT EXISTS public.academy_meeting_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.academy_sessions(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  zoom_meeting_id TEXT,
  event TEXT NOT NULL,
  participant_name TEXT,
  participant_email TEXT,
  user_id UUID,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_seconds INT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS academy_meeting_events_session_idx ON public.academy_meeting_events (session_id, at);
ALTER TABLE public.academy_meeting_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Mentors read meeting events" ON public.academy_meeting_events;
CREATE POLICY "Mentors read meeting events" ON public.academy_meeting_events FOR SELECT TO authenticated
  USING (program_id IS NOT NULL AND public.is_mentor(program_id));

-- Every tap on "Join": who, when — the most reliable attendance signal.
CREATE TABLE IF NOT EXISTS public.academy_session_joins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.academy_sessions(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS academy_session_joins_session_idx ON public.academy_session_joins (session_id, user_id);
ALTER TABLE public.academy_session_joins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own joins and mentors" ON public.academy_session_joins;
CREATE POLICY "Own joins and mentors" ON public.academy_session_joins FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_mentor(program_id));

-- "Join" button: logs the join, marks attendance (present, or late after 10 minutes), returns the link.
CREATE OR REPLACE FUNCTION public.academy_join_session(p_session UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  s academy_sessions%ROWTYPE;
  v_mentor BOOLEAN;
  v_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO s FROM academy_sessions WHERE id = p_session;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  v_mentor := public.is_mentor(s.program_id);
  IF NOT v_mentor AND NOT (public.has_academy_access(s.program_id) AND (s.student_id IS NULL OR s.student_id = auth.uid())) THEN
    RAISE EXCEPTION 'This session isn''t yours';
  END IF;
  IF s.join_url IS NULL THEN RAISE EXCEPTION 'No join link yet'; END IF;
  v_end := s.starts_at + make_interval(mins => coalesce(s.duration_minutes, 60));
  IF NOT v_mentor THEN
    INSERT INTO academy_session_joins (session_id, program_id, user_id) VALUES (s.id, s.program_id, auth.uid());
    IF now() BETWEEN s.starts_at - interval '20 minutes' AND v_end THEN
      INSERT INTO academy_attendance (session_id, user_id, program_id, status, note)
      VALUES (s.id, auth.uid(), s.program_id, CASE WHEN now() > s.starts_at + interval '10 minutes' THEN 'late' ELSE 'present' END, 'Joined from the classroom')
      ON CONFLICT (session_id, user_id) DO NOTHING;
    END IF;
    PERFORM public.crm_add(NULL, NULL, NULL, auth.uid(), 'session_joined', 'Joined “' || s.title || '”',
      jsonb_build_object('session_id', s.id, 'starts_at', s.starts_at, 'program', public.academy_slug(s.program_id)), 'classroom', 'member');
  END IF;
  RETURN s.join_url;
END;
$$;
REVOKE ALL ON FUNCTION public.academy_join_session(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.academy_join_session(UUID) TO authenticated;


-- ──────────────────────────────────────────────────────────
-- 3. Feed the CRM from everything that already happens
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crm_capture()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE j JSONB := to_jsonb(NEW);
BEGIN
  CASE TG_TABLE_NAME
  WHEN 'leads' THEN
    PERFORM public.crm_add(j->>'email', j->>'full_name', j->>'phone', NULL, 'subscribed', 'Joined the collective list',
      jsonb_build_object('source', j->>'source'), coalesce(j->>'source', 'site'));
  WHEN 'partnerships' THEN
    PERFORM public.crm_add(j->>'email', j->>'full_name', j->>'phone', NULL, 'partnership_request', 'Sent a partnership request',
      jsonb_build_object('type', j->>'partnership_type', 'message', left(j->>'message', 500)), 'partner page', 'partner');
  WHEN 'event_registrations' THEN
    PERFORM public.crm_add(j->>'email', j->>'full_name', NULL, NULL, 'market_rsvp', 'RSVP’d to a market',
      jsonb_build_object('event_id', j->>'event_id', 'guests', j->>'guests', 'status', j->>'status'), 'calendar');
  WHEN 'academy_inquiries' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.crm_add(j->>'email', j->>'full_name', j->>'phone', NULL, 'intro_request', 'Requested a mentorship intro call',
        jsonb_build_object('program', public.academy_slug((j->>'program_id')::uuid), 'times', j->>'preferred_times', 'message', left(j->>'message', 500)),
        'mentorship form', 'prospect');
    ELSE
      PERFORM public.crm_add(j->>'email', NULL, NULL, NULL, 'intro_status', 'Intro call marked ' || replace(j->>'status', '_', ' '),
        jsonb_build_object('status', j->>'status'), 'mentor');
    END IF;
  WHEN 'academy_invites' THEN
    PERFORM public.crm_add(j->>'email', j->>'full_name', NULL, NULL, 'invite_sent', 'Sent a private enrollment link',
      jsonb_build_object('program', public.academy_slug((j->>'program_id')::uuid)), 'mentor', 'prospect');
  WHEN 'academy_enrollments' THEN
    PERFORM public.crm_add(NULL, NULL, NULL, (j->>'user_id')::uuid,
      CASE WHEN TG_OP = 'INSERT' THEN 'enrolled' ELSE 'membership_' || (j->>'status') END,
      CASE WHEN TG_OP = 'INSERT' THEN 'Enrolled in the ' || coalesce((SELECT title FROM academy_programs WHERE id = (j->>'program_id')::uuid), 'mentorship')
           ELSE 'Membership is now ' || replace(j->>'status', '_', ' ') END,
      jsonb_build_object('program', public.academy_slug((j->>'program_id')::uuid), 'status', j->>'status', 'source', j->>'source'),
      'enrollment', CASE WHEN j->>'status' IN ('active', 'past_due') THEN 'member' WHEN j->>'status' IN ('canceled', 'expired') THEN 'alumni' END);
  WHEN 'academy_attendance' THEN
    PERFORM public.crm_add(NULL, NULL, NULL, (j->>'user_id')::uuid, 'attendance', 'Session attendance: ' || (j->>'status'),
      jsonb_build_object('session_id', j->>'session_id', 'status', j->>'status'), 'classroom', NULL,
      'att:' || (j->>'session_id') || ':' || (j->>'status'));
  WHEN 'academy_certificates' THEN
    PERFORM public.crm_add(NULL, NULL, NULL, (j->>'user_id')::uuid, 'certificate', 'Earned “' || (j->>'title') || '”',
      jsonb_build_object('serial', j->>'serial', 'program', public.academy_slug((j->>'program_id')::uuid)), 'classroom', 'alumni');
  ELSE NULL;
  END CASE;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'crm_capture skipped: %', SQLERRM;
  RETURN NULL;
END;
$$;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads', 'partnerships', 'event_registrations', 'academy_invites', 'academy_certificates'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS crm_capture ON public.%I', t);
      EXECUTE format('CREATE TRIGGER crm_capture AFTER INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.crm_capture()', t);
    END IF;
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS crm_capture ON public.academy_inquiries;
CREATE TRIGGER crm_capture AFTER INSERT OR UPDATE OF status ON public.academy_inquiries FOR EACH ROW EXECUTE FUNCTION public.crm_capture();
DROP TRIGGER IF EXISTS crm_capture ON public.academy_enrollments;
CREATE TRIGGER crm_capture AFTER INSERT OR UPDATE OF status ON public.academy_enrollments FOR EACH ROW EXECUTE FUNCTION public.crm_capture();
DROP TRIGGER IF EXISTS crm_capture ON public.academy_attendance;
CREATE TRIGGER crm_capture AFTER INSERT OR UPDATE OF status ON public.academy_attendance FOR EACH ROW EXECUTE FUNCTION public.crm_capture();

-- Bring in everyone we already know (only the first time — when the CRM is empty).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.crm_contacts) THEN RETURN; END IF;
  IF to_regclass('public.leads') IS NOT NULL THEN
    PERFORM public.crm_add(email, full_name, phone, NULL, 'subscribed', 'Joined the collective list', '{}'::jsonb, 'site', NULL, NULL, created_at) FROM public.leads;
  END IF;
  IF to_regclass('public.partnerships') IS NOT NULL THEN
    PERFORM public.crm_add(email, full_name, phone, NULL, 'partnership_request', 'Sent a partnership request',
      jsonb_build_object('type', partnership_type), 'partner page', 'partner', NULL, created_at) FROM public.partnerships;
  END IF;
  IF to_regclass('public.event_registrations') IS NOT NULL THEN
    PERFORM public.crm_add(email, full_name, NULL, NULL, 'market_rsvp', 'RSVP’d to a market', '{}'::jsonb, 'calendar', NULL, NULL, created_at)
    FROM public.event_registrations;
  END IF;
  PERFORM public.crm_add(email, full_name, phone, NULL, 'intro_request', 'Requested a mentorship intro call', '{}'::jsonb, 'mentorship form', 'prospect', NULL, created_at)
  FROM public.academy_inquiries;
  PERFORM public.crm_add(NULL, NULL, NULL, user_id, 'enrolled', 'Enrolled', jsonb_build_object('status', status), 'enrollment',
    CASE WHEN status IN ('active', 'past_due') THEN 'member' ELSE 'alumni' END, NULL, started_at)
  FROM public.academy_enrollments;
END $$;

-- ──────────────────────────────────────────────────────────
-- 4. Helpers for the Zoom webhook (server only)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crm_user_by_email(p_email TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$ SELECT id FROM auth.users WHERE lower(email) = lower(trim(p_email)) LIMIT 1; $$;
REVOKE ALL ON FUNCTION public.crm_user_by_email(TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_user_by_email(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.crm_zoom_event(p_email TEXT, p_name TEXT, p_kind TEXT, p_title TEXT, p_detail JSONB)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.crm_add(p_email, p_name, NULL, NULL, p_kind, p_title, p_detail, 'zoom'); $$;
REVOKE ALL ON FUNCTION public.crm_zoom_event(TEXT, TEXT, TEXT, TEXT, JSONB) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_zoom_event(TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_add(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_touch(TEXT, TEXT, TEXT, UUID, TEXT, TEXT) TO service_role;
