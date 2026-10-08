/* ============================================================
   P31 — v21: the full online classroom
   Run after v20. Safe to run more than once.

   1. Admins see every program and the Content Studio
   2. Assignments with grading criteria (rubrics) + graded work
   3. Quizzes with private answer keys and auto-grading
   4. Discussions (threads + replies)
   5. Messaging: inbox, broadcasts, attachments
   6. Attendance for sessions
   7. Completion requirements, progress and certificates
   8. Private mentor notes on students
   9. Notifications (in-app, live)
   ============================================================ */

-- ──────────────────────────────────────────────────────────
-- 0. Helpers
-- ──────────────────────────────────────────────────────────
-- Everyone who currently has classroom access to a program (same rule as has_academy_access).
CREATE OR REPLACE FUNCTION public.academy_member_ids(p_program UUID)
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.user_id FROM academy_enrollments e
  WHERE e.program_id = p_program
    AND ((e.access_until IS NULL AND e.status = 'active')
      OR (e.access_until > now() AND e.status IN ('active', 'past_due', 'canceled')));
$$;
REVOKE ALL ON FUNCTION public.academy_member_ids(UUID) FROM public, anon, authenticated;

-- A person's display name.
CREATE OR REPLACE FUNCTION public.academy_person_name(p_user UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT coalesce(nullif(pr.full_name, ''), u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
  FROM auth.users u LEFT JOIN profiles pr ON pr.id = u.id WHERE u.id = p_user;
$$;
REVOKE ALL ON FUNCTION public.academy_person_name(UUID) FROM public, anon, authenticated;


-- ──────────────────────────────────────────────────────────
-- 1. Admins: every program and the Studio show up in their dashboards
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_roles()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
  SELECT jsonb_build_object(
    'signed_in', auth.uid() IS NOT NULL,
    'admin', public.is_academy_admin(),
    'operator', to_regclass('public.system_operators') IS NOT NULL AND EXISTS (SELECT 1 FROM system_operators WHERE user_id = auth.uid()),
    'curator', EXISTS (SELECT 1 FROM curator_data WHERE id = auth.uid()),
    'studio', auth.uid() IS NOT NULL AND public.is_studio_member(),
    'mentor', CASE WHEN auth.uid() IS NOT NULL AND public.is_academy_admin()
      THEN coalesce((SELECT jsonb_agg(slug ORDER BY sort_order) FROM academy_programs WHERE is_active), '[]'::jsonb)
      ELSE coalesce((SELECT jsonb_agg(p.slug ORDER BY p.sort_order) FROM academy_mentors m
                     JOIN academy_programs p ON p.id = m.program_id WHERE m.user_id = auth.uid()), '[]'::jsonb) END,
    'student', coalesce((SELECT jsonb_agg(jsonb_build_object('program', p.slug, 'title', p.title, 'status', e.status,
                          'access_until', e.access_until, 'has_access', public.has_academy_access(p.id)) ORDER BY p.sort_order)
                         FROM academy_enrollments e JOIN academy_programs p ON p.id = e.program_id
                         WHERE e.user_id = auth.uid()), '[]'::jsonb));
$$;
GRANT EXECUTE ON FUNCTION public.my_roles() TO authenticated;


-- ──────────────────────────────────────────────────────────
-- 2. Assignments and grading criteria
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  module_id UUID REFERENCES public.academy_modules(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES public.academy_lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  instructions TEXT,
  due_at TIMESTAMPTZ,
  submission_type TEXT NOT NULL DEFAULT 'any' CHECK (submission_type IN ('any', 'file', 'link', 'text')),
  pass_pct INT NOT NULL DEFAULT 70 CHECK (pass_pct BETWEEN 0 AND 100),
  is_published BOOLEAN NOT NULL DEFAULT false,
  file_path TEXT,
  file_name TEXT,
  size_bytes BIGINT,
  position INT NOT NULL DEFAULT 0,
  created_by UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS academy_assignments_program_idx ON public.academy_assignments (program_id, position);
ALTER TABLE public.academy_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Class reads published assignments" ON public.academy_assignments;
CREATE POLICY "Class reads published assignments" ON public.academy_assignments FOR SELECT TO authenticated
  USING (public.is_mentor(program_id) OR (is_published AND public.has_academy_access(program_id)));
DROP POLICY IF EXISTS "Mentors manage assignments" ON public.academy_assignments;
CREATE POLICY "Mentors manage assignments" ON public.academy_assignments FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));

CREATE TABLE IF NOT EXISTS public.academy_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.academy_assignments(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description TEXT,
  max_points INT NOT NULL DEFAULT 10 CHECK (max_points BETWEEN 1 AND 1000),
  position INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS academy_criteria_assignment_idx ON public.academy_criteria (assignment_id, position);
ALTER TABLE public.academy_criteria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Class reads criteria" ON public.academy_criteria;
CREATE POLICY "Class reads criteria" ON public.academy_criteria FOR SELECT TO authenticated
  USING (public.is_mentor(program_id) OR (public.has_academy_access(program_id)
    AND EXISTS (SELECT 1 FROM public.academy_assignments a WHERE a.id = assignment_id AND a.is_published)));
DROP POLICY IF EXISTS "Mentors manage criteria" ON public.academy_criteria;
CREATE POLICY "Mentors manage criteria" ON public.academy_criteria FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));

