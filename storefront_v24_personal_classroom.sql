/* ============================================================
   P31 — v24: a personal classroom for every student
   Run after v23. Safe to run more than once.

   - Personal tasks: assignments for one student or a chosen few
   - Private files: documents shared with a single student
   - Mentors can see a student's goals (journals stay private)
   - Invite-only calls stay hidden from students who weren't invited
   ============================================================ */

-- 1. Personal assignments (NULL = everyone in the program)
ALTER TABLE public.academy_assignments ADD COLUMN IF NOT EXISTS assigned_to UUID[];
DROP POLICY IF EXISTS "Class reads published assignments" ON public.academy_assignments;
CREATE POLICY "Class reads published assignments" ON public.academy_assignments FOR SELECT TO authenticated
  USING (public.is_mentor(program_id) OR (is_published AND public.has_academy_access(program_id)
    AND (assigned_to IS NULL OR auth.uid() = ANY (assigned_to))));

-- 2. Private files for one student (stored at academy/<slug>/messages/<student-id>/…)
CREATE TABLE IF NOT EXISTS public.academy_student_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  note TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS academy_student_files_student_idx ON public.academy_student_files (program_id, student_id, created_at DESC);
ALTER TABLE public.academy_student_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student reads own files" ON public.academy_student_files;
CREATE POLICY "Student reads own files" ON public.academy_student_files FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_mentor(program_id));
DROP POLICY IF EXISTS "Mentors share files" ON public.academy_student_files;
CREATE POLICY "Mentors share files" ON public.academy_student_files FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));

-- 3. Mentors can read a student's goals (to coach them); students still own them.
DROP POLICY IF EXISTS "Mentors see goals" ON public.academy_goals;
CREATE POLICY "Mentors see goals" ON public.academy_goals FOR SELECT TO authenticated USING (public.is_mentor(program_id));

-- 4. Invite-only calls are visible only to the people invited.
DROP POLICY IF EXISTS "Class reads" ON public.academy_sessions;
CREATE POLICY "Class reads" ON public.academy_sessions FOR SELECT TO authenticated
  USING (public.is_mentor(program_id) OR (public.has_academy_access(program_id)
    AND (student_id IS NULL OR student_id = auth.uid())
    AND (invitees IS NULL OR auth.uid() = ANY (invitees))));

-- 5. Progress counts only the assignments meant for that student.
CREATE OR REPLACE FUNCTION public.academy_progress_summary(p_program UUID, p_user UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_user UUID := coalesce(p_user, auth.uid());
BEGIN
  IF v_user <> auth.uid() AND NOT public.is_mentor(p_program) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN jsonb_build_object(
    'lessons_done', (SELECT count(*) FROM academy_progress p JOIN academy_lessons l ON l.id = p.lesson_id
                     WHERE p.user_id = v_user AND p.program_id = p_program AND l.is_published),
    'lessons_total', (SELECT count(*) FROM academy_lessons WHERE program_id = p_program AND is_published),
    'assignments_passed', (SELECT count(DISTINCT s.assignment_id) FROM academy_submissions s JOIN academy_assignments a ON a.id = s.assignment_id
                           WHERE s.student_id = v_user AND s.program_id = p_program AND s.status = 'reviewed'
                             AND (s.max_score IS NULL OR s.max_score = 0 OR s.score * 100 >= a.pass_pct * s.max_score)),
    'assignments_total', (SELECT count(*) FROM academy_assignments WHERE program_id = p_program AND is_published
                            AND (assigned_to IS NULL OR v_user = ANY (assigned_to))),
    'quizzes_passed', (SELECT count(DISTINCT quiz_id) FROM academy_quiz_attempts WHERE user_id = v_user AND program_id = p_program AND passed),
    'quizzes_total', (SELECT count(*) FROM academy_quizzes WHERE program_id = p_program AND is_published),
    'sessions_attended', (SELECT count(*) FROM academy_attendance WHERE user_id = v_user AND program_id = p_program AND status IN ('present', 'late')),
    'sessions_total', (SELECT count(*) FROM academy_sessions WHERE program_id = p_program AND starts_at < now()
                         AND (student_id IS NULL OR student_id = v_user) AND (invitees IS NULL OR v_user = ANY (invitees))),
    'custom_checked', coalesce((SELECT jsonb_agg(requirement_id) FROM academy_requirement_checks WHERE user_id = v_user AND program_id = p_program), '[]'::jsonb)
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.academy_progress_summary(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.academy_progress_summary(UUID, UUID) TO authenticated;

-- 6. Notifications: personal assignments go only to their students; shared files notify the student.
CREATE OR REPLACE FUNCTION public.academy_notify_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
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
      PERFORM public.academy_notify(coalesce(NEW.assigned_to, public.academy_class_ids(NEW.program_id)), NEW.program_id, 'assignment',
        CASE WHEN NEW.assigned_to IS NULL THEN 'New assignment: ' ELSE 'A task just for you: ' END || NEW.title,
        NEW.instructions, v_base || '/assignments/' || NEW.id);
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
  ELSIF TG_TABLE_NAME = 'academy_student_files' THEN
    PERFORM public.academy_notify(ARRAY[NEW.student_id], NEW.program_id, 'file', 'Your mentor shared a file: ' || NEW.title, NEW.note, v_base || '/library');
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
$fn$;
DROP TRIGGER IF EXISTS academy_student_files_notify ON public.academy_student_files;
CREATE TRIGGER academy_student_files_notify AFTER INSERT ON public.academy_student_files FOR EACH ROW EXECUTE FUNCTION public.academy_notify_events();
