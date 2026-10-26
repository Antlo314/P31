/* ============================================================
   P31 - v65: the posting schedule (Systems > Posting schedule)
   Run after v46 (the content autopilot). Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v65_posting_schedule.sql
   The result is one row: schedule_column true, schedule_checked true,
   posts_per_day_up_to_8 true, items_brand true, version_recorded true.

   Full control of how often the autopilot drafts posts, per brand.

   1. autopilot_settings.schedule (JSONB, empty by default). Empty means
      the autopilot works exactly as before: posts_per_day for the
      Marketplace, the usual good times, Market Instagram and Facebook.
      When set, it has this shape:
        {
          "market": {
            "enabled": true,
            "posts_per_day": 3,              0 to 8
            "days": [1, 2, 3, 4, 5, 6],      weekdays, Sunday = 0
            "times": ["12:30", "15:00", "19:30"],
                                             Eastern, 24-hour, one per post a day,
                                             unique and sorted; or the word "best"
                                             for the usual good times
            "platforms": { "instagram": true, "facebook": true, "tiktok": false }
          },
          "collective": {
            "enabled": true,
            "posts_per_day": 1,
            "days": [0, 1, 2, 3, 4, 5, 6],
            "times": "best",
            "platforms": { "instagram": true }
          }
        }
      Marketplace posts go to the Market Instagram and Facebook (and the
      Market TikTok when chosen); Collective posts go to the Collective
      Instagram. A check keeps the shape sane (keys, 0 to 8, weekdays 0
      to 6, HH:MM times, at most 8 of them).
   2. posts_per_day may now be 1 to 8 (it was 1 to 4). Whatever check
      the column had is found by its definition and replaced.
   3. autopilot_items.brand and autopilot_items.platforms: which brand a
      drafted post is for and where it goes, so the review page can say
      Marketplace or Collective on each card. Empty on older posts.
   Nothing else changes: the review link, the approvers and the rule
   that nothing posts without approval stay the same.
   ============================================================ */

-- ----------------------------------------------------------
-- 1. The schedule column and its shape check
-- ----------------------------------------------------------
ALTER TABLE public.autopilot_settings ADD COLUMN IF NOT EXISTS schedule JSONB;

CREATE OR REPLACE FUNCTION public.autopilot_schedule_valid(s JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $fn$
DECLARE
  k TEXT;
  v JSONB;
  x JSONB;
BEGIN
  IF s IS NULL OR jsonb_typeof(s) = 'null' THEN
    RETURN true;
  END IF;
  IF jsonb_typeof(s) <> 'object' THEN
    RETURN false;
  END IF;
  FOR k, v IN SELECT e.key, e.value FROM jsonb_each(s) AS e LOOP
    IF k NOT IN ('market', 'collective') OR jsonb_typeof(v) <> 'object' THEN
      RETURN false;
    END IF;
    IF (v -> 'enabled') IS NOT NULL AND jsonb_typeof(v -> 'enabled') <> 'boolean' THEN
      RETURN false;
    END IF;
    IF (v -> 'posts_per_day') IS NOT NULL THEN
      IF jsonb_typeof(v -> 'posts_per_day') <> 'number' THEN
        RETURN false;
      END IF;
      IF (v ->> 'posts_per_day')::NUMERIC NOT IN (0, 1, 2, 3, 4, 5, 6, 7, 8) THEN
        RETURN false;
      END IF;
    END IF;
    IF (v -> 'days') IS NOT NULL THEN
      IF jsonb_typeof(v -> 'days') <> 'array' OR jsonb_array_length(v -> 'days') > 7 THEN
        RETURN false;
      END IF;
      FOR x IN SELECT d.value FROM jsonb_array_elements(v -> 'days') AS d LOOP
        IF jsonb_typeof(x) <> 'number' OR (x #>> '{}')::NUMERIC NOT IN (0, 1, 2, 3, 4, 5, 6) THEN
          RETURN false;
        END IF;
      END LOOP;
    END IF;
    IF (v -> 'times') IS NOT NULL THEN
      IF jsonb_typeof(v -> 'times') = 'string' THEN
        IF (v ->> 'times') <> 'best' THEN
          RETURN false;
        END IF;
      ELSIF jsonb_typeof(v -> 'times') = 'array' THEN
        IF jsonb_array_length(v -> 'times') > 8 THEN
          RETURN false;
        END IF;
        FOR x IN SELECT t.value FROM jsonb_array_elements(v -> 'times') AS t LOOP
          IF jsonb_typeof(x) <> 'string' OR (x #>> '{}') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
            RETURN false;
          END IF;
        END LOOP;
      ELSE
        RETURN false;
      END IF;
    END IF;
    IF (v -> 'platforms') IS NOT NULL AND jsonb_typeof(v -> 'platforms') <> 'object' THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$fn$;

ALTER TABLE public.autopilot_settings DROP CONSTRAINT IF EXISTS autopilot_settings_schedule_check;
ALTER TABLE public.autopilot_settings ADD CONSTRAINT autopilot_settings_schedule_check
  CHECK (public.autopilot_schedule_valid(schedule));

-- ----------------------------------------------------------
-- 2. Posts a day: 1 to 8
-- ----------------------------------------------------------
DO $ppd$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.autopilot_settings'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%posts_per_day%'
  LOOP
    EXECUTE format('ALTER TABLE public.autopilot_settings DROP CONSTRAINT %I', c.conname);
  END LOOP;
END;
$ppd$;

ALTER TABLE public.autopilot_settings ADD CONSTRAINT autopilot_settings_posts_per_day_check
  CHECK (posts_per_day BETWEEN 1 AND 8);

-- ----------------------------------------------------------
-- 3. Which brand each drafted post is for, and where it goes
-- ----------------------------------------------------------
ALTER TABLE public.autopilot_items ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.autopilot_items ADD COLUMN IF NOT EXISTS platforms TEXT[];
ALTER TABLE public.autopilot_items DROP CONSTRAINT IF EXISTS autopilot_items_brand_check;
ALTER TABLE public.autopilot_items ADD CONSTRAINT autopilot_items_brand_check
  CHECK (brand IS NULL OR brand IN ('market', 'collective'));

-- ----------------------------------------------------------
-- 4. Record this script, then one row to prove it
-- ----------------------------------------------------------
DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (65, 'posting schedule') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'autopilot_settings' AND column_name = 'schedule') AS schedule_column,
  EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.autopilot_settings'::regclass AND conname = 'autopilot_settings_schedule_check') AS schedule_checked,
  (SELECT count(*) FROM pg_constraint
    WHERE conrelid = 'public.autopilot_settings'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%posts_per_day%'
      AND pg_get_constraintdef(oid) LIKE '%8%') = 1 AS posts_per_day_up_to_8,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'autopilot_items' AND column_name IN ('brand', 'platforms')) = 2 AS items_brand,
  CASE WHEN to_regclass('public.schema_versions') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM public.schema_versions WHERE version = 65', false, true, '')::text <> ''
  END AS version_recorded;
