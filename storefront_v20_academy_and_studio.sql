/* ==========================================================
   P31 MARKETPLACE — V20: MENTORSHIP ACADEMY & CONTENT STUDIO
   Run in the Supabase SQL Editor after v19. Safe to re-run.

   1. Programs (Business, Faith) and PRIVATE plans/prices —
      prices are never publicly readable.
   2. Mentors (per program) and Content Studio seats (max 3).
   3. Intro-call requests (public form, rate-limited, bot trap).
   4. Private enrollment invites sent after an intro call.
   5. Enrollments (written only by the server / admins).
   6. Classroom: modules, lessons, downloadable resources,
      announcements, live sessions, progress, mentor messages.
   7. Student tools: business goals, faith journal.
   8. Private "academy" storage bucket for PDFs and files.
   9. my_roles(): which dashboards a signed-in person can open.
  10. Private 1:1 mentorship: per-student sessions & notes,
      action plans with checkable next steps, and materials
      submitted for the mentor's feedback.
   ========================================================== */


-- ──────────────────────────────────────────────────────────
-- 0. Who runs the academy: P31 admins and Systems operators
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_academy_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT public.is_admin()
      OR (to_regclass('public.system_operators') IS NOT NULL AND EXISTS (SELECT 1 FROM system_operators WHERE user_id = auth.uid()));
$$;


-- ──────────────────────────────────────────────────────────
-- 1. Programs and plans
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  title TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Programs are public" ON public.academy_programs;
CREATE POLICY "Programs are public" ON public.academy_programs FOR SELECT USING (is_active OR public.is_academy_admin());
DROP POLICY IF EXISTS "Admins manage programs" ON public.academy_programs;
CREATE POLICY "Admins manage programs" ON public.academy_programs FOR ALL TO authenticated
  USING (public.is_academy_admin()) WITH CHECK (public.is_academy_admin());

INSERT INTO public.academy_programs (slug, title, tagline, description, sort_order) VALUES
  ('business', 'Business Mentorship', 'Build it right. Steward it well. Prosper with purpose.',
   'One-on-one and group mentorship for women building a business the Kingdom way — strategy, branding, pricing, sales and the systems that let your gifts make room.', 1),
  ('faith', 'Faith-Based Mentorship', 'Rooted in the Word. Walking in purpose.',
   'Mentorship for women who want to grow in faith, identity and calling — study, prayer, reflection and community alongside a mentor who walks with you.', 2)
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.academy_program_id(p_slug TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT id FROM academy_programs WHERE slug = p_slug; $$;

-- Plans hold prices. NOT readable by the public — only admins and mentors.
CREATE TABLE IF NOT EXISTS public.academy_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  billing TEXT NOT NULL CHECK (billing IN ('week', 'month', 'six_months', 'one_time')),
  label TEXT NOT NULL,
  price_cents INT CHECK (price_cents IS NULL OR price_cents >= 50),
  access_days INT CHECK (access_days IS NULL OR access_days > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, billing)
);
ALTER TABLE public.academy_plans ENABLE ROW LEVEL SECURITY;

-- Seed: monthly prices as given ($250 business, $160 faith); the other plans
-- start unpriced (and so unavailable) until an admin sets them.
INSERT INTO public.academy_plans (program_id, billing, label, price_cents, access_days)
SELECT p.id, b.billing, b.label,
       CASE WHEN b.billing = 'month' THEN CASE p.slug WHEN 'business' THEN 25000 WHEN 'faith' THEN 16000 END END,
       CASE WHEN b.billing = 'one_time' THEN 30 END
FROM public.academy_programs p
CROSS JOIN (VALUES ('week', 'Weekly'), ('month', 'Monthly'), ('six_months', 'Every 6 months'), ('one_time', 'Pay as you go')) AS b(billing, label)
WHERE p.slug IN ('business', 'faith')
ON CONFLICT (program_id, billing) DO NOTHING;


