/* ============================================================
   P31 - v68: shoppers leave reviews on a shop page
   Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --remote=xsnhxjttdizljaawpumz -f storefront_v68_shop_reviews.sql
   The result is one row: source_ready true, submit_ready true,
   anon_can_submit true, version_recorded true.

   - testimonials.source: owner (she typed it in) or customer (a shopper
     left it on her shop page).
   - submit_shop_review(): the only way a shopper adds a review. It checks
     the shop is live, the name, the stars and the text, and saves the
     review as waiting (is_approved false). Only approved reviews are
     public (existing policy), so nothing shows until the shop owner
     approves it in her dashboard.
   - Spam limits: at most 20 waiting shopper reviews per shop per day, and
     the same text twice for one shop is saved only once.
   ============================================================ */

ALTER TABLE public.testimonials ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'owner';

DO $chk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'testimonials_source_check') THEN
    ALTER TABLE public.testimonials ADD CONSTRAINT testimonials_source_check CHECK (source IN ('owner', 'customer'));
  END IF;
END;
$chk$;

CREATE INDEX IF NOT EXISTS testimonials_curator_created_idx ON public.testimonials (curator_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.submit_shop_review(p_curator_id UUID, p_name TEXT, p_rating INTEGER, p_content TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_name TEXT := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 60);
  v_text TEXT := left(btrim(coalesce(p_content, '')), 1200);
  v_waiting INTEGER;
BEGIN
  IF p_curator_id IS NULL OR NOT EXISTS (SELECT 1 FROM curator_data WHERE id = p_curator_id AND status = 'approved') THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This shop is not taking reviews right now.');
  END IF;
  IF length(v_name) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Please add your name (a first name is fine).');
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Please pick 1 to 5 stars.');
  END IF;
  IF length(v_text) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Please write a sentence or two about your experience.');
  END IF;

  IF EXISTS (SELECT 1 FROM testimonials WHERE curator_id = p_curator_id AND lower(content) = lower(v_text)) THEN
    RETURN jsonb_build_object('ok', true);
  END IF;

  SELECT count(*) INTO v_waiting FROM testimonials
  WHERE curator_id = p_curator_id AND source = 'customer' AND is_approved = false
    AND created_at > now() - interval '1 day';
  IF v_waiting >= 20 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'This shop has a lot of new reviews to read. Please try again tomorrow.');
  END IF;

  INSERT INTO testimonials (curator_id, customer_name, content, rating, is_approved, source)
  VALUES (p_curator_id, v_name, v_text, p_rating, false, 'customer');
  RETURN jsonb_build_object('ok', true);
END;
$fn$;

REVOKE ALL ON FUNCTION public.submit_shop_review(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_shop_review(UUID, TEXT, INTEGER, TEXT) TO anon, authenticated;

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (68, 'shop reviews') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'testimonials' AND column_name = 'source') AS source_ready,
  to_regprocedure('public.submit_shop_review(uuid, text, integer, text)') IS NOT NULL AS submit_ready,
  CASE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN false
    ELSE has_function_privilege('anon', 'public.submit_shop_review(uuid, text, integer, text)', 'EXECUTE')
  END AS anon_can_submit,
  CASE WHEN to_regclass('public.schema_versions') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM public.schema_versions WHERE version = 68', false, true, '')::text <> ''
  END AS version_recorded;
