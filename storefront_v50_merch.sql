/* ============================================================
   P31 - v50: P31 merch (Printful)
   Run after v49. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v50_merch.sql
   The result is one row: orders_ready true, mockups_ready true,
   bucket_ready true.

   p31market.com/merch sells P31 designs printed and shipped by
   Printful. The shopper pays on Stripe (the Market account); the
   webhook then places the order with Printful, which prints, ships
   and sends tracking.
   1. merch_orders: one row per checkout (items, totals, shipping
      address, Stripe session, Printful order id and status).
   2. merch_mockups: the product photos Printful makes from each
      design, kept in the public merch bucket.
   3. Storage bucket merch (public): those product photos.
   ============================================================ */

CREATE TABLE IF NOT EXISTS public.merch_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref TEXT NOT NULL UNIQUE DEFAULT 'M' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7)),
  status TEXT NOT NULL DEFAULT 'checkout'
    CHECK (status IN ('checkout', 'paid', 'sent', 'in_production', 'shipped', 'cancelled', 'failed', 'expired')),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  email TEXT,
  name TEXT,
  shipping JSONB,
  stripe_session_id TEXT UNIQUE,
  printful_order_id TEXT,
  tracking JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS merch_orders_recent ON public.merch_orders (created_at DESC);
ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Shop team reads merch orders" ON public.merch_orders;
CREATE POLICY "Shop team reads merch orders" ON public.merch_orders
  FOR SELECT TO authenticated USING (public.can_run_shops());
GRANT SELECT ON public.merch_orders TO authenticated;

CREATE TABLE IF NOT EXISTS public.merch_mockups (
  item TEXT NOT NULL,
  color TEXT NOT NULL,
  url TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (item, color)
);
ALTER TABLE public.merch_mockups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone sees merch photos" ON public.merch_mockups;
CREATE POLICY "Anyone sees merch photos" ON public.merch_mockups FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.merch_mockups TO anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('merch', 'merch', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (50, 'merch') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  to_regclass('public.merch_orders') IS NOT NULL AS orders_ready,
  to_regclass('public.merch_mockups') IS NOT NULL AS mockups_ready,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'merch' AND public) AS bucket_ready;