-- ──────────────────────────────────────────────────────────
-- 2. Mentors and Content Studio seats
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_mentors (
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (program_id, user_id)
);
ALTER TABLE public.academy_mentors ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_mentor(p_program UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT public.is_academy_admin()
      OR EXISTS (SELECT 1 FROM academy_mentors WHERE program_id = p_program AND user_id = auth.uid());
$$;

DROP POLICY IF EXISTS "Mentors visible to their program" ON public.academy_mentors;
CREATE POLICY "Mentors visible to their program" ON public.academy_mentors FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_mentor(program_id) OR public.is_academy_admin());

DROP POLICY IF EXISTS "Admins and mentors read plans" ON public.academy_plans;
CREATE POLICY "Admins and mentors read plans" ON public.academy_plans FOR SELECT TO authenticated
  USING (public.is_mentor(program_id));
DROP POLICY IF EXISTS "Admins manage plans" ON public.academy_plans;
CREATE POLICY "Admins manage plans" ON public.academy_plans FOR UPDATE TO authenticated
  USING (public.is_academy_admin()) WITH CHECK (public.is_academy_admin());

CREATE TABLE IF NOT EXISTS public.studio_members (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.studio_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.guard_studio_seats()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM studio_members) >= 3 THEN
    RAISE EXCEPTION 'The Content Studio has 3 seats and all are taken. Remove someone first.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS studio_seat_limit ON public.studio_members;
CREATE TRIGGER studio_seat_limit BEFORE INSERT ON public.studio_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_studio_seats();

CREATE OR REPLACE FUNCTION public.is_studio_member()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT public.is_academy_admin() OR EXISTS (SELECT 1 FROM studio_members WHERE user_id = auth.uid());
$$;

-- (Uses the SECURITY DEFINER helper so the policy never re-reads its own table.)
DROP POLICY IF EXISTS "Studio members see the team" ON public.studio_members;
CREATE POLICY "Studio members see the team" ON public.studio_members FOR SELECT TO authenticated
  USING (public.is_studio_member());