-- Submissions can answer an assignment, be written in place, and carry a score.
ALTER TABLE public.academy_submissions
  ADD COLUMN IF NOT EXISTS assignment_id UUID REFERENCES public.academy_assignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS score NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS max_score NUMERIC(8,2);
CREATE INDEX IF NOT EXISTS academy_submissions_assignment_idx ON public.academy_submissions (assignment_id, student_id);
ALTER TABLE public.academy_submissions DROP CONSTRAINT IF EXISTS academy_submissions_status_check;
ALTER TABLE public.academy_submissions ADD CONSTRAINT academy_submissions_status_check
  CHECK (status IN ('submitted', 'reviewed', 'revise'));
DROP POLICY IF EXISTS "Students submit" ON public.academy_submissions;
CREATE POLICY "Students submit" ON public.academy_submissions FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND status = 'submitted' AND feedback IS NULL AND score IS NULL AND max_score IS NULL
              AND public.has_academy_access(program_id));

CREATE TABLE IF NOT EXISTS public.academy_scores (
  submission_id UUID NOT NULL REFERENCES public.academy_submissions(id) ON DELETE CASCADE,
  criterion_id UUID NOT NULL REFERENCES public.academy_criteria(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  points NUMERIC(8,2) NOT NULL CHECK (points >= 0),
  comment TEXT,
  PRIMARY KEY (submission_id, criterion_id)
);
ALTER TABLE public.academy_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student and mentors read scores" ON public.academy_scores;
CREATE POLICY "Student and mentors read scores" ON public.academy_scores FOR SELECT TO authenticated
  USING (public.is_mentor(program_id) OR EXISTS (SELECT 1 FROM public.academy_submissions s
    WHERE s.id = submission_id AND s.student_id = auth.uid() AND s.status <> 'submitted'));
DROP POLICY IF EXISTS "Mentors grade" ON public.academy_scores;
CREATE POLICY "Mentors grade" ON public.academy_scores FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));

-- Grade a submission in one step: criterion scores + feedback + status.
--   p_scores: [{"criterion_id": "...", "points": 8, "comment": "..."}]
--   p_status: 'reviewed' (graded) or 'revise' (send back for another try)
CREATE OR REPLACE FUNCTION public.academy_grade_submission(p_submission UUID, p_scores JSONB, p_feedback TEXT, p_status TEXT DEFAULT 'reviewed')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_sub academy_submissions%ROWTYPE;
  v_item JSONB;
  v_total NUMERIC := 0;
  v_max NUMERIC := 0;
