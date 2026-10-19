/* ============================================================
   P31 - v55: mentorship plans priced by Melanie in Stripe
   Run after v54. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v55_stripe_payment_links.sql
   The result is one row: linked_plans 9, six_month_plans 2,
   packages_month_only true, sync_job_ready true.

   Melanie keeps a Stripe Payment Link for every plan. Each plan now
   remembers its link; checkout charges the product and price behind
   that link (so every sale shows under her products in Stripe), and
   the price shown on the private forms page is copied from Stripe:
   at every checkout and once a day (job p31-plan-sync).
   - academy_plans gains stripe_payment_link, stripe_price_id,
     price_synced_at
   - the two Business Coaching 6-Month Commitment plans are added
     (package keys Option 1 6M and Option 3 6M, so they never mix with
     the monthly Options 1 and 3 in the coaching agreement)
   - coaching_intake_details lists agreement package prices from the
     monthly plans only
   ============================================================ */

ALTER TABLE public.academy_plans ADD COLUMN IF NOT EXISTS stripe_payment_link TEXT;
ALTER TABLE public.academy_plans ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
ALTER TABLE public.academy_plans ADD COLUMN IF NOT EXISTS price_synced_at TIMESTAMPTZ;

-- The 6-Month Commitment plans (Business Coaching). Stripe decides the final price and billing on the first sync.
INSERT INTO public.academy_plans (program_id, billing, label, price_cents, package, is_active)
SELECT p.id, 'six_months', x.label, x.cents, x.pkg, true
  FROM public.academy_programs p,
       (VALUES ('Option 1 6M', 'Business Coaching 6-Month Commitment: Bi-Weekly Sessions (1 hour)', 150000),
               ('Option 3 6M', 'Business Coaching 6-Month Commitment: Weekly Sessions (1 hour)', 270000)) AS x(pkg, label, cents)
 WHERE p.slug = 'business'
   AND NOT EXISTS (SELECT 1 FROM public.academy_plans pl WHERE pl.program_id = p.id AND pl.package = x.pkg);

-- Her links, by program and package.
UPDATE public.academy_plans pl SET stripe_payment_link = x.link, updated_at = now()
  FROM public.academy_programs p,
       (VALUES ('faith', 'Faith 2', 'https://buy.stripe.com/7sY14mbyi1YW8hReyY8bS0w'),
               ('faith', 'Faith 3', 'https://buy.stripe.com/fZu5kCbyifPM9lVfD28bS0y'),
               ('faith', 'Faith 4', 'https://buy.stripe.com/7sY00ifOy6fc9lVaiI8bS0x'),
               ('business', 'Option 1', 'https://buy.stripe.com/dRm8wO45Q8nkcy74Yo8bS0z'),
               ('business', 'Option 3', 'https://buy.stripe.com/3cI5kC6dY1YW69J9eE8bS0A'),
               ('business', 'Option 2', 'https://buy.stripe.com/bJedR8aue474cy73Uk8bS0B'),
               ('business', 'Option 4', 'https://buy.stripe.com/14A8wO8m6dHEeGfeyY8bS0C'),
               ('business', 'Option 1 6M', 'https://buy.stripe.com/14AcN47i2eLI8hR3Uk8bS0D'),
               ('business', 'Option 3 6M', 'https://buy.stripe.com/eVq6oG31M5b82Xx4Yo8bS0E')) AS x(slug, pkg, link)
 WHERE p.id = pl.program_id AND p.slug = x.slug AND pl.package = x.pkg
   AND pl.stripe_payment_link IS DISTINCT FROM x.link;

-- The forms page: agreement package prices come from the monthly plans only.
CREATE OR REPLACE FUNCTION public.coaching_intake_details(p_token TEXT)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'full_name', i.full_name,
    'email', i.email,
    'status', i.status,
    'created_at', i.created_at,
    'expired', i.expires_at < now() OR i.status = 'revoked',
    'program', p.title,
    'packages', (SELECT coalesce(jsonb_agg(jsonb_build_object('key', pl.package, 'price_cents', pl.price_cents) ORDER BY pl.package), '[]'::jsonb)
                   FROM academy_plans pl JOIN academy_programs bp ON bp.id = pl.program_id
                   WHERE bp.slug = 'business' AND pl.package IS NOT NULL AND pl.billing = 'month' AND pl.is_active AND pl.price_cents IS NOT NULL),
    'plans', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', pl.id, 'program', ap.slug, 'program_title', ap.title, 'package', pl.package, 'label', pl.label, 'price_cents', pl.price_cents, 'billing', pl.billing) ORDER BY ap.slug, (pl.billing = 'six_months'), pl.price_cents), '[]'::jsonb)
                FROM academy_plans pl JOIN academy_programs ap ON ap.id = pl.program_id
                WHERE ap.slug IN ('business', 'faith') AND pl.package IS NOT NULL AND pl.is_active AND pl.price_cents IS NOT NULL),
    'chosen_plan', i.plan_id,
    'checkout_token', (SELECT inv.token FROM academy_invites inv WHERE inv.id = i.invite_id AND inv.used_at IS NULL AND inv.expires_at > now()),
    'enrolled', i.status = 'enrolled',
    'signed', (SELECT coalesce(jsonb_object_agg(f.kind, jsonb_build_object('signed_on', f.signed_on, 'signed_name', f.signed_name, 'package', f.package)), '{}'::jsonb)
                 FROM coaching_forms f WHERE f.intake_id = i.id))
  FROM coaching_intakes i LEFT JOIN academy_programs p ON p.id = i.program_id
  WHERE i.token = p_token AND length(p_token) >= 32;
$fn$;
GRANT EXECUTE ON FUNCTION public.coaching_intake_details(TEXT) TO anon, authenticated;

-- Every day at 10:15 UTC: copy each plan price and billing from its Stripe Payment Link.
DO $jobs$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'p31-plan-sync';
    PERFORM cron.schedule('p31-plan-sync', '15 10 * * *', $job$
      SELECT net.http_post(
        url := 'https://xsnhxjttdizljaawpumz.supabase.co/functions/v1/academy-checkout',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{"action": "sync", "source": "cron"}'::jsonb,
        timeout_milliseconds := 60000);
    $job$);
  END IF;
END;
$jobs$;

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (55, 'stripe payment links') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  (SELECT count(*) FROM academy_plans WHERE stripe_payment_link IS NOT NULL) AS linked_plans,
  (SELECT count(*) FROM academy_plans WHERE package IN ('Option 1 6M', 'Option 3 6M')) AS six_month_plans,
  NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce((SELECT public.coaching_intake_details(token) -> 'packages' FROM coaching_intakes LIMIT 1), '[]'::jsonb)) e WHERE e ->> 'key' LIKE '%6M') AS packages_month_only,
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') AS sync_job_ready;
