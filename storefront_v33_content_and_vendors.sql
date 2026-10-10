/* ============================================================
   P31 — v33: content planner, sound board, vendor lineups
   Run after v32. Safe to run more than once.

   1. content_plan: the social calendar, months ahead. Every post idea
      moves idea → draft → ready → approved → scheduled → posted. Carla
      and the AI helpers fill in hooks, captions and hashtags; Yanni (or
      an admin) approves, and only then is it sent to Zernio.
   2. sound_board: Instagram audio the team wants to use (trending
      picks from the Audio API, plus notes), so a reel can be posted
      with a catalog track attached.
   3. event_vendors: which approved vendors are in which market, with
      booth and check-in, shown publicly on Market dates once the
      lineup is published.
   Content Studio people (admins, Studio seats, the Content Studio
   tool) run 1 and 2; admins and Systems operators run 3.
   ============================================================ */

-- ──────────────────────────────────────────────────────────
-- 1. Content planner
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_date DATE NOT NULL,
  post_time TIME,
  platforms TEXT[] NOT NULL DEFAULT ARRAY['instagram', 'facebook'],
  kind TEXT NOT NULL DEFAULT 'reel' CHECK (kind IN ('reel', 'photo', 'carousel', 'story')),
  pillar TEXT,
  theme TEXT,
  hook TEXT,
  caption TEXT,
  hashtags TEXT,
  first_comment TEXT,
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  audio_id TEXT,
  audio_title TEXT,
  status TEXT NOT NULL DEFAULT 'idea' CHECK (status IN ('idea', 'draft', 'ready', 'approved', 'scheduled', 'posted', 'skipped')),
  zernio_post_id TEXT,
  scheduled_for TIMESTAMPTZ,
  notes TEXT,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_plan_date_idx ON public.content_plan (post_date, post_time);
CREATE INDEX IF NOT EXISTS content_plan_status_idx ON public.content_plan (status, post_date);

ALTER TABLE public.content_plan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Studio runs the planner" ON public.content_plan;
CREATE POLICY "Studio runs the planner" ON public.content_plan FOR ALL TO authenticated
  USING (public.is_studio_member()) WITH CHECK (public.is_studio_member());

DROP TRIGGER IF EXISTS touch_content_plan ON public.content_plan;
CREATE TRIGGER touch_content_plan BEFORE UPDATE ON public.content_plan
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ──────────────────────────────────────────────────────────
-- 2. Sound board
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sound_board (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_id TEXT NOT NULL,
  title TEXT,
  artist TEXT,
  audio_type TEXT,
  duration_ms INTEGER,
  artwork_url TEXT,
  mood TEXT,
  note TEXT,
  trending_seen_at TIMESTAMPTZ,
  used_count INTEGER NOT NULL DEFAULT 0,
  added_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (audio_id)
);
ALTER TABLE public.sound_board ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Studio keeps the sound board" ON public.sound_board;
CREATE POLICY "Studio keeps the sound board" ON public.sound_board FOR ALL TO authenticated
  USING (public.is_studio_member()) WITH CHECK (public.is_studio_member());

-- ──────────────────────────────────────────────────────────
-- 3. Vendor lineups per market
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.market_events(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.vendor_applications(id) ON DELETE SET NULL,
  curator_id UUID REFERENCES public.curator_data(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  website_social TEXT,
  categories TEXT[] NOT NULL DEFAULT '{}',
  booth TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'confirmed', 'paid', 'checked_in', 'no_show', 'cancelled')),
  is_public BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, business_name)
);
CREATE INDEX IF NOT EXISTS event_vendors_event_idx ON public.event_vendors (event_id, status);

ALTER TABLE public.market_events ADD COLUMN IF NOT EXISTS lineup_public BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.event_vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team manages lineups" ON public.event_vendors;
CREATE POLICY "Team manages lineups" ON public.event_vendors FOR ALL TO authenticated
  USING (public.is_academy_admin() OR public.is_operator()) WITH CHECK (public.is_academy_admin() OR public.is_operator());

DROP TRIGGER IF EXISTS touch_event_vendors ON public.event_vendors;
CREATE TRIGGER touch_event_vendors BEFORE UPDATE ON public.event_vendors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- The public lineup: only published events, only confirmed vendors, only public fields.
CREATE OR REPLACE FUNCTION public.event_lineup(p_event UUID)
RETURNS TABLE (business_name TEXT, website_social TEXT, categories TEXT[], booth TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT v.business_name, v.website_social, v.categories, v.booth
  FROM event_vendors v JOIN market_events e ON e.id = v.event_id
  WHERE v.event_id = p_event AND e.lineup_public AND e.is_active AND v.is_public
    AND v.status IN ('confirmed', 'paid', 'checked_in')
  ORDER BY v.booth NULLS LAST, v.business_name;
$fn$;
GRANT EXECUTE ON FUNCTION public.event_lineup(UUID) TO anon, authenticated;

-- A vendor application the team approves can be added to a lineup in one step.
CREATE OR REPLACE FUNCTION public.lineup_add_application(p_event UUID, p_application UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_id UUID; a RECORD;
BEGIN
  IF NOT (public.is_academy_admin() OR public.is_operator()) THEN RAISE EXCEPTION 'Team only'; END IF;
  SELECT * INTO a FROM vendor_applications WHERE id = p_application;
  IF a IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
  INSERT INTO event_vendors (event_id, application_id, business_name, contact_name, email, website_social, categories, status)
  VALUES (p_event, a.id, a.business_name, a.full_name, a.email, a.website_social, a.categories, 'invited')
  ON CONFLICT (event_id, business_name) DO UPDATE SET application_id = EXCLUDED.application_id
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.lineup_add_application(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.lineup_add_application(UUID, UUID) TO authenticated;
