/* ============================================================
   P31 — v23: live classroom video (Daily rooms inside the page)
   Run after v22. Safe to run more than once.

   - Sessions can be live rooms, started instantly ("Go live now")
     for everyone, chosen students, or one student.
   - Every call is saved: joins, how long each person stayed,
     when it started and ended, and its recordings.
   ============================================================ */
ALTER TABLE public.academy_sessions
  ADD COLUMN IF NOT EXISTS daily_room TEXT,
  ADD COLUMN IF NOT EXISTS is_instant BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS record BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS invitees UUID[],
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS has_recording BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS academy_sessions_daily_idx ON public.academy_sessions (daily_room);

-- Recordings of live calls (the video itself stays with Daily; links are fetched fresh).
CREATE TABLE IF NOT EXISTS public.academy_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.academy_sessions(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ,
  duration_seconds INT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_recordings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Class reads recordings" ON public.academy_recordings;
CREATE POLICY "Class reads recordings" ON public.academy_recordings FOR SELECT TO authenticated
  USING (public.is_mentor(program_id) OR (public.has_academy_access(program_id) AND EXISTS (
    SELECT 1 FROM public.academy_sessions s WHERE s.id = session_id
      AND (s.student_id IS NULL OR s.student_id = auth.uid()) AND (s.invitees IS NULL OR auth.uid() = ANY (s.invitees)))));

-- Joining checks invitations too (calls for chosen students).
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
  IF NOT v_mentor AND NOT (public.has_academy_access(s.program_id)
      AND (s.student_id IS NULL OR s.student_id = auth.uid())
      AND (s.invitees IS NULL OR auth.uid() = ANY (s.invitees))) THEN
    RAISE EXCEPTION 'This session isn''t yours';
  END IF;
  IF s.ended_at IS NOT NULL AND NOT v_mentor THEN RAISE EXCEPTION 'This class has ended'; END IF;
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
      jsonb_build_object('session_id', s.id, 'starts_at', s.starts_at, 'program', public.academy_slug(s.program_id), 'live', s.is_instant), 'classroom', 'member');
  END IF;
  RETURN s.join_url;
