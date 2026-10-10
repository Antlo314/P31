/* ============================================================
   P31 — v28: error reporting
   Run after v27. Safe to run more than once.

   When a page crashes on either site, the browser reports it here
   (log_app_error). The same error is grouped into one row with a
   count, so a crash that hits 200 visitors is one line, not 200.
   Only admins and Systems operators can read or resolve them
   (Systems → Health).
   ============================================================ */

CREATE TABLE IF NOT EXISTS public.app_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'error' CHECK (kind IN ('render', 'error', 'promise', 'chunk')),
  message TEXT NOT NULL,
  stack TEXT,
  path TEXT,
  site TEXT,
  release TEXT,
  user_agent TEXT,
  last_user UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  count INTEGER NOT NULL DEFAULT 1,
  users INTEGER NOT NULL DEFAULT 1,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS app_errors_fingerprint_key ON public.app_errors (fingerprint);
CREATE INDEX IF NOT EXISTS app_errors_last_seen_idx ON public.app_errors (last_seen DESC);

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team reads errors" ON public.app_errors;
CREATE POLICY "Team reads errors" ON public.app_errors FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_operator() OR public.is_academy_admin());
DROP POLICY IF EXISTS "Team resolves errors" ON public.app_errors;
CREATE POLICY "Team resolves errors" ON public.app_errors FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.is_operator() OR public.is_academy_admin())
  WITH CHECK (public.is_admin() OR public.is_operator() OR public.is_academy_admin());
-- No insert policy: browsers report through log_app_error() only.

CREATE OR REPLACE FUNCTION public.log_app_error(p JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_kind TEXT := CASE WHEN p->>'kind' IN ('render', 'error', 'promise', 'chunk') THEN p->>'kind' ELSE 'error' END;
  v_message TEXT := left(trim(coalesce(p->>'message', '')), 500);
  v_path TEXT := left(coalesce(p->>'path', ''), 200);
  v_site TEXT := CASE WHEN p->>'site' IN ('market', 'collective') THEN p->>'site' ELSE NULL END;
  v_fp TEXT;
BEGIN
  IF v_message = '' THEN RETURN; END IF;
  -- Flood guard: far more reports than real crashes produce.
  IF (SELECT coalesce(sum(1), 0) FROM app_errors WHERE last_seen > now() - interval '1 minute') > 120 THEN RETURN; END IF;

  -- Same message on the same page (ignoring ids and numbers) = the same error.
  v_fp := md5(v_kind || '|' || regexp_replace(v_message, '[0-9a-f]{8}-[0-9a-f-]{27,}|\d+', '#', 'g') || '|'
              || regexp_replace(v_path, '/[0-9a-f]{8}-[0-9a-f-]{27,}|/\d+', '/#', 'g'));

  INSERT INTO app_errors (fingerprint, kind, message, stack, path, site, release, user_agent, last_user)
  VALUES (v_fp, v_kind, v_message, left(p->>'stack', 4000), v_path, v_site, left(p->>'release', 60), left(p->>'user_agent', 300), auth.uid())
  ON CONFLICT (fingerprint) DO UPDATE SET
    count = app_errors.count + 1,
    users = app_errors.users + CASE WHEN auth.uid() IS DISTINCT FROM app_errors.last_user THEN 1 ELSE 0 END,
    last_seen = now(),
    last_user = coalesce(auth.uid(), app_errors.last_user),
    stack = coalesce(EXCLUDED.stack, app_errors.stack),
    release = coalesce(EXCLUDED.release, app_errors.release),
    user_agent = EXCLUDED.user_agent,
    -- It came back: reopen it.
    resolved_at = NULL,
    resolved_by = NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN;  -- reporting must never cause a second error
END;
$fn$;
REVOKE ALL ON FUNCTION public.log_app_error(JSONB) FROM public;
GRANT EXECUTE ON FUNCTION public.log_app_error(JSONB) TO anon, authenticated;
