-- ============================================================
-- P31 test store: fills a complete sample shop on an EXISTING account so the
-- team can see the layout (banner, logo, story, 8 products with photos, badges,
-- a sale with a countdown, options, a discount code, testimonials) in one go.
--
-- Before running:
--   1. Create the account yourself at https://www.p31market.com/register
--      (any name, business name, the email below, a password you choose).
--   2. Put that email in v_email on the first line of the block.
-- Then paste the whole file into the Supabase SQL editor and run it.
-- Safe to run again: it replaces the same test products each time.
-- To remove the test store later, see the end of this file.
-- ============================================================

DO $$
DECLARE
  v_email TEXT := 'CHANGE-ME@example.com';
  v_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(v_email);
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No account with email %. Register at p31market.com/register first, then run this again.', v_email;
  END IF;

  INSERT INTO profiles (id, full_name, email)
  VALUES (v_id, 'P31 Test Maker', v_email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO curator_data (
    id, business_name, tagline, bio, slug, location, instagram, website, public_email,
    banner_url, logo_url, cashapp_tag, venmo_handle, shop_announcement, verification_badges,
    store_design, status, is_paid, is_published
  ) VALUES (
    v_id,
    'Maple and Marigold',
    'Hand-poured candles, small-batch skincare and gifts',
    'I started Maple and Marigold at my kitchen table in Decatur, pouring soy candles for friends who kept asking for more. Today every candle, balm and gift box is still made by hand in small batches, with ingredients I can pronounce and scents that feel like home. Thank you for shopping small and supporting a woman-owned business.',
    'maple-and-marigold',
    'Decatur, GA',
    'mapleandmarigold',
    'https://www.p31market.com',
    v_email,
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80',
    NULL,
    'mapleandmarigold',
    'mapleandmarigold',
    'Free local pickup at the Winter Gala. Orders over $60 ship free.',
    '["Handmade", "Woman-Owned"]'::jsonb,
    '{"template": "boutique", "accent": "#8A6D1A", "heading": "serif", "hero": "tall", "columns": 3, "cards": "framed", "buttons": "pill", "productsFirst": false, "showAbout": true, "showTestimonials": true}'::jsonb,
    'approved', TRUE, TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    business_name = EXCLUDED.business_name, tagline = EXCLUDED.tagline, bio = EXCLUDED.bio,
    slug = EXCLUDED.slug, location = EXCLUDED.location, instagram = EXCLUDED.instagram,
    website = EXCLUDED.website, public_email = EXCLUDED.public_email, banner_url = EXCLUDED.banner_url,
    logo_url = EXCLUDED.logo_url, cashapp_tag = EXCLUDED.cashapp_tag, venmo_handle = EXCLUDED.venmo_handle,
    shop_announcement = EXCLUDED.shop_announcement, verification_badges = EXCLUDED.verification_badges,
    store_design = EXCLUDED.store_design, status = 'approved', is_paid = TRUE, is_published = TRUE;

  DELETE FROM products WHERE curator_id = v_id;

  INSERT INTO products (curator_id, name, description, price, compare_at_price, sale_ends_at, image_url, image_urls, category, stock_status, inventory, sku, tags, variants, badge, is_featured, is_active, sort_order) VALUES
  (v_id, 'Marigold Soy Candle', 'Hand-poured soy wax with a cotton wick. Warm marigold, honey and a little vanilla. Burns about 45 hours. Trim the wick before each light.', 24, 30, v_now + interval '5 days',
   'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=1200&q=80', '["https://images.unsplash.com/photo-1603006905003-be475563bc59?w=1200&q=80"]'::jsonb,
   'Home', 'in_stock', 12, 'TEST-CANDLE-01', ARRAY['candle','soy','handmade','gift'], '[{"name":"Size","options":["8 oz","12 oz"]},{"name":"Scent","options":["Marigold","Cedar and Sage","Vanilla Bean"]}]'::jsonb, 'Bestseller', TRUE, TRUE, 0),
  (v_id, 'Whipped Shea Body Butter', 'Raw shea whipped with jojoba and a touch of sweet orange. Melts on contact, no greasy feel. 4 oz jar.', 18, NULL, NULL,
   'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1200&q=80', '["https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1200&q=80"]'::jsonb,
   'Skin', 'in_stock', NULL, 'TEST-SKIN-01', ARRAY['skincare','shea','natural'], '[{"name":"Scent","options":["Sweet Orange","Lavender","Unscented"]}]'::jsonb, 'New', FALSE, TRUE, 1),
  (v_id, 'Gold Hoop Earrings', '14k gold-filled hoops, light enough to forget you are wearing them. Made by hand in Decatur. Comes in a gift box.', 42, NULL, NULL,
   'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1200&q=80', '["https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=1200&q=80"]'::jsonb,
   'Collection', 'in_stock', 4, 'TEST-JEWEL-01', ARRAY['jewelry','gold','gift'], '[{"name":"Size","options":["Small","Medium","Large"]}]'::jsonb, 'Handmade', FALSE, TRUE, 2),
  (v_id, 'Layered Pearl Necklace', 'Freshwater pearls on a gold-filled chain, 18 inches with a 2 inch extender. Each pearl is a little different.', 58, NULL, NULL,
   'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1200&q=80', '["https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=1200&q=80"]'::jsonb,
   'Collection', 'limited_edition', 2, 'TEST-JEWEL-02', ARRAY['jewelry','pearl'], '[]'::jsonb, 'Limited', FALSE, TRUE, 3),
  (v_id, 'Canvas Market Tote', 'Heavy natural canvas with a hand-printed marigold. Holds a whole market haul. Machine wash cold.', 32, NULL, NULL,
   'https://images.unsplash.com/photo-1544816155-12df9643f363?w=1200&q=80', '["https://images.unsplash.com/photo-1544816155-12df9643f363?w=1200&q=80"]'::jsonb,
   'Apparel', 'in_stock', NULL, 'TEST-TOTE-01', ARRAY['tote','canvas','market'], '[{"name":"Color","options":["Natural","Sage"]}]'::jsonb, 'Market exclusive', FALSE, TRUE, 4),
  (v_id, 'Lemon Pound Cake', 'Dense, buttery pound cake with a bright lemon glaze, baked to order. Pickup at the market or local delivery.', 28, NULL, NULL,
   'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=1200&q=80', '["https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=1200&q=80"]'::jsonb,
   'Wellness', 'pre_order', NULL, 'TEST-BAKE-01', ARRAY['cake','baked','gift'], '[{"name":"Size","options":["Loaf","Bundt"]}]'::jsonb, 'Small batch', FALSE, TRUE, 5),
  (v_id, 'Brown Butter Cookies (dozen)', 'Chewy brown-butter cookies finished with flaky salt. Contains wheat, dairy and eggs. Best within 4 days.', 16, NULL, NULL,
   'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=1200&q=80', '["https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=1200&q=80"]'::jsonb,
   'Wellness', 'in_stock', 8, 'TEST-BAKE-02', ARRAY['cookies','baked'], '[]'::jsonb, 'Gift', FALSE, TRUE, 6),
  (v_id, 'Marigold Field Art Print', 'Printed on archival matte paper with pigment inks. Signed. Ships flat in a protective sleeve.', 35, 45, v_now + interval '2 days',
   'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&q=80', '["https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&q=80"]'::jsonb,
   'Art', 'in_stock', NULL, 'TEST-ART-01', ARRAY['art','print','home'], '[{"name":"Size","options":["8x10","11x14","16x20"]},{"name":"Frame","options":["Unframed","Framed"]}]'::jsonb, 'Back in stock', FALSE, TRUE, 7);

  DELETE FROM testimonials WHERE curator_id = v_id;
  INSERT INTO testimonials (curator_id, customer_name, content, rating, is_approved) VALUES
  (v_id, 'Jasmine R.', 'The marigold candle is the first thing people notice when they walk in. I have bought four.', 5, TRUE),
  (v_id, 'Tasha M.', 'The body butter cleared up my dry winter hands in a week. Smells like sunshine.', 5, TRUE),
  (v_id, 'Erica B.', 'Ordered the gift box for my mom and she cried. Beautifully packed.', 5, TRUE);

  DELETE FROM discount_codes WHERE curator_id = v_id;
  INSERT INTO discount_codes (curator_id, code, kind, value, min_subtotal, active) VALUES
  (v_id, 'WELCOME10', 'percent', 10, 0, TRUE);

  RAISE NOTICE 'Test store ready: https://www.p31market.com/maple-and-marigold (account %)', v_email;
END $$;

-- ============================================================
-- To remove the test store later (run as two steps):
--   1. DELETE FROM curator_data WHERE slug = 'maple-and-marigold';
--      (products, testimonials and discount codes go with it)
--   2. Supabase → Authentication → Users → delete the test account.
-- ============================================================