END;
$$;
REVOKE ALL ON FUNCTION public.academy_join_session(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.academy_join_session(UUID) TO authenticated;

-- After a call: who came, when, and for how long (mentors).
CREATE OR REPLACE FUNCTION public.academy_call_report(p_session UUID)
RETURNS TABLE (user_id UUID, full_name TEXT, email TEXT, joins INT, first_join TIMESTAMPTZ, last_leave TIMESTAMPTZ, minutes NUMERIC, attendance TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE v_program UUID;
BEGIN
  SELECT program_id INTO v_program FROM academy_sessions WHERE id = p_session;
  IF v_program IS NULL OR NOT public.is_mentor(v_program) THEN RAISE EXCEPTION 'Mentors only'; END IF;
  RETURN QUERY
  WITH people AS (
    SELECT j.user_id FROM academy_session_joins j WHERE j.session_id = p_session
    UNION SELECT e.user_id FROM academy_meeting_events e WHERE e.session_id = p_session AND e.user_id IS NOT NULL
    UNION SELECT a.user_id FROM academy_attendance a WHERE a.session_id = p_session
  )
  SELECT p.user_id, public.academy_person_name(p.user_id), u.email::TEXT,
    (SELECT count(*)::INT FROM academy_meeting_events e WHERE e.session_id = p_session AND e.user_id = p.user_id AND e.event LIKE '%joined%'),
    (SELECT min(e.at) FROM academy_meeting_events e WHERE e.session_id = p_session AND e.user_id = p.user_id AND e.event LIKE '%joined%'),
    (SELECT max(e.at) FROM academy_meeting_events e WHERE e.session_id = p_session AND e.user_id = p.user_id AND e.event LIKE '%left%'),
    round(coalesce((SELECT sum(e.duration_seconds) FROM academy_meeting_events e WHERE e.session_id = p_session AND e.user_id = p.user_id AND e.event LIKE '%left%'), 0) / 60.0, 1),
    (SELECT a.status FROM academy_attendance a WHERE a.session_id = p_session AND a.user_id = p.user_id)
  FROM people p JOIN auth.users u ON u.id = p.user_id
  ORDER BY 7 DESC NULLS LAST;
END;
$$;
REVOKE ALL ON FUNCTION public.academy_call_report(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.academy_call_report(UUID) TO authenticated;

-- Server-side CRM entries for call events (used by the daily-webhook function).
CREATE OR REPLACE FUNCTION public.crm_service_event(p_user UUID, p_kind TEXT, p_title TEXT, p_detail JSONB, p_source TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT public.crm_add(NULL, NULL, NULL, p_user, p_kind, p_title, p_detail, p_source); $$;
REVOKE ALL ON FUNCTION public.crm_service_event(UUID, TEXT, TEXT, JSONB, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crm_service_event(UUID, TEXT, TEXT, JSONB, TEXT) TO service_role;

-- "Live now" notifications go straight to the room, and only to invited students.
CREATE OR REPLACE FUNCTION public.academy_notify_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_base TEXT := '/academy/' || public.academy_slug(NEW.program_id);
BEGIN
  IF TG_TABLE_NAME = 'academy_messages' THEN
    IF NEW.sender_id = NEW.student_id THEN
      PERFORM public.academy_notify(public.academy_mentor_ids(NEW.program_id), NEW.program_id, 'message',
        'New message from ' || coalesce(public.academy_person_name(NEW.student_id), 'a student'), NEW.body,
        v_base || '/teach/inbox/' || NEW.student_id);
    ELSE
      PERFORM public.academy_notify(ARRAY[NEW.student_id], NEW.program_id, 'message', 'New message from your mentor', NEW.body, v_base || '/messages');
    END IF;
  ELSIF TG_TABLE_NAME = 'academy_announcements' THEN
    PERFORM public.academy_notify(public.academy_class_ids(NEW.program_id), NEW.program_id, 'announcement', NEW.title, NEW.body, v_base);
  ELSIF TG_TABLE_NAME = 'academy_assignments' THEN
    IF NEW.is_published AND (TG_OP = 'INSERT' OR NOT OLD.is_published) THEN
      PERFORM public.academy_notify(public.academy_class_ids(NEW.program_id), NEW.program_id, 'assignment',
        'New assignment: ' || NEW.title, NEW.instructions, v_base || '/assignments/' || NEW.id);
    END IF;
  ELSIF TG_TABLE_NAME = 'academy_quizzes' THEN
    IF NEW.is_published AND (TG_OP = 'INSERT' OR NOT OLD.is_published) THEN
      PERFORM public.academy_notify(public.academy_class_ids(NEW.program_id), NEW.program_id, 'quiz',
        'New quiz: ' || NEW.title, NEW.description, v_base || '/quizzes/' || NEW.id);
    END IF;
  ELSIF TG_TABLE_NAME = 'academy_submissions' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.academy_notify(public.academy_mentor_ids(NEW.program_id), NEW.program_id, 'submission',
        coalesce(public.academy_person_name(NEW.student_id), 'A student') || ' submitted work', NEW.title, v_base || '/teach/gradebook');
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('reviewed', 'revise') THEN
      PERFORM public.academy_notify(ARRAY[NEW.student_id], NEW.program_id, 'feedback',
        CASE WHEN NEW.status = 'revise' THEN 'Your mentor asked for a revision' ELSE 'Feedback on “' || NEW.title || '”' END,
        NEW.feedback, v_base || CASE WHEN NEW.assignment_id IS NOT NULL THEN '/assignments/' || NEW.assignment_id ELSE '/work' END);
    END IF;
  ELSIF TG_TABLE_NAME = 'academy_sessions' THEN
    PERFORM public.academy_notify(
      CASE WHEN NEW.student_id IS NOT NULL THEN ARRAY[NEW.student_id]
           WHEN NEW.invitees IS NOT NULL THEN NEW.invitees
           ELSE public.academy_class_ids(NEW.program_id) END,
      NEW.program_id, 'session',
      CASE WHEN NEW.is_instant THEN 'Live now: ' || NEW.title ELSE 'Session scheduled: ' || NEW.title END,
      CASE WHEN NEW.is_instant THEN 'Your mentor just started a live class — tap to join.'
           ELSE to_char(NEW.starts_at AT TIME ZONE 'America/New_York', 'Dy Mon DD, HH12:MI AM') || ' ET' END,
      v_base || CASE WHEN NEW.is_instant THEN '/live/' || NEW.id ELSE '/sessions' END);
  ELSIF TG_TABLE_NAME = 'academy_certificates' THEN
    PERFORM public.academy_notify(ARRAY[NEW.user_id], NEW.program_id, 'certificate', 'You earned a certificate', NEW.title, v_base || '/progress');
  ELSIF TG_TABLE_NAME = 'academy_posts' THEN
    PERFORM public.academy_notify(ARRAY[(SELECT author_id FROM academy_threads WHERE id = NEW.thread_id)], NEW.program_id, 'reply',
      coalesce(NEW.author_name, 'Someone') || ' replied to your discussion', NEW.body, v_base || '/discussions/' || NEW.thread_id);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'academy notification skipped: %', SQLERRM;
  RETURN NULL;
END;
$$;