-- Admin tools: add/remove mentors and studio seats by email.
CREATE OR REPLACE FUNCTION public.add_academy_mentor(p_email TEXT, p_program TEXT, p_title TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE v_user UUID; v_program UUID; v_name TEXT;
BEGIN
  IF NOT (public.is_academy_admin() OR public.is_trusted_writer()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT id, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1)) INTO v_user, v_name
    FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF v_user IS NULL THEN RETURN 'No account uses ' || p_email || ' yet — they need to sign up first.'; END IF;
  v_program := public.academy_program_id(p_program);
  IF v_program IS NULL THEN RETURN 'Unknown program: ' || p_program; END IF;
  INSERT INTO academy_mentors (program_id, user_id, display_name, title) VALUES (v_program, v_user, v_name, p_title)
    ON CONFLICT (program_id, user_id) DO UPDATE SET title = coalesce(EXCLUDED.title, academy_mentors.title);
  RETURN 'Added ' || p_email || ' as a mentor for ' || p_program || '.';
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_academy_mentor(p_user UUID, p_program TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  DELETE FROM academy_mentors WHERE user_id = p_user AND program_id = public.academy_program_id(p_program);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_studio_member(p_email TEXT, p_display_name TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE v_user UUID; v_name TEXT;
BEGIN
  IF NOT (public.is_academy_admin() OR public.is_trusted_writer()) THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT id, coalesce(p_display_name, raw_user_meta_data->>'full_name', split_part(email, '@', 1)) INTO v_user, v_name
    FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF v_user IS NULL THEN RETURN 'No account uses ' || p_email || ' yet — they need to sign up first.'; END IF;
  IF EXISTS (SELECT 1 FROM studio_members WHERE user_id = v_user) THEN RETURN p_email || ' already has a Studio seat.'; END IF;
  INSERT INTO studio_members (user_id, display_name) VALUES (v_user, v_name);
  RETURN 'Gave ' || p_email || ' a Content Studio seat.';
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_studio_member(p_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  DELETE FROM studio_members WHERE user_id = p_user;
END;
$$;


-- ──────────────────────────────────────────────────────────
-- 3. Intro-call requests (the only public way in)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.academy_programs(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  preferred_times TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'scheduled', 'enrolled', 'not_a_fit', 'closed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Mentors read their intro calls" ON public.academy_inquiries;
CREATE POLICY "Mentors read their intro calls" ON public.academy_inquiries FOR SELECT TO authenticated
  USING (public.is_academy_admin() OR (program_id IS NOT NULL AND public.is_mentor(program_id)));
DROP POLICY IF EXISTS "Mentors update their intro calls" ON public.academy_inquiries;
CREATE POLICY "Mentors update their intro calls" ON public.academy_inquiries FOR UPDATE TO authenticated
  USING (public.is_academy_admin() OR (program_id IS NOT NULL AND public.is_mentor(program_id)))
  WITH CHECK (public.is_academy_admin() OR (program_id IS NOT NULL AND public.is_mentor(program_id)));

CREATE OR REPLACE FUNCTION public.request_intro_call(
  p_program TEXT, p_name TEXT, p_email TEXT, p_phone TEXT, p_message TEXT, p_times TEXT, p_trap TEXT DEFAULT ''
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_email TEXT := lower(trim(p_email));
BEGIN
  IF coalesce(p_trap, '') <> '' THEN RETURN true; END IF;                 -- bot: pretend it worked
  IF length(trim(coalesce(p_name, ''))) < 2 OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Please add your name and a valid email.';
  END IF;
  IF EXISTS (SELECT 1 FROM academy_inquiries WHERE email = v_email AND created_at > now() - interval '10 minutes') THEN
    RETURN true;                                                          -- double submit
  END IF;
  IF (SELECT count(*) FROM academy_inquiries WHERE created_at > now() - interval '1 hour') > 60 THEN
    RAISE EXCEPTION 'We''re getting a lot of requests right now — please try again shortly.';
  END IF;
  INSERT INTO academy_inquiries (program_id, full_name, email, phone, message, preferred_times)
  VALUES (public.academy_program_id(p_program), left(trim(p_name), 120), v_email,
          left(nullif(trim(coalesce(p_phone, '')), ''), 40), left(nullif(trim(coalesce(p_message, '')), ''), 2000),
          left(nullif(trim(coalesce(p_times, '')), ''), 300));
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_intro_call(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;


-- ──────────────────────────────────────────────────────────
-- 4. Private enrollment invites (sent after the intro call)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.academy_plans(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  inquiry_id UUID REFERENCES public.academy_inquiries(id) ON DELETE SET NULL,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '14 days',
  used_at TIMESTAMPTZ,
  used_by UUID
);
ALTER TABLE public.academy_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Mentors manage invites" ON public.academy_invites;
CREATE POLICY "Mentors manage invites" ON public.academy_invites FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));

-- What the invitee sees on their private link (the only place a price is shown).
CREATE OR REPLACE FUNCTION public.academy_invite_details(p_token TEXT)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'program', p.slug, 'program_title', p.title, 'plan_label', pl.label, 'billing', pl.billing,
    'price_cents', pl.price_cents, 'access_days', pl.access_days, 'full_name', i.full_name,
    'email_hint', left(i.email, 2) || '•••@' || split_part(i.email, '@', 2),
    'expired', i.expires_at < now(), 'used', i.used_at IS NOT NULL,
    'available', pl.is_active AND pl.price_cents IS NOT NULL)
  FROM academy_invites i JOIN academy_plans pl ON pl.id = i.plan_id JOIN academy_programs p ON p.id = i.program_id
  WHERE i.token = p_token;
$$;
GRANT EXECUTE ON FUNCTION public.academy_invite_details(TEXT) TO anon, authenticated;


-- ──────────────────────────────────────────────────────────
-- 5. Enrollments — written by the payment webhook or admins only
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.academy_plans(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'expired')),
  source TEXT NOT NULL DEFAULT 'stripe' CHECK (source IN ('stripe', 'manual', 'comp')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_session_id TEXT UNIQUE,
  access_until TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, program_id)
);
ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "See own or taught enrollments" ON public.academy_enrollments;
CREATE POLICY "See own or taught enrollments" ON public.academy_enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_mentor(program_id));
-- No INSERT/UPDATE/DELETE policies: only the service role (webhook) and the RPCs below write here.

