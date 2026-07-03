/* ==========================================================
   P31 MARKETPLACE — V13: STRIPE CONNECT PAYMENTS
   Vendors connect their own Stripe account (Express) and
   receive payouts directly. Orders are recorded via webhook.
   Run this in the Supabase SQL Editor.
   ========================================================== */

-- 1. Stripe Connect fields on curator_data
ALTER TABLE curator_data
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_charges_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_payouts_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_details_submitted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN curator_data.stripe_account_id IS 'Stripe Connect (Express) account id, e.g. acct_...';
COMMENT ON COLUMN curator_data.stripe_charges_enabled IS 'True when the connected account can accept card payments';
COMMENT ON COLUMN curator_data.stripe_payouts_enabled IS 'True when Stripe can pay out to the vendor bank account';

CREATE UNIQUE INDEX IF NOT EXISTS curator_stripe_account_idx
  ON curator_data (stripe_account_id) WHERE stripe_account_id IS NOT NULL;

-- 2. Orders table (written by the Stripe webhook via service role)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curator_id UUID REFERENCES curator_data(id) ON DELETE SET NULL,
  product_id BIGINT,
  product_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  amount_subtotal INTEGER,            -- in cents
  amount_total INTEGER,               -- in cents
  application_fee INTEGER DEFAULT 0,  -- platform fee in cents
  currency TEXT DEFAULT 'usd',
  buyer_email TEXT,
  buyer_name TEXT,
  shipping_address JSONB,
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  payment_status TEXT DEFAULT 'pending',      -- pending | paid | refunded
  fulfillment_status TEXT DEFAULT 'new',      -- new | fulfilled | cancelled
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_curator_idx ON orders (curator_id, created_at DESC);

-- 3. Security: curators see and update only their own orders.
--    Inserts happen exclusively through the webhook (service role bypasses RLS).
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Curators view own orders" ON orders;
CREATE POLICY "Curators view own orders"
ON orders FOR SELECT
USING (auth.uid() = curator_id);

DROP POLICY IF EXISTS "Curators update own order fulfillment" ON orders;
CREATE POLICY "Curators update own order fulfillment"
ON orders FOR UPDATE
USING (auth.uid() = curator_id);
