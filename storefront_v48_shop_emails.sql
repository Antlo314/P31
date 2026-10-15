/* ============================================================
   P31 - v48: shop emails
   Run after v47. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v48_shop_emails.sql
   The result is one row: signup_column true, live_column true.

   Until now nobody heard when a vendor created a shop (it only
   showed on the Today page), and the vendor was never told when
   her shop was approved. join-notify now sends both:
     - to the market team and ceo@: every new shop, pre-approved
       (already open) or waiting for review, with a link to Systems
     - to the vendor: her shop is live, with her link and next steps
   These two columns record that each email went out.
   ============================================================ */

ALTER TABLE public.curator_data ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
ALTER TABLE public.curator_data ADD COLUMN IF NOT EXISTS live_notified_at TIMESTAMPTZ;

-- Shops approved more than a day ago were opened before these emails existed: no late
-- welcome for them. A shop approved in the last day still gets hers.
UPDATE public.curator_data
   SET live_notified_at = now()
 WHERE status = 'approved'
   AND live_notified_at IS NULL
   AND coalesce(activated_at, created_at) < now() - interval '1 day';

-- Record this script, then one row to prove it
DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (48, 'shop emails') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'curator_data' AND column_name = 'notified_at') AS signup_column,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'curator_data' AND column_name = 'live_notified_at') AS live_column;