CREATE OR REPLACE FUNCTION public.has_academy_access(p_program UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT public.is_mentor(p_program) OR EXISTS (
    SELECT 1 FROM academy_enrollments e
    WHERE e.program_id = p_program AND e.user_id = auth.uid()
      AND ((e.access_until IS NULL AND e.status = 'active')
        OR (e.access_until > now() AND e.status IN ('active', 'past_due', 'canceled'))));
$$;

-- Admins can enroll someone who paid another way, or give a complimentary seat.
CREATE OR REPLACE FUNCTION public.academy_enroll_manual(p_email TEXT, p_program TEXT, p_days INT DEFAULT NULL, p_source TEXT DEFAULT 'manual')
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE v_user UUID; v_program UUID;
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_source NOT IN ('manual', 'comp') THEN RAISE EXCEPTION 'Source must be manual or comp'; END IF;
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(trim(p_email));
  IF v_user IS NULL THEN RETURN 'No account uses ' || p_email || ' yet — they need to sign up first.'; END IF;
  v_program := public.academy_program_id(p_program);
  IF v_program IS NULL THEN RETURN 'Unknown program: ' || p_program; END IF;
  INSERT INTO academy_enrollments (user_id, program_id, status, source, access_until)
  VALUES (v_user, v_program, 'active', p_source, CASE WHEN p_days IS NULL THEN NULL ELSE now() + make_interval(days => p_days) END)
  ON CONFLICT (user_id, program_id) DO UPDATE
    SET status = 'active', source = EXCLUDED.source, access_until = EXCLUDED.access_until, updated_at = now();
  RETURN 'Enrolled ' || p_email || ' in ' || p_program || '.';
END;
$$;

CREATE OR REPLACE FUNCTION public.academy_end_enrollment(p_enrollment UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  UPDATE academy_enrollments SET status = 'expired', access_until = now(), updated_at = now() WHERE id = p_enrollment;
END;
$$;


-- ──────────────────────────────────────────────────────────
-- 6. Classroom content
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT,
  position INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.academy_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.academy_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  video_url TEXT,
  reflection_prompt TEXT,
  position INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.academy_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.academy_lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.academy_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.academy_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 5 AND 600),
  join_url TEXT,
  recording_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['academy_modules', 'academy_lessons'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Class reads published" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Class reads published" ON public.%I FOR SELECT TO authenticated USING (public.has_academy_access(program_id) AND (is_published OR public.is_mentor(program_id)))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['academy_resources', 'academy_announcements', 'academy_sessions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Class reads" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Class reads" ON public.%I FOR SELECT TO authenticated USING (public.has_academy_access(program_id))', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['academy_modules', 'academy_lessons', 'academy_resources', 'academy_announcements', 'academy_sessions'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Mentors write" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Mentors write" ON public.%I FOR ALL TO authenticated USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id))', t);
  END LOOP;
END $$;


-- ──────────────────────────────────────────────────────────
-- 7. Student progress, tools and mentor messages
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_progress (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.academy_lessons(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);
ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own progress" ON public.academy_progress;
CREATE POLICY "Own progress" ON public.academy_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.has_academy_access(program_id));
DROP POLICY IF EXISTS "Mentors see progress" ON public.academy_progress;
CREATE POLICY "Mentors see progress" ON public.academy_progress FOR SELECT TO authenticated USING (public.is_mentor(program_id));

-- Business tool: goals & milestones (private to the student)
CREATE TABLE IF NOT EXISTS public.academy_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  is_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own goals" ON public.academy_goals;
CREATE POLICY "Own goals" ON public.academy_goals FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.has_academy_access(program_id));

-- Faith tool: prayer & reflection journal (private to the student)
CREATE TABLE IF NOT EXISTS public.academy_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.academy_lessons(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'reflection' CHECK (kind IN ('prayer', 'reflection', 'gratitude')),
  title TEXT,
  body TEXT NOT NULL,
  is_answered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_journal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own journal" ON public.academy_journal;
CREATE POLICY "Own journal" ON public.academy_journal FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.has_academy_access(program_id));

-- Ask your mentor: one private thread per student per program
CREATE TABLE IF NOT EXISTS public.academy_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
ALTER TABLE public.academy_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Thread members read" ON public.academy_messages;
CREATE POLICY "Thread members read" ON public.academy_messages FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_mentor(program_id));
DROP POLICY IF EXISTS "Thread members write" ON public.academy_messages;
CREATE POLICY "Thread members write" ON public.academy_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND (
    (student_id = auth.uid() AND public.has_academy_access(program_id)) OR public.is_mentor(program_id)));
