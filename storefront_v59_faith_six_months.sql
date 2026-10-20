/* ============================================================
   P31 - v59: Faith Mentorship 6-Month Commitment plans
   Run after v58. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v59_faith_six_months.sql
   The result is one row: faith_six_month_plans 2, faith_six_month_linked 2,
   package_keys_unique true, version_recorded true.

   The October 2026 pricing sheet adds two Private Faith-Based
   Mentorship commitments, each on a Stripe Payment Link Melanie keeps:
     Faith 2 6M   6-Month Commitment, bi-weekly sessions (60 min)
     Faith 4 6M   6-Month Commitment, weekly sessions (60 min)
   The keys pair with the monthly Faith 2 and Faith 4 plans, so the
   private forms page can show the saving. No prices in this file:
   the Stripe sync copies each price and billing from its link, and is
   started once at the end of this script. This file holds payment
   links, so it is never bundled into the site.
   ============================================================ */

INSERT INTO public.academy_plans (program_id, billing, label, price_cents, package, is_active, stripe_payment_link, access_days)
SELECT p.id, 'six_months', x.label, NULL, x.pkg, true, x.link, 183
  FROM public.academy_programs p,
       (VALUES ('Faith 2 6M', 'Faith Mentorship 6-Month Commitment: Bi-Weekly Sessions (1 hour)', 'https://buy.stripe.com/7sYdR845Qavs0PpduU8bS0J'),
               ('Faith 4 6M', 'Faith Mentorship 6-Month Commitment: Weekly Sessions (1 hour)', 'https://buy.stripe.com/cNidR86dY474bu39eE8bS0K')
       ) AS x(pkg, label, link)
 WHERE p.slug = 'faith'
   AND NOT EXISTS (SELECT 1 FROM public.academy_plans q WHERE q.program_id = p.id AND q.package = x.pkg);

-- Copy the two prices from Stripe now (the daily job does it again at 10:15 UTC).
DO $sync$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM net.http_post(
      url := 'https://xsnhxjttdizljaawpumz.supabase.co/functions/v1/academy-checkout',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"action": "sync", "source": "v59"}'::jsonb,
      timeout_milliseconds := 60000);
  END IF;
END;
$sync$;

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (59, 'faith six month plans') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  (SELECT count(*) FROM public.academy_plans pl JOIN public.academy_programs p ON p.id = pl.program_id
    WHERE p.slug = 'faith' AND pl.is_active AND pl.billing = 'six_months'
      AND pl.package IN ('Faith 2 6M', 'Faith 4 6M')) AS faith_six_month_plans,
  (SELECT count(*) FROM public.academy_plans pl JOIN public.academy_programs p ON p.id = pl.program_id
    WHERE p.slug = 'faith' AND pl.stripe_payment_link LIKE 'https://buy.stripe.com/%'
      AND pl.package IN ('Faith 2 6M', 'Faith 4 6M')) AS faith_six_month_linked,
  NOT EXISTS (SELECT 1 FROM public.academy_plans WHERE package IS NOT NULL GROUP BY package HAVING count(*) > 1) AS package_keys_unique,
  CASE WHEN to_regclass('public.schema_versions') IS NULL THEN false
    ELSE query_to_xml('SELECT 1 FROM public.schema_versions WHERE version = 59', false, true, '')::text <> ''
  END AS version_recorded;