BEGIN
  SELECT * INTO v_sub FROM academy_submissions WHERE id = p_submission;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF NOT public.is_mentor(v_sub.program_id) THEN RAISE EXCEPTION 'Mentors only'; END IF;
  IF p_status NOT IN ('reviewed', 'revise') THEN RAISE EXCEPTION 'Status must be reviewed or revise'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) LOOP
    INSERT INTO academy_scores (submission_id, criterion_id, program_id, points, comment)
    SELECT p_submission, c.id, v_sub.program_id,
           least(greatest((v_item->>'points')::NUMERIC, 0), c.max_points), nullif(v_item->>'comment', '')
    FROM academy_criteria c
    WHERE c.id = (v_item->>'criterion_id')::UUID AND c.assignment_id = v_sub.assignment_id
    ON CONFLICT (submission_id, criterion_id) DO UPDATE SET points = EXCLUDED.points, comment = EXCLUDED.comment;
  END LOOP;

  IF v_sub.assignment_id IS NOT NULL THEN
    SELECT coalesce(sum(s.points), 0) INTO v_total FROM academy_scores s WHERE s.submission_id = p_submission;
    SELECT coalesce(sum(c.max_points), 0) INTO v_max FROM academy_criteria c WHERE c.assignment_id = v_sub.assignment_id;
  END IF;

  UPDATE academy_submissions
  SET status = p_status, feedback = nullif(p_feedback, ''), reviewed_by = auth.uid(), reviewed_at = now(),
      score = CASE WHEN v_max > 0 THEN v_total END, max_score = CASE WHEN v_max > 0 THEN v_max END
  WHERE id = p_submission;
  RETURN jsonb_build_object('score', CASE WHEN v_max > 0 THEN v_total END, 'max', CASE WHEN v_max > 0 THEN v_max END);
END;
$$;
REVOKE ALL ON FUNCTION public.academy_grade_submission(UUID, JSONB, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.academy_grade_submission(UUID, JSONB, TEXT, TEXT) TO authenticated;


-- ──────────────────────────────────────────────────────────
-- 3. Quizzes (answer keys stay private; grading happens in the database)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.academy_lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description TEXT,
  pass_pct INT NOT NULL DEFAULT 70 CHECK (pass_pct BETWEEN 0 AND 100),
  max_attempts INT CHECK (max_attempts IS NULL OR max_attempts > 0),
  is_published BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_quizzes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Class reads published quizzes" ON public.academy_quizzes;
CREATE POLICY "Class reads published quizzes" ON public.academy_quizzes FOR SELECT TO authenticated
  USING (public.is_mentor(program_id) OR (is_published AND public.has_academy_access(program_id)));
DROP POLICY IF EXISTS "Mentors manage quizzes" ON public.academy_quizzes;
CREATE POLICY "Mentors manage quizzes" ON public.academy_quizzes FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));

CREATE TABLE IF NOT EXISTS public.academy_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.academy_quizzes(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL CHECK (length(prompt) BETWEEN 1 AND 2000),
  kind TEXT NOT NULL DEFAULT 'single' CHECK (kind IN ('single', 'multi', 'text')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  points INT NOT NULL DEFAULT 1 CHECK (points BETWEEN 1 AND 100),
  position INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS academy_quiz_questions_quiz_idx ON public.academy_quiz_questions (quiz_id, position);
ALTER TABLE public.academy_quiz_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Class reads questions" ON public.academy_quiz_questions;
CREATE POLICY "Class reads questions" ON public.academy_quiz_questions FOR SELECT TO authenticated
  USING (public.is_mentor(program_id) OR (public.has_academy_access(program_id)
    AND EXISTS (SELECT 1 FROM public.academy_quizzes q WHERE q.id = quiz_id AND q.is_published)));
DROP POLICY IF EXISTS "Mentors manage questions" ON public.academy_quiz_questions;
CREATE POLICY "Mentors manage questions" ON public.academy_quiz_questions FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));

-- Correct answers: option indexes, e.g. [2] or [0, 3]. Mentors only.
CREATE TABLE IF NOT EXISTS public.academy_quiz_keys (
  question_id UUID PRIMARY KEY REFERENCES public.academy_quiz_questions(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  correct JSONB NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.academy_quiz_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Mentors manage keys" ON public.academy_quiz_keys;
CREATE POLICY "Mentors manage keys" ON public.academy_quiz_keys FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));

CREATE TABLE IF NOT EXISTS public.academy_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.academy_quizzes(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  points NUMERIC(8,2) NOT NULL DEFAULT 0,
  max_points NUMERIC(8,2) NOT NULL DEFAULT 0,
  score_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS academy_quiz_attempts_user_idx ON public.academy_quiz_attempts (quiz_id, user_id, created_at DESC);
ALTER TABLE public.academy_quiz_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own attempts and mentors" ON public.academy_quiz_attempts;
CREATE POLICY "Own attempts and mentors" ON public.academy_quiz_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_mentor(program_id));
-- Attempts are written only by academy_submit_quiz.

