/* ==========================================================
   P31 MARKETPLACE — PAYMENT INTEGRATION & EXPANSION
   ========================================================== */

-- 1. Add Payment Fields to Curator Data
ALTER TABLE curator_data 
ADD COLUMN IF NOT EXISTS stripe_link TEXT,
ADD COLUMN IF NOT EXISTS cashapp_tag TEXT,
ADD COLUMN IF NOT EXISTS venmo_handle TEXT,
ADD COLUMN IF NOT EXISTS other_payment_link TEXT,
ADD COLUMN IF NOT EXISTS other_payment_label TEXT;

-- 2. Add description for the payment section (optional, but good for UX)
COMMENT ON COLUMN curator_data.stripe_link IS 'Direct Stripe checkout or payment link';
COMMENT ON COLUMN curator_data.cashapp_tag IS 'CashApp $Cashtag';
COMMENT ON COLUMN curator_data.venmo_handle IS 'Venmo @username';
