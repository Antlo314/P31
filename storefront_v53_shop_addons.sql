/* ============================================================
   P31 - v53: storefront add-ons (product slots, Featured vendors,
   Google reviews) and Stripe-only shop payments
   Run after v52. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v53_shop_addons.sql
   The result is one row: addons_ready true, limit_ready true,
   featured_ready true, google_ready true, links_retired true,
   google_job_ready true.

   What it adds
   - app_settings key addons: products included in the plan (10),
     product slot packs (1 for 2 dollars, 7 for 10, 20 for 20 a month),
     Featured plans (2 posts for 25, 5 posts for 50 a month), the cap
     on paid Featured vendors a month (10) and posts for the CEO pick (1).
     Admins change these in Systems, Curators and shops.
   - shop_addons: each add-on subscription a shop buys on Stripe
   - a product limit per shop (plan + bonus + slot packs), checked when
     a product is added or switched back on
   - featured_posts: each social post a Featured shop is owed; the shop
     sends photos and a caption, it lands in the Studio planner as
     Ready for review, and its status follows the planner post
   - featured_picks: the CEO pick of the month (one free post)
   - Google Business details on each shop (filled by google-place,
     refreshed by the daily job p31-google-place)
   - Shops are paid only through Stripe now: the old Cash App, Venmo
     and pasted payment links are cleared
   ============================================================ */

INSERT INTO public.app_settings (key, value)
VALUES ('addons', '{"included_products": 10,
  "product_packs": [{"key": "p1", "slots": 1, "cents": 200}, {"key": "p7", "slots": 7, "cents": 1000}, {"key": "p20", "slots": 20, "cents": 2000}],
  "featured_plans": [{"key": "f2", "posts": 2, "cents": 2500}, {"key": "f5", "posts": 5, "cents": 5000}],
  "featured_cap": 10, "ceo_posts": 1, "google_refresh_days": 3}'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.curator_data ADD COLUMN IF NOT EXISTS bonus_products INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.curator_data ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
ALTER TABLE public.curator_data ADD COLUMN IF NOT EXISTS google_place_id TEXT;
ALTER TABLE public.curator_data ADD COLUMN IF NOT EXISTS google_place JSONB;
ALTER TABLE public.curator_data ADD COLUMN IF NOT EXISTS google_synced_at TIMESTAMPTZ;

-- Shops are paid only through Stripe (decided 2026-10-15).
UPDATE public.curator_data SET cashapp_tag = NULL, venmo_handle = NULL, stripe_link = NULL, other_payment_link = NULL, other_payment_label = NULL
 WHERE cashapp_tag IS NOT NULL OR venmo_handle IS NOT NULL OR stripe_link IS NOT NULL OR other_payment_link IS NOT NULL OR other_payment_label IS NOT NULL;

-- Each add-on a shop buys (one Stripe subscription each).
CREATE TABLE IF NOT EXISTS public.shop_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id UUID NOT NULL REFERENCES public.curator_data(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('products', 'featured')),
  plan_key TEXT NOT NULL,
  slots INTEGER NOT NULL DEFAULT 0,
  posts INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'checkout' CHECK (status IN ('checkout', 'active', 'past_due', 'canceled')),
  stripe_session_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_addons_shop_idx ON public.shop_addons (curator_id, kind, status);
ALTER TABLE public.shop_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shops see their add-ons" ON public.shop_addons;
CREATE POLICY "Shops see their add-ons" ON public.shop_addons FOR SELECT TO authenticated
  USING (curator_id = auth.uid() OR public.can_run_shops());
DROP POLICY IF EXISTS "Shop team manages add-ons" ON public.shop_addons;
CREATE POLICY "Shop team manages add-ons" ON public.shop_addons FOR ALL TO authenticated
  USING (public.can_run_shops()) WITH CHECK (public.can_run_shops());

-- How many products a shop may show: the plan, any bonus an admin gives, and active slot packs.
CREATE OR REPLACE FUNCTION public.shop_product_limit(p_curator UUID)
RETURNS INTEGER LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT coalesce((SELECT (value->>'included_products')::int FROM app_settings WHERE key = 'addons'), 10)
       + coalesce((SELECT bonus_products FROM curator_data WHERE id = p_curator), 0)
       + coalesce((SELECT sum(slots) FROM shop_addons WHERE curator_id = p_curator AND kind = 'products' AND status IN ('active', 'past_due')), 0)::int;