--   p_answers: {"<question id>": [index, ...] | "written answer"}
CREATE OR REPLACE FUNCTION public.academy_submit_quiz(p_quiz UUID, p_answers JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_quiz academy_quizzes%ROWTYPE;
  v_q RECORD;
  v_given JSONB;
  v_ok BOOLEAN;
  v_points NUMERIC := 0;
  v_max NUMERIC := 0;
  v_review BOOLEAN := false;
  v_results JSONB := '{}'::jsonb;
  v_pct NUMERIC;
  v_id UUID;
BEGIN
  SELECT * INTO v_quiz FROM academy_quizzes WHERE id = p_quiz;
  IF NOT FOUND OR NOT (v_quiz.is_published OR public.is_mentor(v_quiz.program_id)) THEN RAISE EXCEPTION 'Quiz not available'; END IF;
  IF NOT public.has_academy_access(v_quiz.program_id) THEN RAISE EXCEPTION 'No access to this classroom'; END IF;
  IF v_quiz.max_attempts IS NOT NULL AND (SELECT count(*) FROM academy_quiz_attempts
      WHERE quiz_id = p_quiz AND user_id = auth.uid()) >= v_quiz.max_attempts THEN
    RAISE EXCEPTION 'No attempts left';
  END IF;

  FOR v_q IN SELECT q.id, q.kind, q.points, coalesce(k.correct, '[]'::jsonb) AS correct
             FROM academy_quiz_questions q LEFT JOIN academy_quiz_keys k ON k.question_id = q.id
             WHERE q.quiz_id = p_quiz LOOP
    v_given := p_answers->(v_q.id::text);
    IF v_q.kind = 'text' THEN
      v_review := true;
      v_results := v_results || jsonb_build_object(v_q.id::text, 'review');
      CONTINUE;
    END IF;
    v_max := v_max + v_q.points;
    v_ok := v_given IS NOT NULL AND jsonb_typeof(v_given) = 'array'
      AND (SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb) FROM (SELECT DISTINCT (e)::int AS x FROM jsonb_array_elements_text(v_given) e) g)
        = (SELECT coalesce(jsonb_agg(x ORDER BY x), '[]'::jsonb) FROM (SELECT DISTINCT (e)::int AS x FROM jsonb_array_elements_text(v_q.correct) e) c);
    IF v_ok THEN v_points := v_points + v_q.points; END IF;
    v_results := v_results || jsonb_build_object(v_q.id::text, CASE WHEN v_ok THEN 'correct' ELSE 'incorrect' END);
  END LOOP;

  v_pct := CASE WHEN v_max > 0 THEN round(v_points * 100 / v_max, 2) ELSE 100 END;
  INSERT INTO academy_quiz_attempts (quiz_id, program_id, user_id, answers, results, points, max_points, score_pct, passed, needs_review)
  VALUES (p_quiz, v_quiz.program_id, auth.uid(), coalesce(p_answers, '{}'::jsonb), v_results, v_points, v_max, v_pct,
          v_pct >= v_quiz.pass_pct, v_review)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'score_pct', v_pct, 'passed', v_pct >= v_quiz.pass_pct, 'needs_review', v_review, 'results', v_results);