DROP POLICY IF EXISTS "Mentors mark read" ON public.academy_messages;
CREATE POLICY "Mentors mark read" ON public.academy_messages FOR UPDATE TO authenticated
  USING (student_id = auth.uid() OR public.is_mentor(program_id))
  WITH CHECK (student_id = auth.uid() OR public.is_mentor(program_id));

-- Mentor roster: students, plan, status and progress for one program.
CREATE OR REPLACE FUNCTION public.academy_roster(p_program UUID)
RETURNS TABLE (user_id UUID, full_name TEXT, email TEXT, status TEXT, source TEXT, plan_label TEXT,
               access_until TIMESTAMPTZ, started_at TIMESTAMPTZ, lessons_done INT, unread INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_mentor(p_program) THEN RAISE EXCEPTION 'Mentors only'; END IF;
  RETURN QUERY
  SELECT e.user_id,
         coalesce(pr.full_name, u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))::TEXT,
         u.email::TEXT, e.status, e.source, pl.label, e.access_until, e.started_at,
         (SELECT count(*)::INT FROM academy_progress ap WHERE ap.user_id = e.user_id AND ap.program_id = p_program),
         (SELECT count(*)::INT FROM academy_messages m WHERE m.student_id = e.user_id AND m.program_id = p_program
            AND m.sender_id = e.user_id AND m.read_at IS NULL)
  FROM academy_enrollments e
  JOIN auth.users u ON u.id = e.user_id
  LEFT JOIN profiles pr ON pr.id = e.user_id
  LEFT JOIN academy_plans pl ON pl.id = e.plan_id
  WHERE e.program_id = p_program
  ORDER BY e.started_at DESC;
END;
$$;


