/* ============================================================
   P31 — v29: team access + DaVinci clip jobs
   Run after v28. Safe to run more than once.

   Who gets what:
     - Admins (P31 admins and Systems operators) keep full control
       of everything, exactly as today.
     - Team members get only the tools an admin gives them, by email:
         studio   → Content Studio
         davinci  → DaVinci (Pro Edit + the long-footage clip finder)
       Access starts the first time they sign in with that email at
       /portal, and only once the email address is confirmed, so nobody
       can claim someone else's address.
     - Students keep their own classroom (faith or business).

   Starting grants (from the team directory):
     Anthony Carr   vendor@p31market.com     DaVinci
     Yanni Bratcher marketing@p31market.com  Content Studio
   Change them any time in Systems → Team access.
   ============================================================ */

-- ──────────────────────────────────────────────────────────
-- 1. Grants by email
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_access (
  email TEXT PRIMARY KEY CHECK (email = lower(trim(email)) AND email LIKE '%_@_%._%'),
  full_name TEXT,
  tools TEXT[] NOT NULL DEFAULT '{}' CHECK (tools <@ ARRAY['studio', 'davinci']::TEXT[]),
  note TEXT,
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_access ENABLE ROW LEVEL SECURITY;

-- The signed-in person's address, only once they've confirmed it.
CREATE OR REPLACE FUNCTION public.my_confirmed_email()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT lower(u.email) FROM auth.users u
  WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL;
$fn$;
REVOKE ALL ON FUNCTION public.my_confirmed_email() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_confirmed_email() TO authenticated;

-- Tools granted to the signed-in person (admins: every tool).
CREATE OR REPLACE FUNCTION public.my_team_tools()
RETURNS TEXT[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN '{}'::TEXT[]
    WHEN public.is_academy_admin() THEN ARRAY['studio', 'davinci']::TEXT[]
    ELSE coalesce((SELECT t.tools FROM public.team_access t WHERE t.email = public.my_confirmed_email()), '{}'::TEXT[])
  END;
$fn$;
REVOKE ALL ON FUNCTION public.my_team_tools() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_team_tools() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_team_tool(p_tool TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT p_tool = ANY (public.my_team_tools());
$fn$;
REVOKE ALL ON FUNCTION public.has_team_tool(TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_team_tool(TEXT) TO authenticated;

DROP POLICY IF EXISTS "Admins manage team access" ON public.team_access;
CREATE POLICY "Admins manage team access" ON public.team_access FOR ALL TO authenticated
  USING (public.is_academy_admin()) WITH CHECK (public.is_academy_admin());
DROP POLICY IF EXISTS "See your own access" ON public.team_access;
CREATE POLICY "See your own access" ON public.team_access FOR SELECT TO authenticated
  USING (email = public.my_confirmed_email());

DROP TRIGGER IF EXISTS touch_team_access ON public.team_access;
CREATE TRIGGER touch_team_access BEFORE UPDATE ON public.team_access
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- For Systems → Team access: has each person made their account yet? (admins only)
CREATE OR REPLACE FUNCTION public.team_access_status()
RETURNS TABLE (email TEXT, has_account BOOLEAN, confirmed BOOLEAN, last_sign_in TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
  SELECT t.email, u.id IS NOT NULL, u.email_confirmed_at IS NOT NULL, u.last_sign_in_at
  FROM public.team_access t
  LEFT JOIN auth.users u ON lower(u.email) = t.email;
END;
$fn$;
REVOKE ALL ON FUNCTION public.team_access_status() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.team_access_status() TO authenticated;

INSERT INTO public.team_access (email, full_name, tools, note) VALUES
  ('vendor@p31market.com', 'Anthony Carr', ARRAY['davinci'], 'Marketplace Tech Support'),
  ('marketing@p31market.com', 'Yanni Bratcher', ARRAY['studio'], 'Marketing Strategist')
ON CONFLICT (email) DO NOTHING;


-- ──────────────────────────────────────────────────────────
-- 2. Content Studio: admins, Studio seats, and anyone given "studio"
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_studio_member()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT public.is_academy_admin()
      OR EXISTS (SELECT 1 FROM studio_members WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM team_access t WHERE t.email = public.my_confirmed_email() AND 'studio' = ANY (t.tools));
$fn$;


-- ──────────────────────────────────────────────────────────
-- 3. DaVinci: long footage → several clips, each with its own look and music
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.pro_edit_jobs ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'edit';
ALTER TABLE public.pro_edit_jobs ADD COLUMN IF NOT EXISTS music_path TEXT;
ALTER TABLE public.pro_edit_jobs ADD COLUMN IF NOT EXISTS batch_id UUID;
ALTER TABLE public.pro_edit_jobs ADD COLUMN IF NOT EXISTS clip_index INT;
ALTER TABLE public.pro_edit_jobs ADD COLUMN IF NOT EXISTS clip_count INT;
ALTER TABLE public.pro_edit_jobs ADD COLUMN IF NOT EXISTS source_name TEXT;
ALTER TABLE public.pro_edit_jobs ADD COLUMN IF NOT EXISTS clip_start NUMERIC;
ALTER TABLE public.pro_edit_jobs ADD COLUMN IF NOT EXISTS clip_end NUMERIC;
DO $do$
BEGIN
  ALTER TABLE public.pro_edit_jobs ADD CONSTRAINT pro_edit_jobs_kind_check CHECK (kind IN ('edit', 'clip'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$do$;
CREATE INDEX IF NOT EXISTS pro_edit_jobs_batch_idx ON public.pro_edit_jobs (batch_id, clip_index);

-- Requests: premium curators (their paid add-on) and DaVinci team members.
DROP POLICY IF EXISTS "Request pro edits" ON public.pro_edit_jobs;
CREATE POLICY "Request pro edits" ON public.pro_edit_jobs FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND (public.is_premium_curator() OR public.has_team_tool('davinci')));

DROP POLICY IF EXISTS "See own pro edits" ON public.pro_edit_jobs;
CREATE POLICY "See own pro edits" ON public.pro_edit_jobs FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_team_tool('davinci') OR public.is_admin());

DROP POLICY IF EXISTS "Operators update pro edits" ON public.pro_edit_jobs;
CREATE POLICY "Operators update pro edits" ON public.pro_edit_jobs FOR UPDATE TO authenticated
  USING (public.has_team_tool('davinci')) WITH CHECK (public.has_team_tool('davinci'));

-- Footage and music live in the private 'studio' bucket under <user id>/…
-- DaVinci team members can open everyone's footage and post finished edits.
DROP POLICY IF EXISTS "Studio read own or operator" ON storage.objects;
CREATE POLICY "Studio read own or operator" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'studio' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_team_tool('davinci')));

DROP POLICY IF EXISTS "Studio operators write results" ON storage.objects;
CREATE POLICY "Studio operators write results" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'studio' AND public.has_team_tool('davinci'));

DROP POLICY IF EXISTS "Studio remove own files" ON storage.objects;
CREATE POLICY "Studio remove own files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'studio' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ──────────────────────────────────────────────────────────
-- 4. Dashboards: tell the site which tools this person has
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.my_roles()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT jsonb_build_object(
    'signed_in', auth.uid() IS NOT NULL,
    'admin', public.is_academy_admin(),
    'operator', to_regclass('public.system_operators') IS NOT NULL AND EXISTS (SELECT 1 FROM system_operators WHERE user_id = auth.uid()),
    'curator', EXISTS (SELECT 1 FROM curator_data WHERE id = auth.uid()),
    'studio', auth.uid() IS NOT NULL AND public.is_studio_member(),
    'tools', to_jsonb(public.my_team_tools()),
    'mentor', CASE WHEN auth.uid() IS NOT NULL AND public.is_academy_admin()
      THEN coalesce((SELECT jsonb_agg(slug ORDER BY sort_order) FROM academy_programs WHERE is_active), '[]'::jsonb)
      ELSE coalesce((SELECT jsonb_agg(p.slug ORDER BY p.sort_order) FROM academy_mentors m
                     JOIN academy_programs p ON p.id = m.program_id WHERE m.user_id = auth.uid()), '[]'::jsonb) END,
    'student', coalesce((SELECT jsonb_agg(jsonb_build_object('program', p.slug, 'title', p.title, 'status', e.status,
                          'access_until', e.access_until, 'has_access', public.has_academy_access(p.id)) ORDER BY p.sort_order)
                         FROM academy_enrollments e JOIN academy_programs p ON p.id = e.program_id
                         WHERE e.user_id = auth.uid()), '[]'::jsonb));
$fn$;
GRANT EXECUTE ON FUNCTION public.my_roles() TO authenticated;
