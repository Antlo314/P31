-- ============================================================
-- Storefront v36: Content Studio auto-create
--   1. content_plan learns about generated cards and series
--   2. content_library: the verses, prompts, choices, quizzes and invitations the
--      auto-create draws from (the team adds its own; the app ships a starter set)
--   3. content_series: one row per batch the team generated (settings kept for reruns)
-- Run after v35 in the Supabase SQL editor.
-- ============================================================

ALTER TABLE public.content_plan
ADD COLUMN IF NOT EXISTS series_id UUID,
ADD COLUMN IF NOT EXISTS card JSONB,          -- the drawn card: { type, style, text, answer, ref, options... }
ADD COLUMN IF NOT EXISTS source_key TEXT;     -- which library item it came from, so it is not repeated

CREATE INDEX IF NOT EXISTS content_plan_series_idx ON public.content_plan (series_id);
CREATE INDEX IF NOT EXISTS content_plan_source_idx ON public.content_plan (source_key);

CREATE TABLE IF NOT EXISTS public.content_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('verse', 'prompt', 'choice', 'quiz', 'amen', 'invite', 'tip')),
  key TEXT NOT NULL UNIQUE,
  text TEXT NOT NULL,                 -- the verse (without the blank word), the sentence, the question, the tip
  answer TEXT,                        -- the blanked word (verse), the correct option letter (quiz)
  ref TEXT,                           -- scripture reference
  options JSONB,                      -- choices or quiz options
  caption TEXT,                       -- optional caption override
  active BOOLEAN NOT NULL DEFAULT TRUE,
  used_count INTEGER NOT NULL DEFAULT 0,
  last_used DATE,
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Studio keeps the library" ON public.content_library;
CREATE POLICY "Studio keeps the library" ON public.content_library FOR ALL TO authenticated
  USING (public.is_studio_member()) WITH CHECK (public.is_studio_member());

CREATE TABLE IF NOT EXISTS public.content_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  post_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.content_series ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Studio keeps its series" ON public.content_series;
CREATE POLICY "Studio keeps its series" ON public.content_series FOR ALL TO authenticated
  USING (public.is_studio_member()) WITH CHECK (public.is_studio_member());

-- Mark library items used when a generated post is scheduled.
CREATE OR REPLACE FUNCTION public.content_library_touch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'scheduled' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'scheduled') AND NEW.source_key IS NOT NULL THEN
    UPDATE content_library SET used_count = used_count + 1, last_used = NEW.post_date WHERE key = NEW.source_key;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS content_library_touch ON public.content_plan;
CREATE TRIGGER content_library_touch AFTER INSERT OR UPDATE OF status ON public.content_plan
  FOR EACH ROW EXECUTE FUNCTION public.content_library_touch();
