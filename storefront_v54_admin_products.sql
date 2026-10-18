/* ============================================================
   P31 - v54: Admin product management & pricing controls
   Run after v53. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v54_admin_products.sql
   The result is one row: create_product_ready true, set_product_ready true,
   all_products_ready true, staff_policy_ready true.

   What it adds:
   - shop_admin_create_product(p_curator_id UUID, p_product JSONB):
     Allows site admins and staff with the 'shops' dashboard to create
     products for any curator/storefront.
   - shop_admin_set_product(p_id BIGINT, p_patch JSONB):
     Updated to support updating image_url and external_url as well as
     price, compare_at_price, stock_status, inventory, and details.
   - shop_admin_all_products(p_q TEXT, p_curator_id UUID):
     Returns marketplace-wide products with shop and curator metadata
     for search, filtering, and instant price adjustments.
   - Staff RLS policy for products table:
     Allows full CRUD access for authenticated staff (can_run_shops).
   ============================================================ */

-- 1. Create a product as an admin for any shop
CREATE OR REPLACE FUNCTION public.shop_admin_create_product(p_curator_id UUID, p_product JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_row products;
  v_name TEXT;
  v_price NUMERIC;
  v_stock TEXT;
BEGIN
  IF NOT public.can_run_shops() THEN
    RAISE EXCEPTION 'Only admins and the shops dashboard can create a product.';
  END IF;

  v_name := btrim(coalesce(p_product->>'name', ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'A product needs a name.';
  END IF;

  v_price := coalesce((p_product->>'price')::numeric, -1);
  IF v_price < 0 THEN
    RAISE EXCEPTION 'The price cannot be below zero.';
  END IF;

  v_stock := coalesce(p_product->>'stock_status', 'in_stock');
  IF v_stock NOT IN ('in_stock', 'out_of_stock', 'limited_edition', 'pre_order') THEN
    v_stock := 'in_stock';
  END IF;

  INSERT INTO products (
    curator_id,
    name,
    price,
    compare_at_price,
    category,
    stock_status,
    inventory,
    image_url,
    image_urls,
    description,
    badge,
    sku,
    is_active,
    is_featured,
    external_url,
    sort_order
  ) VALUES (
    p_curator_id,
    v_name,
    v_price,
    nullif(p_product->>'compare_at_price', '')::numeric,
    coalesce(nullif(btrim(p_product->>'category'), ''), 'Collection'),
    v_stock,
    nullif(p_product->>'inventory', '')::integer,
    nullif(btrim(p_product->>'image_url'), ''),
    CASE 
      WHEN p_product ? 'image_urls' AND jsonb_typeof(p_product->'image_urls') = 'array' 
      THEN ARRAY(SELECT jsonb_array_elements_text(p_product->'image_urls'))
      WHEN nullif(btrim(p_product->>'image_url'), '') IS NOT NULL 
      THEN ARRAY[p_product->>'image_url']
      ELSE ARRAY[]::text[]
    END,
    nullif(p_product->>'description', ''),
    nullif(btrim(p_product->>'badge'), ''),
    nullif(btrim(p_product->>'sku'), ''),
    coalesce((p_product->>'is_active')::boolean, true),
    coalesce((p_product->>'is_featured')::boolean, false),
    nullif(btrim(p_product->>'external_url'), ''),
    coalesce((SELECT max(sort_order) + 1 FROM products WHERE curator_id = p_curator_id), 0)
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$fn$;
REVOKE ALL ON FUNCTION public.shop_admin_create_product(UUID, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shop_admin_create_product(UUID, JSONB) TO authenticated;

-- 2. Update product including image_url and external_url
CREATE OR REPLACE FUNCTION public.shop_admin_set_product(p_id BIGINT, p_patch JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_row products; v_name TEXT; v_stock TEXT;
BEGIN
  IF NOT public.can_run_shops() THEN
    RAISE EXCEPTION 'Only admins and the shops dashboard can change a product.';
  END IF;

  IF p_patch ? 'name' THEN
    v_name := btrim(coalesce(p_patch->>'name', ''));
    IF v_name = '' THEN RAISE EXCEPTION 'A product needs a name.'; END IF;
  END IF;

  IF p_patch ? 'price' AND coalesce((p_patch->>'price')::numeric, -1) < 0 THEN
    RAISE EXCEPTION 'The price cannot be below zero.';
  END IF;

  IF p_patch ? 'stock_status' THEN
    v_stock := p_patch->>'stock_status';
    IF v_stock NOT IN ('in_stock', 'out_of_stock', 'limited_edition', 'pre_order') THEN
      RAISE EXCEPTION 'Availability can be in stock, sold out, limited edition or pre-order.';
    END IF;
  END IF;

  UPDATE products SET
    name = CASE WHEN p_patch ? 'name' THEN v_name ELSE name END,
    description = CASE WHEN p_patch ? 'description' THEN p_patch->>'description' ELSE description END,
    price = CASE WHEN p_patch ? 'price' THEN (p_patch->>'price')::numeric ELSE price END,
    compare_at_price = CASE WHEN p_patch ? 'compare_at_price' THEN nullif(p_patch->>'compare_at_price', '')::numeric ELSE compare_at_price END,
    category = CASE WHEN p_patch ? 'category' THEN nullif(btrim(p_patch->>'category'), '') ELSE category END,
    stock_status = CASE WHEN p_patch ? 'stock_status' THEN v_stock ELSE stock_status END,
    inventory = CASE WHEN p_patch ? 'inventory' THEN nullif(p_patch->>'inventory', '')::integer ELSE inventory END,
    sale_ends_at = CASE WHEN p_patch ? 'sale_ends_at' THEN nullif(p_patch->>'sale_ends_at', '')::timestamptz ELSE sale_ends_at END,
    sku = CASE WHEN p_patch ? 'sku' THEN nullif(btrim(p_patch->>'sku'), '') ELSE sku END,
    is_active = CASE WHEN p_patch ? 'is_active' THEN (p_patch->>'is_active')::boolean ELSE is_active END,
    is_featured = CASE WHEN p_patch ? 'is_featured' THEN (p_patch->>'is_featured')::boolean ELSE is_featured END,
    badge = CASE WHEN p_patch ? 'badge' THEN nullif(btrim(p_patch->>'badge'), '') ELSE badge END,
    image_url = CASE WHEN p_patch ? 'image_url' THEN nullif(btrim(p_patch->>'image_url'), '') ELSE image_url END,
    external_url = CASE WHEN p_patch ? 'external_url' THEN nullif(btrim(p_patch->>'external_url'), '') ELSE external_url END
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN RAISE EXCEPTION 'That product was not found.'; END IF;
  RETURN to_jsonb(v_row);
END;
$fn$;
REVOKE ALL ON FUNCTION public.shop_admin_set_product(BIGINT, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shop_admin_set_product(BIGINT, JSONB) TO authenticated;

-- 3. Query all marketplace products with shop info for bulk pricing & catalog management
CREATE OR REPLACE FUNCTION public.shop_admin_all_products(p_q TEXT DEFAULT NULL, p_curator_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT public.can_run_shops() THEN
    RAISE EXCEPTION 'Only admins and the shops dashboard can see products.';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'curator_id', p.curator_id,
      'shop_name', c.business_name,
      'shop_slug', c.slug,
      'owner_name', pr.full_name,
      'owner_email', pr.email,
      'name', p.name,
      'price', p.price,
      'compare_at_price', p.compare_at_price,
      'category', p.category,
      'stock_status', p.stock_status,
      'inventory', p.inventory,
      'image_url', p.image_url,
      'badge', p.badge,
      'is_active', coalesce(p.is_active, true),
      'is_featured', coalesce(p.is_featured, false),
      'description', p.description,
      'created_at', p.created_at
    ) ORDER BY p.created_at DESC)
    FROM products p
    LEFT JOIN curator_data c ON c.id = p.curator_id
    LEFT JOIN profiles pr ON pr.id = p.curator_id
    WHERE (p_curator_id IS NULL OR p.curator_id = p_curator_id)
      AND (
        p_q IS NULL OR btrim(p_q) = '' OR
        p.name ILIKE ('%' || btrim(p_q) || '%') OR
        c.business_name ILIKE ('%' || btrim(p_q) || '%') OR
        c.slug ILIKE ('%' || btrim(p_q) || '%') OR
        pr.full_name ILIKE ('%' || btrim(p_q) || '%') OR
        pr.email ILIKE ('%' || btrim(p_q) || '%') OR
        coalesce(p.category, '') ILIKE ('%' || btrim(p_q) || '%') OR
        coalesce(p.badge, '') ILIKE ('%' || btrim(p_q) || '%')
      )
  ), '[]'::jsonb);
END;
$fn$;
REVOKE ALL ON FUNCTION public.shop_admin_all_products(TEXT, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shop_admin_all_products(TEXT, UUID) TO authenticated;

-- 4. RLS: Staff can manage all products directly
DROP POLICY IF EXISTS "Staff manage products" ON public.products;
CREATE POLICY "Staff manage products" ON public.products
  FOR ALL TO authenticated
  USING (public.can_run_shops())
  WITH CHECK (public.can_run_shops());

-- 5. Record schema version 54
DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (54, 'admin product creation and pricing controls') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'shop_admin_create_product') AS create_product_ready,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'shop_admin_set_product') AS set_product_ready,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'shop_admin_all_products') AS all_products_ready,
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'Staff manage products') AS staff_policy_ready;