-- ──────────────────────────────────────────────────────────
-- 8. Private storage for classroom files: academy/<program-slug>/...
-- ──────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('academy', 'academy', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Paths: academy/<slug>/files/...                  shared class files (mentors upload)
--        academy/<slug>/submissions/<user-id>/...   a student's work (that student + mentors only)
CREATE OR REPLACE FUNCTION public.academy_can_read_file(p_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage
AS $$
  SELECT CASE
    WHEN (storage.foldername(p_name))[2] = 'submissions'
      THEN (storage.foldername(p_name))[3] = auth.uid()::text
           OR public.is_mentor(public.academy_program_id((storage.foldername(p_name))[1]))
    ELSE public.has_academy_access(public.academy_program_id((storage.foldername(p_name))[1]))
  END;
$$;

CREATE OR REPLACE FUNCTION public.academy_can_write_file(p_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage
AS $$
  SELECT public.is_mentor(public.academy_program_id((storage.foldername(p_name))[1]))
      OR ((storage.foldername(p_name))[2] = 'submissions'
          AND (storage.foldername(p_name))[3] = auth.uid()::text
          AND public.has_academy_access(public.academy_program_id((storage.foldername(p_name))[1])));
$$;

DROP POLICY IF EXISTS "Academy files: class reads" ON storage.objects;
CREATE POLICY "Academy files: class reads" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'academy' AND public.academy_can_read_file(name));
DROP POLICY IF EXISTS "Academy files: mentors upload" ON storage.objects;
CREATE POLICY "Academy files: mentors upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'academy' AND public.academy_can_write_file(name));
DROP POLICY IF EXISTS "Academy files: mentors change" ON storage.objects;
CREATE POLICY "Academy files: mentors change" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'academy' AND public.is_mentor(public.academy_program_id((storage.foldername(name))[1])));
DROP POLICY IF EXISTS "Academy files: mentors delete" ON storage.objects;
CREATE POLICY "Academy files: mentors delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'academy' AND public.academy_can_write_file(name));


-- ──────────────────────────────────────────────────────────
-- 9. Which dashboards can the signed-in person open?
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_roles()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT jsonb_build_object(
    'signed_in', auth.uid() IS NOT NULL,
    'admin', public.is_academy_admin(),
    'operator', to_regclass('public.system_operators') IS NOT NULL AND EXISTS (SELECT 1 FROM system_operators WHERE user_id = auth.uid()),
    'curator', EXISTS (SELECT 1 FROM curator_data WHERE id = auth.uid()),
    'studio', EXISTS (SELECT 1 FROM studio_members WHERE user_id = auth.uid()),
    'mentor', coalesce((SELECT jsonb_agg(p.slug ORDER BY p.sort_order) FROM academy_mentors m
                        JOIN academy_programs p ON p.id = m.program_id WHERE m.user_id = auth.uid()), '[]'::jsonb),
    'student', coalesce((SELECT jsonb_agg(jsonb_build_object('program', p.slug, 'title', p.title, 'status', e.status,
                          'access_until', e.access_until, 'has_access', public.has_academy_access(p.id)) ORDER BY p.sort_order)
                         FROM academy_enrollments e JOIN academy_programs p ON p.id = e.program_id
                         WHERE e.user_id = auth.uid()), '[]'::jsonb));
$$;
GRANT EXECUTE ON FUNCTION public.my_roles() TO authenticated;

-- Mentor/admin RPCs are for signed-in people only.
REVOKE ALL ON FUNCTION public.academy_roster(UUID) FROM public, anon;
REVOKE ALL ON FUNCTION public.academy_enroll_manual(TEXT, TEXT, INT, TEXT) FROM public, anon;
REVOKE ALL ON FUNCTION public.academy_end_enrollment(UUID) FROM public, anon;
REVOKE ALL ON FUNCTION public.add_academy_mentor(TEXT, TEXT, TEXT) FROM public, anon;
REVOKE ALL ON FUNCTION public.remove_academy_mentor(UUID, TEXT) FROM public, anon;
REVOKE ALL ON FUNCTION public.add_studio_member(TEXT, TEXT) FROM public, anon;
REVOKE ALL ON FUNCTION public.remove_studio_member(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.academy_roster(UUID), public.academy_enroll_manual(TEXT, TEXT, INT, TEXT),
  public.academy_end_enrollment(UUID), public.add_academy_mentor(TEXT, TEXT, TEXT), public.remove_academy_mentor(UUID, TEXT),
  public.add_studio_member(TEXT, TEXT), public.remove_studio_member(UUID) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 10. Private 1:1 mentorship
-- ──────────────────────────────────────────────────────────
-- Sessions can be for the whole class (student_id NULL) or one student.
ALTER TABLE public.academy_sessions ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.academy_sessions ADD COLUMN IF NOT EXISTS notes TEXT;
DROP POLICY IF EXISTS "Class reads" ON public.academy_sessions;
CREATE POLICY "Class reads" ON public.academy_sessions FOR SELECT TO authenticated
  USING (public.has_academy_access(program_id) AND (student_id IS NULL OR student_id = auth.uid() OR public.is_mentor(program_id)));

-- Action plans: written by the mentor after a session, with clear next steps.
CREATE TABLE IF NOT EXISTS public.academy_action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.academy_sessions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.academy_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.academy_action_plans(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  due_date DATE,
  position INT NOT NULL DEFAULT 0,
  is_done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ
);
ALTER TABLE public.academy_action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academy_action_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student and mentors read" ON public.academy_action_plans;
CREATE POLICY "Student and mentors read" ON public.academy_action_plans FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_mentor(program_id));
DROP POLICY IF EXISTS "Mentors write" ON public.academy_action_plans;
CREATE POLICY "Mentors write" ON public.academy_action_plans FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));
DROP POLICY IF EXISTS "Student and mentors read" ON public.academy_action_items;
CREATE POLICY "Student and mentors read" ON public.academy_action_items FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_mentor(program_id));
DROP POLICY IF EXISTS "Mentors write" ON public.academy_action_items;
CREATE POLICY "Mentors write" ON public.academy_action_items FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));
DROP POLICY IF EXISTS "Students tick their items" ON public.academy_action_items;
CREATE POLICY "Students tick their items" ON public.academy_action_items FOR UPDATE TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- Students may only tick items done/undone — never rewrite them.
CREATE OR REPLACE FUNCTION public.guard_action_items()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF public.is_mentor(OLD.program_id) OR public.is_trusted_writer() THEN RETURN NEW; END IF;
  IF NEW.text IS DISTINCT FROM OLD.text OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.position IS DISTINCT FROM OLD.position OR NEW.plan_id IS DISTINCT FROM OLD.plan_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.program_id IS DISTINCT FROM OLD.program_id THEN
    RAISE EXCEPTION 'Only your mentor can change an action item.';
  END IF;
  NEW.done_at := CASE WHEN NEW.is_done THEN coalesce(OLD.done_at, now()) END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS action_items_guard ON public.academy_action_items;