END;
$$;
REVOKE ALL ON FUNCTION public.academy_submit_quiz(UUID, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.academy_submit_quiz(UUID, JSONB) TO authenticated;


-- ──────────────────────────────────────────────────────────
-- 4. Discussions
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  author_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT,
  author_role TEXT,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body TEXT CHECK (body IS NULL OR length(body) <= 8000),
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  reply_count INT NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS academy_threads_program_idx ON public.academy_threads (program_id, is_pinned DESC, last_activity_at DESC);

CREATE TABLE IF NOT EXISTS public.academy_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.academy_threads(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  author_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT,
  author_role TEXT,
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS academy_posts_thread_idx ON public.academy_posts (thread_id, created_at);

-- Stamp the author's name and role; only mentors pin or lock.
CREATE OR REPLACE FUNCTION public.academy_stamp_author()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  -- The reply counter (academy_bump_thread) updates threads on everyone's behalf.
  IF current_setting('academy.bumping', true) = 'on' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.author_id := auth.uid();
    NEW.author_name := public.academy_person_name(auth.uid());
    NEW.author_role := CASE WHEN public.is_mentor(NEW.program_id) THEN 'mentor' ELSE 'student' END;
  ELSE
    NEW.author_id := OLD.author_id; NEW.author_name := OLD.author_name; NEW.author_role := OLD.author_role;
    NEW.program_id := OLD.program_id; NEW.created_at := OLD.created_at;
  END IF;
  IF TG_TABLE_NAME = 'academy_threads' AND NOT public.is_mentor(NEW.program_id) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_pinned := false; NEW.is_locked := false; NEW.reply_count := 0;
    ELSE
      NEW.is_pinned := OLD.is_pinned; NEW.is_locked := OLD.is_locked;
      NEW.reply_count := OLD.reply_count; NEW.last_activity_at := OLD.last_activity_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS academy_threads_stamp ON public.academy_threads;
CREATE TRIGGER academy_threads_stamp BEFORE INSERT OR UPDATE ON public.academy_threads
  FOR EACH ROW EXECUTE FUNCTION public.academy_stamp_author();
DROP TRIGGER IF EXISTS academy_posts_stamp ON public.academy_posts;
CREATE TRIGGER academy_posts_stamp BEFORE INSERT OR UPDATE ON public.academy_posts
  FOR EACH ROW EXECUTE FUNCTION public.academy_stamp_author();

CREATE OR REPLACE FUNCTION public.academy_bump_thread()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM set_config('academy.bumping', 'on', true);
  UPDATE academy_threads SET
    reply_count = (SELECT count(*) FROM academy_posts WHERE thread_id = coalesce(NEW.thread_id, OLD.thread_id)),
    last_activity_at = CASE WHEN TG_OP = 'INSERT' THEN now() ELSE last_activity_at END
  WHERE id = coalesce(NEW.thread_id, OLD.thread_id);
  PERFORM set_config('academy.bumping', 'off', true);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS academy_posts_bump ON public.academy_posts;
CREATE TRIGGER academy_posts_bump AFTER INSERT OR DELETE ON public.academy_posts
  FOR EACH ROW EXECUTE FUNCTION public.academy_bump_thread();

ALTER TABLE public.academy_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Class reads threads" ON public.academy_threads;
CREATE POLICY "Class reads threads" ON public.academy_threads FOR SELECT TO authenticated
  USING (public.has_academy_access(program_id));
DROP POLICY IF EXISTS "Class starts threads" ON public.academy_threads;
CREATE POLICY "Class starts threads" ON public.academy_threads FOR INSERT TO authenticated
  WITH CHECK (public.has_academy_access(program_id));
DROP POLICY IF EXISTS "Authors and mentors edit threads" ON public.academy_threads;
CREATE POLICY "Authors and mentors edit threads" ON public.academy_threads FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_mentor(program_id)) WITH CHECK (author_id = auth.uid() OR public.is_mentor(program_id));
DROP POLICY IF EXISTS "Authors and mentors delete threads" ON public.academy_threads;
CREATE POLICY "Authors and mentors delete threads" ON public.academy_threads FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_mentor(program_id));

ALTER TABLE public.academy_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Class reads posts" ON public.academy_posts;
CREATE POLICY "Class reads posts" ON public.academy_posts FOR SELECT TO authenticated
  USING (public.has_academy_access(program_id));
DROP POLICY IF EXISTS "Class replies" ON public.academy_posts;
CREATE POLICY "Class replies" ON public.academy_posts FOR INSERT TO authenticated
  WITH CHECK (public.has_academy_access(program_id) AND EXISTS (SELECT 1 FROM public.academy_threads t
    WHERE t.id = thread_id AND t.program_id = academy_posts.program_id AND (NOT t.is_locked OR public.is_mentor(t.program_id))));
DROP POLICY IF EXISTS "Authors and mentors delete posts" ON public.academy_posts;
CREATE POLICY "Authors and mentors delete posts" ON public.academy_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_mentor(program_id));


