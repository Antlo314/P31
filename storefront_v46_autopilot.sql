/* ============================================================
   P31 - v46: content autopilot
   Run after v45. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v46_autopilot.sql
   The result is one row: settings_ready true, batches_ready true,
   items_ready true, autopilot_scheduled true.

   Every morning the content-autopilot function looks at the posting
   calendar. When the next stretch has fewer posts a day than wanted
   (and it is close, a week out by default), it drafts the next two
   weeks in the CEO quote-card look (quotes, prayers, scripture, fill in
   the blank, curator and mentorship invitations), with captions, at
   good times, and emails the approvers a review link. Nothing posts
   until someone approves: on that page each post can be removed or its
   caption changed, then Approve draws the cards and schedules them.

   1. autopilot_settings: one row (on or off, posts a day, days per
      batch, how far ahead to start, the mix, who approves).
   2. autopilot_batches: each drafted batch and its review link (only
      a fingerprint of the link is kept).
   3. autopilot_items: the posts in a batch.
   4. The daily schedule (14:30 UTC, mid-morning Eastern).
   ============================================================ */

-- ----------------------------------------------------------
-- 1. Settings (one row)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.autopilot_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  posts_per_day INTEGER NOT NULL DEFAULT 2 CHECK (posts_per_day BETWEEN 1 AND 4),
  days_per_batch INTEGER NOT NULL DEFAULT 14 CHECK (days_per_batch BETWEEN 3 AND 31),
  lead_days INTEGER NOT NULL DEFAULT 7 CHECK (lead_days BETWEEN 2 AND 21),
  mix JSONB NOT NULL DEFAULT '{"quote": 45, "prayer": 10, "scripture": 15, "blank": 10, "curator": 10, "mentorship": 10}'::jsonb,
  approvers TEXT[] NOT NULL DEFAULT ARRAY['ceo@p31market.com']::TEXT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
INSERT INTO public.autopilot_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.autopilot_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Studio team reads autopilot" ON public.autopilot_settings;
CREATE POLICY "Studio team reads autopilot" ON public.autopilot_settings
  FOR SELECT TO authenticated USING (public.is_studio_member());
DROP POLICY IF EXISTS "Studio team sets autopilot" ON public.autopilot_settings;
CREATE POLICY "Studio team sets autopilot" ON public.autopilot_settings
  FOR UPDATE TO authenticated USING (public.is_studio_member()) WITH CHECK (public.is_studio_member());
GRANT SELECT, UPDATE ON public.autopilot_settings TO authenticated;

-- ----------------------------------------------------------
-- 2. Batches
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.autopilot_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'awaiting' CHECK (status IN ('awaiting', 'scheduled', 'declined', 'expired')),
  first_day DATE,
  last_day DATE,
  token_hash TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'cron',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  emailed_at TIMESTAMPTZ,
  reminded_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  decided_by TEXT,
  note TEXT,
  scheduled_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS autopilot_batches_recent ON public.autopilot_batches (created_at DESC);
ALTER TABLE public.autopilot_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Studio team reads batches" ON public.autopilot_batches;
CREATE POLICY "Studio team reads batches" ON public.autopilot_batches
  FOR SELECT TO authenticated USING (public.is_studio_member());
GRANT SELECT ON public.autopilot_batches TO authenticated;

-- ----------------------------------------------------------
-- 3. Items
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.autopilot_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.autopilot_batches(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  post_at TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL,
  template TEXT NOT NULL,
  words JSONB NOT NULL DEFAULT '{}'::jsonb,
  style TEXT,
  pattern TEXT,
  seed INTEGER,
  line TEXT,
  caption_ig TEXT NOT NULL,
  caption_fb TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'removed', 'scheduled', 'failed', 'skipped')),
  media_url TEXT,
  zernio_post_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS autopilot_items_batch ON public.autopilot_items (batch_id, position);
CREATE INDEX IF NOT EXISTS autopilot_items_line ON public.autopilot_items (lower(line));
ALTER TABLE public.autopilot_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Studio team reads items" ON public.autopilot_items;
CREATE POLICY "Studio team reads items" ON public.autopilot_items
  FOR SELECT TO authenticated USING (public.is_studio_member());
GRANT SELECT ON public.autopilot_items TO authenticated;

-- ----------------------------------------------------------
-- 4. The daily schedule
-- ----------------------------------------------------------
DO $jobs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron WITH SCHEMA pg_catalog;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    CREATE EXTENSION pg_net WITH SCHEMA extensions;
  END IF;
END;
$jobs$;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'p31-autopilot';

-- 14:30 UTC every day (10:30 or 9:30 AM Eastern): draft when the calendar runs low, remind, expire.
SELECT cron.schedule('p31-autopilot', '30 14 * * *', $job$
  SELECT net.http_post(
    url := 'https://xsnhxjttdizljaawpumz.supabase.co/functions/v1/content-autopilot',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source": "cron"}'::jsonb,
    timeout_milliseconds := 120000);
$job$);

-- ----------------------------------------------------------
-- 5. Record this script, then one row to prove it
-- ----------------------------------------------------------
DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (46, 'content autopilot') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  EXISTS (SELECT 1 FROM public.autopilot_settings WHERE id = 1) AS settings_ready,
  to_regclass('public.autopilot_batches') IS NOT NULL AS batches_ready,
  to_regclass('public.autopilot_items') IS NOT NULL AS items_ready,
  EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'p31-autopilot') AS autopilot_scheduled;