$fn$;
GRANT EXECUTE ON FUNCTION public.shop_product_limit(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.products_limit_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_limit INTEGER; v_count INTEGER;
BEGIN
  IF NEW.is_active IS FALSE THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_active IS NOT FALSE AND OLD.curator_id = NEW.curator_id THEN RETURN NEW; END IF;
  IF public.can_run_shops() THEN RETURN NEW; END IF;
  v_limit := public.shop_product_limit(NEW.curator_id);
  SELECT count(*) INTO v_count FROM products WHERE curator_id = NEW.curator_id AND is_active IS NOT FALSE AND id IS DISTINCT FROM NEW.id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Your shop can show % products. Add more product slots under Grow your shop, or hide a product first.', v_limit;
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS products_limit_guard ON public.products;
CREATE TRIGGER products_limit_guard BEFORE INSERT OR UPDATE OF is_active, curator_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_limit_guard();

-- When slots end, the newest products over the limit are hidden (never deleted). Returns how many.
CREATE OR REPLACE FUNCTION public.shop_enforce_product_limit(p_curator UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_limit INTEGER; v_hidden INTEGER;
BEGIN
  v_limit := public.shop_product_limit(p_curator);
  WITH extra AS (
    SELECT id FROM products WHERE curator_id = p_curator AND is_active IS NOT FALSE
     ORDER BY created_at DESC OFFSET 0
     LIMIT greatest((SELECT count(*) FROM products WHERE curator_id = p_curator AND is_active IS NOT FALSE) - v_limit, 0)
  )
  UPDATE products SET is_active = false WHERE id IN (SELECT id FROM extra);
  GET DIAGNOSTICS v_hidden = ROW_COUNT;
  RETURN v_hidden;
END;
$fn$;
REVOKE ALL ON FUNCTION public.shop_enforce_product_limit(UUID) FROM public, anon, authenticated;

-- The CEO pick of the month.
CREATE TABLE IF NOT EXISTS public.featured_picks (
  month DATE PRIMARY KEY,
  curator_id UUID NOT NULL REFERENCES public.curator_data(id) ON DELETE CASCADE,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.featured_picks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone sees the CEO pick" ON public.featured_picks;
CREATE POLICY "Anyone sees the CEO pick" ON public.featured_picks FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Shop team picks" ON public.featured_picks;
CREATE POLICY "Shop team picks" ON public.featured_picks FOR ALL TO authenticated
  USING (public.can_run_shops()) WITH CHECK (public.can_run_shops());

-- Each social post a shop is owed.
CREATE TABLE IF NOT EXISTS public.featured_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id UUID NOT NULL REFERENCES public.curator_data(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('paid', 'ceo')),
  addon_id UUID REFERENCES public.shop_addons(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'submitted', 'scheduled', 'posted', 'skipped')),
  product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
  caption TEXT,
  media JSONB NOT NULL DEFAULT '[]'::jsonb,
  vendor_note TEXT,
  team_note TEXT,
  plan_id UUID REFERENCES public.content_plan(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS featured_posts_shop_idx ON public.featured_posts (curator_id, month);
ALTER TABLE public.featured_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shops see their featured posts" ON public.featured_posts;
CREATE POLICY "Shops see their featured posts" ON public.featured_posts FOR SELECT TO authenticated
  USING (curator_id = auth.uid() OR public.can_run_shops());
DROP POLICY IF EXISTS "Shop team manages featured posts" ON public.featured_posts;
CREATE POLICY "Shop team manages featured posts" ON public.featured_posts FOR ALL TO authenticated
  USING (public.can_run_shops()) WITH CHECK (public.can_run_shops());

-- Posts owed this month: one row per post for every active Featured plan and the CEO pick.
-- Posts not yet out from earlier months stay open, so they roll over.
CREATE OR REPLACE FUNCTION public.featured_allocate()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_month DATE := date_trunc('month', now() AT TIME ZONE 'America/New_York')::date;
  v_made INTEGER := 0; r RECORD; v_have INTEGER; v_ceo INTEGER;
BEGIN
  FOR r IN SELECT id, curator_id, posts FROM shop_addons WHERE kind = 'featured' AND status = 'active' LOOP
    SELECT count(*) INTO v_have FROM featured_posts WHERE addon_id = r.id AND month = v_month;
    WHILE v_have < r.posts LOOP
      INSERT INTO featured_posts (curator_id, month, source, addon_id) VALUES (r.curator_id, v_month, 'paid', r.id);
      v_have := v_have + 1; v_made := v_made + 1;
    END LOOP;
  END LOOP;
  v_ceo := coalesce((SELECT (value->>'ceo_posts')::int FROM app_settings WHERE key = 'addons'), 1);
  FOR r IN SELECT curator_id FROM featured_picks WHERE month = v_month LOOP
    SELECT count(*) INTO v_have FROM featured_posts WHERE curator_id = r.curator_id AND month = v_month AND source = 'ceo';
    WHILE v_have < v_ceo LOOP
      INSERT INTO featured_posts (curator_id, month, source) VALUES (r.curator_id, v_month, 'ceo');
      v_have := v_have + 1; v_made := v_made + 1;
    END LOOP;
  END LOOP;
  RETURN v_made;
END;
$fn$;
REVOKE ALL ON FUNCTION public.featured_allocate() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.featured_allocate() TO authenticated;

CREATE OR REPLACE FUNCTION public.featured_picks_allocate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  -- A changed pick before anything was sent: the waiting posts move to the new shop.
  IF TG_OP = 'UPDATE' AND OLD.curator_id <> NEW.curator_id THEN
    DELETE FROM featured_posts WHERE curator_id = OLD.curator_id AND month = OLD.month AND source = 'ceo' AND status = 'waiting';
  END IF;
  PERFORM public.featured_allocate();
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS featured_picks_allocate ON public.featured_picks;
CREATE TRIGGER featured_picks_allocate AFTER INSERT OR UPDATE ON public.featured_picks
  FOR EACH ROW EXECUTE FUNCTION public.featured_picks_allocate();

-- The shop sends a photo set and caption for one post; it lands in the Studio planner as Ready for review.
CREATE OR REPLACE FUNCTION public.featured_submit(p_id UUID, p_caption TEXT, p_media JSONB, p_product BIGINT DEFAULT NULL, p_note TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_post featured_posts%ROWTYPE; v_shop curator_data%ROWTYPE; v_plan UUID; v_note TEXT;
BEGIN
  SELECT * INTO v_post FROM featured_posts WHERE id = p_id;
  IF NOT FOUND OR v_post.curator_id <> auth.uid() THEN RAISE EXCEPTION 'That post is not yours to send.'; END IF;
  IF v_post.status NOT IN ('waiting', 'submitted') THEN RAISE EXCEPTION 'That post is already scheduled.'; END IF;
  IF jsonb_typeof(p_media) <> 'array' OR jsonb_array_length(p_media) < 1 OR jsonb_array_length(p_media) > 10 THEN
    RAISE EXCEPTION 'Please add between 1 and 10 photos or videos.';
  END IF;
  IF length(coalesce(trim(p_caption), '')) < 10 THEN RAISE EXCEPTION 'Please write a short caption (a sentence or two).'; END IF;
  IF p_product IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = p_product AND curator_id = auth.uid()) THEN
    RAISE EXCEPTION 'Please choose one of your own products.';
  END IF;
  SELECT * INTO v_shop FROM curator_data WHERE id = v_post.curator_id;
  v_note := 'Featured vendor (' || CASE v_post.source WHEN 'ceo' THEN 'CEO pick' ELSE 'paid' END || '): ' || coalesce(v_shop.business_name, '')
    || ' - p31market.com/' || coalesce(v_shop.slug, v_shop.id::text)
    || CASE WHEN v_shop.instagram IS NOT NULL THEN ' - tag @' || ltrim(v_shop.instagram, '@') ELSE '' END
    || CASE WHEN p_note IS NOT NULL AND trim(p_note) <> '' THEN ' - from the shop: ' || trim(p_note) ELSE '' END;
  v_plan := v_post.plan_id;
  IF v_plan IS NULL OR NOT EXISTS (SELECT 1 FROM content_plan WHERE id = v_plan AND status IN ('idea', 'draft', 'ready', 'approved')) THEN
    INSERT INTO content_plan (post_date, post_time, platforms, kind, pillar, theme, caption, media, status, notes, source_key)
    VALUES ((now() AT TIME ZONE 'America/New_York')::date + 3, '12:00', ARRAY['instagram', 'facebook'],
            CASE WHEN jsonb_array_length(p_media) > 1 THEN 'carousel' ELSE 'photo' END,
            'Featured vendor', coalesce(v_shop.business_name, 'Featured vendor'), trim(p_caption), p_media, 'ready', v_note, 'featured:' || v_post.id)
    RETURNING id INTO v_plan;
  ELSE
    UPDATE content_plan SET caption = trim(p_caption), media = p_media, notes = v_note, status = 'ready',
      kind = CASE WHEN jsonb_array_length(p_media) > 1 THEN 'carousel' ELSE 'photo' END, updated_at = now()
     WHERE id = v_plan;
  END IF;
  UPDATE featured_posts SET caption = trim(p_caption), media = p_media, product_id = p_product, vendor_note = nullif(trim(coalesce(p_note, '')), ''),
    plan_id = v_plan, status = 'submitted', submitted_at = now(), updated_at = now()
   WHERE id = p_id;
  RETURN p_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.featured_submit(UUID, TEXT, JSONB, BIGINT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.featured_submit(UUID, TEXT, JSONB, BIGINT, TEXT) TO authenticated;

-- The planner post moves the featured post along: scheduled, posted or skipped.
CREATE OR REPLACE FUNCTION public.featured_follow_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NEW.source_key LIKE 'featured:%' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('scheduled', 'posted', 'skipped') THEN
    UPDATE featured_posts SET status = NEW.status,
      posted_at = CASE WHEN NEW.status = 'posted' THEN coalesce(posted_at, now()) ELSE posted_at END, updated_at = now()
     WHERE id::text = substr(NEW.source_key, 10);
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS featured_follow_plan ON public.content_plan;
CREATE TRIGGER featured_follow_plan AFTER UPDATE OF status ON public.content_plan
  FOR EACH ROW EXECUTE FUNCTION public.featured_follow_plan();

-- The shops on the Featured shelf this month (home page and directory).
CREATE OR REPLACE FUNCTION public.featured_shops()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  WITH m AS (SELECT date_trunc('month', now() AT TIME ZONE 'America/New_York')::date AS month),
  picks AS (
    SELECT p.curator_id, 'ceo'::text AS kind, 0 AS rank FROM featured_picks p, m WHERE p.month = m.month
    UNION
    SELECT a.curator_id, 'paid', 1 FROM shop_addons a WHERE a.kind = 'featured' AND a.status = 'active'
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'slug', c.slug, 'business_name', c.business_name, 'tagline', c.tagline,
           'logo_url', c.logo_url, 'banner_url', c.banner_url, 'location', c.location, 'kind', x.kind) ORDER BY x.rank, c.business_name), '[]'::jsonb)
    FROM (SELECT curator_id, min(kind) AS kind, min(rank) AS rank FROM picks GROUP BY curator_id) x
    JOIN curator_data c ON c.id = x.curator_id
   WHERE c.status = 'approved' AND c.is_published IS NOT FALSE;
$fn$;
GRANT EXECUTE ON FUNCTION public.featured_shops() TO anon, authenticated;

-- Paid Featured spots taken and left (for the shop dashboard).
CREATE OR REPLACE FUNCTION public.featured_capacity()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'cap', coalesce((SELECT (value->>'featured_cap')::int FROM app_settings WHERE key = 'addons'), 10),
    'taken', (SELECT count(*) FROM shop_addons WHERE kind = 'featured' AND status IN ('active', 'past_due')));
$fn$;
GRANT EXECUTE ON FUNCTION public.featured_capacity() TO anon, authenticated;

-- Every day at 9:30 UTC: refresh the Google details of shops whose copy is older than the refresh days.
DO $jobs$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'p31-google-place';
    PERFORM cron.schedule('p31-google-place', '30 9 * * *', $job$
      SELECT net.http_post(
        url := 'https://xsnhxjttdizljaawpumz.supabase.co/functions/v1/google-place',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{"action": "refresh", "source": "cron"}'::jsonb,
        timeout_milliseconds := 120000);
    $job$);
  END IF;
END;
$jobs$;

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (53, 'shop add-ons') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  EXISTS (SELECT 1 FROM app_settings WHERE key = 'addons') AND to_regclass('public.shop_addons') IS NOT NULL AS addons_ready,
  EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'products_limit_guard') AS limit_ready,
  to_regclass('public.featured_posts') IS NOT NULL AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'featured_submit') AS featured_ready,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'curator_data' AND column_name = 'google_place') AS google_ready,
  NOT EXISTS (SELECT 1 FROM curator_data WHERE cashapp_tag IS NOT NULL OR venmo_handle IS NOT NULL) AS links_retired,
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS google_job_ready;