-- ──────────────────────────────────────────────────────────
-- 5. Messaging: attachments, the mentor inbox, broadcasts
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.academy_messages
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- Message files live at academy/<slug>/messages/<student-id>/... (that student + mentors).
CREATE OR REPLACE FUNCTION public.academy_can_read_file(p_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage
AS $$
  SELECT CASE
    WHEN (storage.foldername(p_name))[2] IN ('submissions', 'messages')
      THEN (storage.foldername(p_name))[3] = auth.uid()::text
           OR public.is_mentor(public.academy_program_id((storage.foldername(p_name))[1]))
    ELSE public.has_academy_access(public.academy_program_id((storage.foldername(p_name))[1]))
  END;
$$;
CREATE OR REPLACE FUNCTION public.academy_can_write_file(p_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, storage
AS $$
  SELECT public.is_mentor(public.academy_program_id((storage.foldername(p_name))[1]))
      OR ((storage.foldername(p_name))[2] IN ('submissions', 'messages')
          AND (storage.foldername(p_name))[3] = auth.uid()::text
          AND public.has_academy_access(public.academy_program_id((storage.foldername(p_name))[1])));
$$;

-- One row per student thread: last message and unread count.
CREATE OR REPLACE FUNCTION public.academy_inbox(p_program UUID)
RETURNS TABLE (student_id UUID, full_name TEXT, email TEXT, last_body TEXT, last_at TIMESTAMPTZ, last_from_student BOOLEAN, unread INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_mentor(p_program) THEN RAISE EXCEPTION 'Mentors only'; END IF;
  RETURN QUERY
  SELECT m.student_id, public.academy_person_name(m.student_id), u.email::TEXT,
         m.body, m.created_at, m.sender_id = m.student_id,
         (SELECT count(*)::INT FROM academy_messages x WHERE x.program_id = p_program AND x.student_id = m.student_id
            AND x.sender_id = x.student_id AND x.read_at IS NULL)
  FROM (SELECT DISTINCT ON (am.student_id) am.* FROM academy_messages am
        WHERE am.program_id = p_program ORDER BY am.student_id, am.created_at DESC) m
  JOIN auth.users u ON u.id = m.student_id
  ORDER BY m.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.academy_inbox(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.academy_inbox(UUID) TO authenticated;

-- Send the same message to every current student (or a chosen few), each in their private thread.
CREATE OR REPLACE FUNCTION public.academy_broadcast(p_program UUID, p_body TEXT, p_students UUID[] DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE v_count INT;
BEGIN
  IF NOT public.is_mentor(p_program) THEN RAISE EXCEPTION 'Mentors only'; END IF;
  IF coalesce(length(trim(p_body)), 0) = 0 THEN RAISE EXCEPTION 'Write a message first'; END IF;
  INSERT INTO academy_messages (program_id, student_id, sender_id, body)
  SELECT p_program, m.id, auth.uid(), trim(p_body)
  FROM public.academy_member_ids(p_program) AS m(id)
  WHERE p_students IS NULL OR m.id = ANY (p_students);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.academy_broadcast(UUID, TEXT, UUID[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.academy_broadcast(UUID, TEXT, UUID[]) TO authenticated;


-- ──────────────────────────────────────────────────────────
-- 6. Attendance
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_attendance (
  session_id UUID NOT NULL REFERENCES public.academy_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'excused')),
  note TEXT,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);
ALTER TABLE public.academy_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own attendance and mentors" ON public.academy_attendance;
CREATE POLICY "Own attendance and mentors" ON public.academy_attendance FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_mentor(program_id));
DROP POLICY IF EXISTS "Mentors take attendance" ON public.academy_attendance;
CREATE POLICY "Mentors take attendance" ON public.academy_attendance FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));


-- ──────────────────────────────────────────────────────────
-- 7. Completion requirements, progress and certificates
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  description TEXT,
  kind TEXT NOT NULL DEFAULT 'custom' CHECK (kind IN ('lessons', 'assignments', 'quizzes', 'sessions', 'custom')),
  target INT CHECK (target IS NULL OR target > 0),
  position INT NOT NULL DEFAULT 0
);
ALTER TABLE public.academy_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Class reads requirements" ON public.academy_requirements;
CREATE POLICY "Class reads requirements" ON public.academy_requirements FOR SELECT TO authenticated
  USING (public.has_academy_access(program_id));
DROP POLICY IF EXISTS "Mentors manage requirements" ON public.academy_requirements;
CREATE POLICY "Mentors manage requirements" ON public.academy_requirements FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));

