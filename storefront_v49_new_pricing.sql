/* ============================================================
   P31 - v49: new mentorship and coaching prices (October 2026)
   Run after v48. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v49_new_pricing.sql
   The result is one row: business_prices 27500/37500/49500/65000,
   faith_prices 17500/23500/31000, old_plans_retired true.

   Monthly, for everyone (prices live only here and in Systems, Academy;
   the public site never shows them):
     Business Mentorship
       Option 1  Business, 2 sessions          275
       Option 2  Hybrid, 2 sessions            375
       Option 3  Business, 4 sessions          495
       Option 4  VIP Hybrid, 4 sessions        650
     Faith Mentorship
       2 sessions 175, 3 sessions 235, 4 sessions 310

   The earlier single monthly plans (250 business, 160 faith) are
   retired for new clients. Anyone already paying keeps her current
   price: Stripe subscriptions do not change when a plan does.
   ============================================================ */

-- Business: the four coaching packages (added in v47) at the new prices
UPDATE public.academy_plans pl
   SET price_cents = x.cents, label = x.label, is_active = true, updated_at = now()
  FROM public.academy_programs p,
       (VALUES
         ('Option 1', 'Coaching Option 1: Business, 2 sessions a month (60 min)', 27500),
         ('Option 2', 'Coaching Option 2: Hybrid Mentorship and Business, 2 sessions a month (90 min)', 37500),
         ('Option 3', 'Coaching Option 3: Business, 4 sessions a month (60 min)', 49500),
         ('Option 4', 'Coaching Option 4: VIP Hybrid, 4 sessions a month (90 min)', 65000)
       ) AS x(pkg, label, cents)
 WHERE pl.program_id = p.id AND p.slug = 'business' AND pl.package = x.pkg;

-- Faith: three packages by sessions a month
INSERT INTO public.academy_plans (program_id, billing, label, price_cents, package)
SELECT p.id, 'month', x.label, x.cents, x.pkg
  FROM public.academy_programs p
 CROSS JOIN (VALUES
   ('Faith 2', 'Faith Mentorship: 2 sessions a month', 17500),
   ('Faith 3', 'Faith Mentorship: 3 sessions a month', 23500),
   ('Faith 4', 'Faith Mentorship: 4 sessions a month', 31000)
 ) AS x(pkg, label, cents)
 WHERE p.slug = 'faith'
   AND NOT EXISTS (SELECT 1 FROM public.academy_plans q WHERE q.program_id = p.id AND q.package = x.pkg);
UPDATE public.academy_plans pl
   SET price_cents = x.cents, is_active = true, updated_at = now()
  FROM public.academy_programs p,
       (VALUES ('Faith 2', 17500), ('Faith 3', 23500), ('Faith 4', 31000)) AS x(pkg, cents)
 WHERE pl.program_id = p.id AND p.slug = 'faith' AND pl.package = x.pkg;

-- The earlier single monthly plans: no longer offered to new clients
UPDATE public.academy_plans pl
   SET is_active = false, updated_at = now()
  FROM public.academy_programs p
 WHERE pl.program_id = p.id AND p.slug IN ('business', 'faith')
   AND pl.package IS NULL AND pl.billing = 'month' AND pl.is_active;

-- Record this script, then one row to prove it
DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (49, 'new pricing') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  (SELECT string_agg(pl.price_cents::text, '/' ORDER BY pl.package) FROM public.academy_plans pl JOIN public.academy_programs p ON p.id = pl.program_id WHERE p.slug = 'business' AND pl.package IS NOT NULL AND pl.is_active) AS business_prices,
  (SELECT string_agg(pl.price_cents::text, '/' ORDER BY pl.package) FROM public.academy_plans pl JOIN public.academy_programs p ON p.id = pl.program_id WHERE p.slug = 'faith' AND pl.package IS NOT NULL AND pl.is_active) AS faith_prices,
  NOT EXISTS (SELECT 1 FROM public.academy_plans pl JOIN public.academy_programs p ON p.id = pl.program_id WHERE p.slug IN ('business', 'faith') AND pl.package IS NULL AND pl.billing = 'month' AND pl.is_active) AS old_plans_retired;
