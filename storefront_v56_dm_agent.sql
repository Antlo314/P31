/* ============================================================
   P31 - v56: a smarter DM assistant (Carla)
   Run after v55. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v56_dm_agent.sql
   The result is one row: claims_ready true, handoffs_ready true.

   - dm_claims: one row per message Carla answers. The key is unique,
     so when Instagram or Facebook delivers the same message twice
     only the first delivery gets a reply. Old rows are cleared after
     30 days by dm-agent itself.
   - dm_handoffs: every question Carla passes to the team, with the
     conversation, why, and who handled it. It shows in the Content
     Studio under Messages as Waiting for the team, and is emailed.
   ============================================================ */

CREATE TABLE IF NOT EXISTS public.dm_claims (
  key TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dm_claims ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.dm_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  account_id TEXT,
  conversation_id TEXT,
  sender TEXT,
  question TEXT,
  reason TEXT,
  transcript TEXT,
  carla_reply TEXT,
  kind TEXT NOT NULL DEFAULT 'dm' CHECK (kind IN ('dm', 'comment', 'review')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS dm_handoffs_open_idx ON public.dm_handoffs (resolved_at, created_at DESC);
ALTER TABLE public.dm_handoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Social team sees handoffs" ON public.dm_handoffs;
CREATE POLICY "Social team sees handoffs" ON public.dm_handoffs FOR SELECT TO authenticated
  USING (public.is_academy_admin() OR public.has_tool('social') OR public.has_tool('studio'));
DROP POLICY IF EXISTS "Social team resolves handoffs" ON public.dm_handoffs;
CREATE POLICY "Social team resolves handoffs" ON public.dm_handoffs FOR UPDATE TO authenticated
  USING (public.is_academy_admin() OR public.has_tool('social') OR public.has_tool('studio'))
  WITH CHECK (public.is_academy_admin() OR public.has_tool('social') OR public.has_tool('studio'));

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (56, 'dm agent') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  to_regclass('public.dm_claims') IS NOT NULL AS claims_ready,
  to_regclass('public.dm_handoffs') IS NOT NULL AND EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dm_handoffs') AS handoffs_ready;
