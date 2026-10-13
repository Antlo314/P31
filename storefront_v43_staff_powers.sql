/* ============================================================
   P31 - v43: full admin control, room by room
   Run after v42. Safe to run more than once.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f storefront_v43_staff_powers.sql
   The result is one row: has_tool_ready true, staff_policies 21,
   shop_tools_ready true, orders_editable true, intro_emails_ready true.

   1. has_tool(name): true for admins and Systems operators, and for a
      team login that has that dashboard switched on. Until now the
      database only knew the original Systems accounts, so a team login
      (for example the Vendors or Orders dashboard) could open a room
      but could not read or change what was in it.
   2. Each room gets one staff rule for read, edit and delete:
        orders                          Orders dashboard
        vendor applications and forms   Vendors dashboard
        markets, lineups, registrations Events dashboard
        join applications, people       People dashboard
        subscribers                     Emails or People dashboard
        campaigns                       Emails dashboard
        social posts, growth            Social dashboard
        testimonials, discount codes    Shops dashboard
      Admins changing orders from Systems now works (before, only the
      shop owner could change an order, so Confirm and Cancel in Systems
      did nothing).
   3. Deleting: intro-call requests (mentors), shared inbox threads
      (Content Studio), site errors (admins).
   4. Shops: the shops dashboard can edit every product field, delete a
      product, and (admins only) delete a whole shop with its products.
   5. Mentorship intro-call requests get the same emails as the other
      forms (the team, ceo@p31market.com, and a PDF copy to the person).
      Requests made before this script are not emailed.
   ============================================================ */

-- ----------------------------------------------------------
-- 1. has_tool
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_tool(p_tool TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT auth.uid() IS NOT NULL AND (public.is_academy_admin() OR p_tool = ANY (public.my_team_tools()));
$fn$;
REVOKE ALL ON FUNCTION public.has_tool(TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_tool(TEXT) TO authenticated;

-- ----------------------------------------------------------
-- 2. One staff rule per table: read, edit and delete
-- ----------------------------------------------------------
DO $staff$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('orders', 'orders'),
    ('vendor_applications', 'vendors'),
    ('vendor_agreements', 'vendors'),
    ('vendor_registrations', 'vendors'),
    ('vendor_feedback', 'vendors'),
    ('volunteer_signups', 'vendors'),
    ('market_events', 'events'),
    ('event_vendors', 'events'),
    ('event_registrations', 'events'),
    ('event_rsvps', 'events'),
    ('collective_applications', 'people'),
    ('crm_contacts', 'people'),
    ('crm_activities', 'people'),
    ('leads', 'emails'),
    ('campaigns', 'emails'),
    ('social_posts', 'social'),
    ('social_prospects', 'social'),
    ('social_searches', 'social'),
    ('testimonials', 'shops'),
    ('discount_codes', 'shops'),
    ('shop_subscribers', 'shops')
  ) AS t(tbl, tool)
  LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Staff run this room', r.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_tool(%L)) WITH CHECK (public.has_tool(%L))',
      'Staff run this room', r.tbl, r.tool, r.tool);
  END LOOP;
END;
$staff$;

-- Subscribers are also looked after by the People dashboard.
DO $leads$
BEGIN
  IF to_regclass('public.leads') IS NOT NULL THEN
    DROP POLICY IF EXISTS "People team runs subscribers" ON public.leads;
    CREATE POLICY "People team runs subscribers" ON public.leads FOR ALL TO authenticated
      USING (public.has_tool('people')) WITH CHECK (public.has_tool('people'));
  END IF;
END;
$leads$;

-- ----------------------------------------------------------
-- 3. Deleting elsewhere
-- ----------------------------------------------------------
DO $del$
BEGIN
  IF to_regclass('public.academy_inquiries') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Mentors remove intro calls" ON public.academy_inquiries;
    CREATE POLICY "Mentors remove intro calls" ON public.academy_inquiries FOR DELETE TO authenticated
      USING (public.is_academy_admin() OR (program_id IS NOT NULL AND public.is_mentor(program_id)));
  END IF;
  IF to_regclass('public.email_threads') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Studio removes threads" ON public.email_threads;
    CREATE POLICY "Studio removes threads" ON public.email_threads FOR DELETE TO authenticated USING (public.is_studio_member());
  END IF;
  IF to_regclass('public.app_errors') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Admins clear errors" ON public.app_errors;
    CREATE POLICY "Admins clear errors" ON public.app_errors FOR DELETE TO authenticated USING (public.is_academy_admin());
  END IF;
END;
$del$;