CREATE TRIGGER action_items_guard BEFORE UPDATE ON public.academy_action_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_action_items();

-- Materials sent for review: offers, funnels, marketing plans, proposals…
CREATE TABLE IF NOT EXISTS public.academy_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  note TEXT,
  file_path TEXT,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  link_url TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed')),
  feedback TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student and mentors read" ON public.academy_submissions;
CREATE POLICY "Student and mentors read" ON public.academy_submissions FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_mentor(program_id));
DROP POLICY IF EXISTS "Students submit" ON public.academy_submissions;
CREATE POLICY "Students submit" ON public.academy_submissions FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND status = 'submitted' AND feedback IS NULL AND public.has_academy_access(program_id));
DROP POLICY IF EXISTS "Students withdraw unreviewed" ON public.academy_submissions;
CREATE POLICY "Students withdraw unreviewed" ON public.academy_submissions FOR DELETE TO authenticated
  USING ((student_id = auth.uid() AND status = 'submitted') OR public.is_mentor(program_id));
DROP POLICY IF EXISTS "Mentors review" ON public.academy_submissions;
CREATE POLICY "Mentors review" ON public.academy_submissions FOR UPDATE TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));

-- Mentor roster also counts work waiting for review.
CREATE OR REPLACE FUNCTION public.academy_awaiting_review(p_program UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN public.is_mentor(p_program)
    THEN (SELECT count(*)::INT FROM academy_submissions WHERE program_id = p_program AND status = 'submitted') END;
$$;
REVOKE ALL ON FUNCTION public.academy_awaiting_review(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.academy_awaiting_review(UUID) TO authenticated;

-- Students can see the plan they're enrolled in (their own price, nobody else's).
DROP POLICY IF EXISTS "Students read their own plan" ON public.academy_plans;
CREATE POLICY "Students read their own plan" ON public.academy_plans FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.academy_enrollments e WHERE e.plan_id = academy_plans.id AND e.user_id = auth.uid()));

-- Messages can only be marked read after they're sent — never rewritten.
CREATE OR REPLACE FUNCTION public.guard_academy_messages()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.program_id IS DISTINCT FROM OLD.program_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Messages can''t be edited.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS academy_messages_guard ON public.academy_messages;
CREATE TRIGGER academy_messages_guard BEFORE UPDATE ON public.academy_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_academy_messages();

-- Live updates for mentor messages.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.academy_messages;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