-- Custom requirements are checked off by a mentor.
CREATE TABLE IF NOT EXISTS public.academy_requirement_checks (
  requirement_id UUID NOT NULL REFERENCES public.academy_requirements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  checked_by UUID DEFAULT auth.uid(),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (requirement_id, user_id)
);
ALTER TABLE public.academy_requirement_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own checks and mentors" ON public.academy_requirement_checks;
CREATE POLICY "Own checks and mentors" ON public.academy_requirement_checks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_mentor(program_id));
DROP POLICY IF EXISTS "Mentors check off" ON public.academy_requirement_checks;
CREATE POLICY "Mentors check off" ON public.academy_requirement_checks FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));

-- Progress numbers for one student (the student themself, or a mentor).
CREATE OR REPLACE FUNCTION public.academy_progress_summary(p_program UUID, p_user UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
    'assignments_total', (SELECT count(*) FROM academy_assignments WHERE program_id = p_program AND is_published),
    'quizzes_passed', (SELECT count(DISTINCT quiz_id) FROM academy_quiz_attempts WHERE user_id = v_user AND program_id = p_program AND passed),
    'quizzes_total', (SELECT count(*) FROM academy_quizzes WHERE program_id = p_program AND is_published),
    'sessions_attended', (SELECT count(*) FROM academy_attendance WHERE user_id = v_user AND program_id = p_program AND status IN ('present', 'late')),
    'sessions_total', (SELECT count(*) FROM academy_sessions WHERE program_id = p_program AND starts_at < now()
                         AND (student_id IS NULL OR student_id = v_user)),
    'custom_checked', coalesce((SELECT jsonb_agg(requirement_id) FROM academy_requirement_checks WHERE user_id = v_user AND program_id = p_program), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.academy_progress_summary(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.academy_progress_summary(UUID, UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.academy_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Certificate of Completion',
  recipient_name TEXT NOT NULL,
  note TEXT,
  serial TEXT NOT NULL UNIQUE DEFAULT upper(substr(md5(gen_random_uuid()::text), 1, 10)),
  issued_by UUID DEFAULT auth.uid(),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own certificates and mentors" ON public.academy_certificates;
CREATE POLICY "Own certificates and mentors" ON public.academy_certificates FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_mentor(program_id));
DROP POLICY IF EXISTS "Mentors issue certificates" ON public.academy_certificates;
CREATE POLICY "Mentors issue certificates" ON public.academy_certificates FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));

-- Anyone can check a certificate by its serial number.
CREATE OR REPLACE FUNCTION public.academy_verify_certificate(p_serial TEXT)
RETURNS TABLE (recipient_name TEXT, title TEXT, program_title TEXT, issued_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.recipient_name, c.title, p.title, c.issued_at
  FROM academy_certificates c JOIN academy_programs p ON p.id = c.program_id
  WHERE c.serial = upper(trim(p_serial));
$$;
GRANT EXECUTE ON FUNCTION public.academy_verify_certificate(TEXT) TO anon, authenticated;


-- ──────────────────────────────────────────────────────────
-- 8. Private mentor notes on a student
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_student_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id UUID NOT NULL DEFAULT auth.uid(),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.academy_student_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Mentors only notes" ON public.academy_student_notes;
CREATE POLICY "Mentors only notes" ON public.academy_student_notes FOR ALL TO authenticated
  USING (public.is_mentor(program_id)) WITH CHECK (public.is_mentor(program_id));


-- ──────────────────────────────────────────────────────────
-- 9. Notifications
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.academy_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID REFERENCES public.academy_programs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS academy_notifications_user_idx ON public.academy_notifications (user_id, created_at DESC);
ALTER TABLE public.academy_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own notifications" ON public.academy_notifications;
CREATE POLICY "Own notifications" ON public.academy_notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Mark own read" ON public.academy_notifications;
CREATE POLICY "Mark own read" ON public.academy_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Clear own" ON public.academy_notifications;
CREATE POLICY "Clear own" ON public.academy_notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.academy_slug(p_program UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT slug FROM academy_programs WHERE id = p_program; $$;

-- Who should hear about something: one student, all current students, or the program's mentors.
CREATE OR REPLACE FUNCTION public.academy_notify(p_users UUID[], p_program UUID, p_kind TEXT, p_title TEXT, p_body TEXT, p_link TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO academy_notifications (user_id, program_id, kind, title, body, link)
  SELECT DISTINCT u, p_program, p_kind, p_title, left(p_body, 300), p_link
  FROM unnest(p_users) AS u
  WHERE u IS NOT NULL AND u IS DISTINCT FROM auth.uid();
$$;
REVOKE ALL ON FUNCTION public.academy_notify(UUID[], UUID, TEXT, TEXT, TEXT, TEXT) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.academy_mentor_ids(p_program UUID)
RETURNS UUID[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT coalesce(array_agg(user_id), '{}') FROM academy_mentors WHERE program_id = p_program; $$;
REVOKE ALL ON FUNCTION public.academy_mentor_ids(UUID) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.academy_class_ids(p_program UUID)
RETURNS UUID[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT coalesce(array_agg(id), '{}') FROM public.academy_member_ids(p_program) AS m(id); $$;
REVOKE ALL ON FUNCTION public.academy_class_ids(UUID) FROM public, anon, authenticated;

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
    PERFORM public.academy_notify(CASE WHEN NEW.student_id IS NOT NULL THEN ARRAY[NEW.student_id] ELSE public.academy_class_ids(NEW.program_id) END,
      NEW.program_id, 'session', 'Session scheduled: ' || NEW.title, to_char(NEW.starts_at AT TIME ZONE 'America/New_York', 'Dy Mon DD, HH12:MI AM') || ' ET',
      v_base || '/sessions');
  ELSIF TG_TABLE_NAME = 'academy_certificates' THEN
    PERFORM public.academy_notify(ARRAY[NEW.user_id], NEW.program_id, 'certificate', 'You earned a certificate', NEW.title, v_base || '/progress');
  ELSIF TG_TABLE_NAME = 'academy_posts' THEN
    PERFORM public.academy_notify(ARRAY[(SELECT author_id FROM academy_threads WHERE id = NEW.thread_id)], NEW.program_id, 'reply',
      coalesce(NEW.author_name, 'Someone') || ' replied to your discussion', NEW.body, v_base || '/discussions/' || NEW.thread_id);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'academy notification skipped: %', SQLERRM;  -- never block the real write
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS academy_messages_notify ON public.academy_messages;
CREATE TRIGGER academy_messages_notify AFTER INSERT ON public.academy_messages FOR EACH ROW EXECUTE FUNCTION public.academy_notify_events();
DROP TRIGGER IF EXISTS academy_announcements_notify ON public.academy_announcements;
CREATE TRIGGER academy_announcements_notify AFTER INSERT ON public.academy_announcements FOR EACH ROW EXECUTE FUNCTION public.academy_notify_events();
DROP TRIGGER IF EXISTS academy_assignments_notify ON public.academy_assignments;
CREATE TRIGGER academy_assignments_notify AFTER INSERT OR UPDATE OF is_published ON public.academy_assignments FOR EACH ROW EXECUTE FUNCTION public.academy_notify_events();
DROP TRIGGER IF EXISTS academy_quizzes_notify ON public.academy_quizzes;
CREATE TRIGGER academy_quizzes_notify AFTER INSERT OR UPDATE OF is_published ON public.academy_quizzes FOR EACH ROW EXECUTE FUNCTION public.academy_notify_events();
DROP TRIGGER IF EXISTS academy_submissions_notify ON public.academy_submissions;
CREATE TRIGGER academy_submissions_notify AFTER INSERT OR UPDATE OF status ON public.academy_submissions FOR EACH ROW EXECUTE FUNCTION public.academy_notify_events();
DROP TRIGGER IF EXISTS academy_sessions_notify ON public.academy_sessions;
CREATE TRIGGER academy_sessions_notify AFTER INSERT ON public.academy_sessions FOR EACH ROW EXECUTE FUNCTION public.academy_notify_events();
DROP TRIGGER IF EXISTS academy_certificates_notify ON public.academy_certificates;
CREATE TRIGGER academy_certificates_notify AFTER INSERT ON public.academy_certificates FOR EACH ROW EXECUTE FUNCTION public.academy_notify_events();
DROP TRIGGER IF EXISTS academy_posts_notify ON public.academy_posts;
CREATE TRIGGER academy_posts_notify AFTER INSERT ON public.academy_posts FOR EACH ROW EXECUTE FUNCTION public.academy_notify_events();

-- Live updates
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.academy_notifications;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.academy_posts;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