-- Intro-call requests: a marker so each one is emailed once (join-notify).
DO $intro$
BEGIN
  IF to_regclass('public.academy_inquiries') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'academy_inquiries' AND column_name = 'notified_at') THEN
      ALTER TABLE public.academy_inquiries ADD COLUMN notified_at TIMESTAMPTZ;
      UPDATE public.academy_inquiries SET notified_at = created_at;
    END IF;
    ALTER TABLE public.academy_inquiries ADD COLUMN IF NOT EXISTS sheet_synced_at TIMESTAMPTZ;
  END IF;
END;
$intro$;

-- ----------------------------------------------------------
-- 4. Shops: products in full, and deleting
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shop_admin_products(p_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT public.can_run_shops() THEN RAISE EXCEPTION 'Only admins and the shops dashboard can see a shop.'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'price', x.price, 'image_url', x.image_url, 'is_active', coalesce(x.is_active, true),
                                        'is_featured', coalesce(x.is_featured, false), 'badge', x.badge, 'category', x.category, 'created_at', x.created_at,
                                        'description', x.description, 'compare_at_price', x.compare_at_price, 'stock_status', x.stock_status,
                                        'inventory', x.inventory, 'sale_ends_at', x.sale_ends_at, 'sku', x.sku) ORDER BY x.created_at DESC)
    FROM products x WHERE x.curator_id = p_id), '[]'::jsonb);
END;
$fn$;
REVOKE ALL ON FUNCTION public.shop_admin_products(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shop_admin_products(UUID) TO authenticated;

-- Change any product field the studio has (only the fields sent are changed).
CREATE OR REPLACE FUNCTION public.shop_admin_set_product(p_id BIGINT, p_patch JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_row products; v_name TEXT; v_stock TEXT;
BEGIN
  IF NOT public.can_run_shops() THEN RAISE EXCEPTION 'Only admins and the shops dashboard can change a product.'; END IF;
  IF p_patch ? 'name' THEN
    v_name := btrim(coalesce(p_patch->>'name', ''));
    IF v_name = '' THEN RAISE EXCEPTION 'A product needs a name.'; END IF;
  END IF;
  IF p_patch ? 'price' AND coalesce((p_patch->>'price')::numeric, -1) < 0 THEN RAISE EXCEPTION 'The price cannot be below zero.'; END IF;
  IF p_patch ? 'stock_status' THEN
    v_stock := p_patch->>'stock_status';
    IF v_stock NOT IN ('in_stock', 'out_of_stock', 'limited_edition', 'pre_order') THEN RAISE EXCEPTION 'Availability can be in stock, sold out, limited edition or pre-order.'; END IF;
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
    badge = CASE WHEN p_patch ? 'badge' THEN nullif(btrim(p_patch->>'badge'), '') ELSE badge END
  WHERE id = p_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'That product was not found.'; END IF;
  RETURN to_jsonb(v_row);
END;
$fn$;
REVOKE ALL ON FUNCTION public.shop_admin_set_product(BIGINT, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shop_admin_set_product(BIGINT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.shop_admin_delete_product(p_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT public.can_run_shops() THEN RAISE EXCEPTION 'Only admins and the shops dashboard can delete a product.'; END IF;
  DELETE FROM products WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That product was not found.'; END IF;
  RETURN true;
END;
$fn$;
REVOKE ALL ON FUNCTION public.shop_admin_delete_product(BIGINT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shop_admin_delete_product(BIGINT) TO authenticated;

-- A whole shop: its products, then the shop. The login itself stays (remove it in Supabase Auth if needed).
CREATE OR REPLACE FUNCTION public.shop_admin_delete_shop(p_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_name TEXT; v_products INTEGER;
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Only admins can delete a shop.'; END IF;
  SELECT business_name INTO v_name FROM curator_data WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That shop was not found.'; END IF;
  DELETE FROM products WHERE curator_id = p_id;
  GET DIAGNOSTICS v_products = ROW_COUNT;
  DELETE FROM curator_data WHERE id = p_id;
  RETURN jsonb_build_object('shop', v_name, 'products', v_products);
END;
$fn$;
REVOKE ALL ON FUNCTION public.shop_admin_delete_shop(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shop_admin_delete_shop(UUID) TO authenticated;

-- ----------------------------------------------------------
-- 5. Record this script, then one row to prove it
-- ----------------------------------------------------------
DO $ver$
BEGIN
  IF to_regclass('public.schema_versions') IS NOT NULL THEN
    INSERT INTO public.schema_versions (version, name) VALUES (43, 'staff powers') ON CONFLICT (version) DO NOTHING;
  END IF;
END;
$ver$;

SELECT
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_tool') AS has_tool_ready,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND policyname = 'Staff run this room') AS staff_policies,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'shop_admin_delete_shop') AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'shop_admin_delete_product') AS shop_tools_ready,
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'Staff run this room') AS orders_editable,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'academy_inquiries' AND column_name = 'notified_at') AS intro_emails_ready;
