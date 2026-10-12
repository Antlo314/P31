/* ============================================================
   P31 - v41: team dashboards, shop controls, lesson and session video
   Run after v40 (the catch-up). Safe to run more than once.

   HOW TO RUN: Ctrl+A, Ctrl+V in the SQL editor, then Run with nothing
   highlighted. The result is one row: team_logins 11, melanie_admin true,
   shops_ready true, media_ready true.

   1. Team dashboards. Each team login (a mailbox) is given dashboards:
        studio      Content creator (Content Studio)
        social      Social media manager (Social, Growth, DMs and comments)
        emails      Emails (the shared inboxes and campaigns)
        classroom   Classroom (the mentorship consoles)
        people      People and applications
        vendors     Vendors and forms
        events      Markets and events
        orders      Orders
        shops       Curators and shops
        davinci     DaVinci
      Admins always have all of them. Systems -> Team assigns them per
      mailbox; a person with two mailboxes has two logins. The team
      directory (October 2026) is loaded with suggested dashboards; the
      two logins that already had tools keep them.
   2. Melanie JC is a site admin on both of her mailboxes.
   3. Shop controls for admins and the shops dashboard, through checked
      functions: list every shop, update one, see and change its products.
   4. Lesson videos and session recordings can be uploaded to a private
      bucket (academy-media) as well as linked.
   5. Titles in The Gathering come from the team list when nobody set one.
   ============================================================ */

-- ----------------------------------------------------------
-- 1. Team dashboards
-- ----------------------------------------------------------
DO $k$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.team_access'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%tools%' LOOP
    EXECUTE format('ALTER TABLE public.team_access DROP CONSTRAINT %I', r.conname);
  END LOOP;
END;
$k$;
ALTER TABLE public.team_access ADD CONSTRAINT team_access_tools_check
  CHECK (tools <@ ARRAY['studio', 'social', 'emails', 'classroom', 'people', 'vendors', 'events', 'orders', 'shops', 'davinci']::TEXT[]);
ALTER TABLE public.team_access
  ADD COLUMN IF NOT EXISTS role_title TEXT,
  ADD COLUMN IF NOT EXISTS photo_key TEXT,
  ADD COLUMN IF NOT EXISTS site TEXT NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 100;
DO $s$
BEGIN
  ALTER TABLE public.team_access ADD CONSTRAINT team_access_site_check CHECK (site IN ('market', 'collective', 'both'));
EXCEPTION WHEN duplicate_object THEN NULL;
END;
$s$;

-- The dashboards of the signed-in person (admins: every one).
CREATE OR REPLACE FUNCTION public.my_team_tools()
RETURNS TEXT[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN '{}'::TEXT[]
    WHEN public.is_academy_admin() THEN ARRAY['studio', 'social', 'emails', 'classroom', 'people', 'vendors', 'events', 'orders', 'shops', 'davinci']::TEXT[]
    ELSE coalesce((SELECT t.tools FROM public.team_access t WHERE t.email = public.my_confirmed_email()), '{}'::TEXT[])
  END;
$fn$;

-- Content Studio seats: admins, Studio seats, and the content, social and email dashboards
-- (the Studio shows each of them only the pages that are theirs).
CREATE OR REPLACE FUNCTION public.is_studio_member()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT public.is_academy_admin()
      OR EXISTS (SELECT 1 FROM studio_members WHERE user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM team_access t WHERE t.email = public.my_confirmed_email() AND t.tools && ARRAY['studio', 'social', 'emails']::TEXT[]);
$fn$;

-- The classroom dashboard makes someone a mentor of every program.
CREATE OR REPLACE FUNCTION public.is_mentor(p_program UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT public.is_academy_admin()
      OR 'classroom' = ANY (public.my_team_tools())
      OR EXISTS (SELECT 1 FROM academy_mentors WHERE program_id = p_program AND user_id = auth.uid());
$fn$;

-- Tell the site which dashboards this person has.
CREATE OR REPLACE FUNCTION public.my_roles()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT jsonb_build_object(
    'signed_in', auth.uid() IS NOT NULL,
    'admin', public.is_academy_admin(),
    'operator', to_regclass('public.system_operators') IS NOT NULL AND EXISTS (SELECT 1 FROM system_operators WHERE user_id = auth.uid()),
    'curator', EXISTS (SELECT 1 FROM curator_data WHERE id = auth.uid()),
    'studio', auth.uid() IS NOT NULL AND public.is_studio_member(),
    'tools', to_jsonb(public.my_team_tools()),
    'mentor', CASE WHEN auth.uid() IS NOT NULL AND (public.is_academy_admin() OR 'classroom' = ANY (public.my_team_tools()))
      THEN coalesce((SELECT jsonb_agg(slug ORDER BY sort_order) FROM academy_programs WHERE is_active), '[]'::jsonb)
      ELSE coalesce((SELECT jsonb_agg(p.slug ORDER BY p.sort_order) FROM academy_mentors m
                     JOIN academy_programs p ON p.id = m.program_id WHERE m.user_id = auth.uid()), '[]'::jsonb) END,
    'student', coalesce((SELECT jsonb_agg(jsonb_build_object('program', p.slug, 'title', p.title, 'status', e.status,
                          'access_until', e.access_until, 'has_access', public.has_academy_access(p.id)) ORDER BY p.sort_order)
                         FROM academy_enrollments e JOIN academy_programs p ON p.id = e.program_id
                         WHERE e.user_id = auth.uid()), '[]'::jsonb));
$fn$;
GRANT EXECUTE ON FUNCTION public.my_roles() TO authenticated;

-- Systems -> Team: has each login made its account yet? (admins only)
CREATE OR REPLACE FUNCTION public.team_access_status()
RETURNS TABLE (email TEXT, has_account BOOLEAN, confirmed BOOLEAN, last_sign_in TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
BEGIN
  IF NOT public.is_academy_admin() THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
  SELECT t.email, u.id IS NOT NULL, u.email_confirmed_at IS NOT NULL, u.last_sign_in_at
  FROM public.team_access t
  LEFT JOIN auth.users u ON lower(u.email) = t.email;
END;
$fn$;

-- ----------------------------------------------------------
-- 2. The team directory (October 2026), with suggested dashboards
-- ----------------------------------------------------------
INSERT INTO public.site_admins (email, full_name) VALUES
  ('founder@thep31collective.org', 'Melanie JC'),
  ('ceo@p31market.com', 'Melanie JC')
ON CONFLICT (email) DO NOTHING;

-- Every admin must have confirmed her email, except the two original admins (as before).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u JOIN public.site_admins a ON a.email = lower(u.email)
    WHERE u.id = auth.uid()
      AND (u.email_confirmed_at IS NOT NULL OR a.email IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com'))
  );
$fn$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.chat_member_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT u.id FROM auth.users u JOIN site_admins a ON a.email = lower(u.email)
   WHERE u.email_confirmed_at IS NOT NULL OR a.email IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
  UNION SELECT user_id FROM system_operators
  UNION SELECT user_id FROM studio_members
  UNION SELECT u.id FROM auth.users u JOIN team_access t ON t.email = lower(u.email) WHERE u.email_confirmed_at IS NOT NULL AND cardinality(t.tools) > 0
  UNION SELECT user_id FROM academy_mentors
  UNION SELECT user_id FROM academy_enrollments WHERE status <> 'canceled'
  UNION SELECT id FROM curator_data WHERE status = 'approved';
$fn$;
REVOKE ALL ON FUNCTION public.chat_member_ids() FROM public, anon, authenticated;

INSERT INTO public.team_access (email, full_name, tools, note, role_title, photo_key, site, sort_order) VALUES
  ('founder@thep31collective.org', 'Melanie JC', '{}', 'Site admin: every dashboard', 'Founder & CEO', 'melanie', 'collective', 10),
  ('ceo@p31market.com', 'Melanie JC', '{}', 'Site admin: every dashboard', 'Founder & CEO', 'melanie', 'market', 11),
  ('secretary@thep31collective.org', 'Savannah Campbell', ARRAY['people', 'emails', 'classroom'], 'Administrative support, outreach communications', 'Executive Assistant', 'b', 'collective', 20),
  ('secretary@p31market.com', 'Savannah Campbell', ARRAY['vendors', 'events', 'orders', 'emails'], 'Administrative support, outreach communications', 'Executive Assistant', 'b', 'market', 21),
  ('marketing@p31market.com', 'Yanni Bratcher', ARRAY['studio', 'social'], 'Marketing strategy, organization awareness', 'Marketing Strategist', 'd', 'market', 30),
  ('members@thep31collective.org', 'Alexia Thomas', ARRAY['people', 'emails'], 'Community experience, event planning', 'Member Liaison', 'a', 'collective', 40),
  ('outreach@p31market.com', 'Alexia Thomas', ARRAY['events', 'vendors'], 'Community experience, event planning', 'Member Liaison', 'a', 'market', 41),
  ('grants@thep31collective.org', 'Shanay Prince', ARRAY['people'], 'Grants and partnerships, operations support', 'Support Coordinator', 'c', 'collective', 50),
  ('grants@p31market.com', 'Shanay Prince', ARRAY['vendors', 'events'], 'Grants and partnerships, operations support', 'Support Coordinator', 'c', 'market', 51),
  ('coordinator@p31market.com', 'Shanay Prince', ARRAY['orders', 'vendors', 'events'], 'Grants and partnerships, operations support', 'Support Coordinator', 'c', 'market', 52),
  ('vendor@p31market.com', 'Anthony Carr', ARRAY['davinci', 'shops', 'vendors', 'orders'], 'Virtual marketplace troubleshooting, vendor support', 'Marketplace Tech Support', NULL, 'market', 60)
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role_title = EXCLUDED.role_title,
  photo_key = EXCLUDED.photo_key,
  site = EXCLUDED.site,
  sort_order = EXCLUDED.sort_order,
  note = coalesce(team_access.note, EXCLUDED.note),
  tools = coalesce((SELECT array_agg(DISTINCT x) FROM unnest(team_access.tools || EXCLUDED.tools) AS x), '{}'::TEXT[]);

-- ----------------------------------------------------------
-- 3. Shop controls (admins and the shops dashboard)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_run_shops()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$ SELECT public.is_academy_admin() OR 'shops' = ANY (public.my_team_tools()); $fn$;
REVOKE ALL ON FUNCTION public.can_run_shops() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_run_shops() TO authenticated;

CREATE OR REPLACE FUNCTION public.shop_admin_list()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
BEGIN
  IF NOT public.can_run_shops() THEN RAISE EXCEPTION 'Only admins and the shops dashboard can see every shop.'; END IF;
  -- Every shop column (so later columns such as billing appear here too), minus the payment ids.
  RETURN coalesce((
    SELECT jsonb_agg((to_jsonb(c) - 'stripe_account_id' - 'stripe_billing_customer_id' - 'stripe_subscription_id') || jsonb_build_object(
      'verification_badges', coalesce(to_jsonb(c.verification_badges), '[]'::jsonb),
      'stripe_connected', c.stripe_account_id IS NOT NULL,
      'owner_name', p.full_name, 'owner_email', u.email,
      'products', (SELECT count(*) FROM products x WHERE x.curator_id = c.id),
      'products_active', (SELECT count(*) FROM products x WHERE x.curator_id = c.id AND coalesce(x.is_active, true)),
      'orders', (SELECT count(*) FROM orders o WHERE o.curator_id = c.id),
      'orders_30d', (SELECT count(*) FROM orders o WHERE o.curator_id = c.id AND o.created_at > now() - interval '30 days')
    ) ORDER BY c.created_at DESC)
    FROM curator_data c
    LEFT JOIN profiles p ON p.id = c.id
    LEFT JOIN auth.users u ON u.id = c.id), '[]'::jsonb);
END;
$fn$;
REVOKE ALL ON FUNCTION public.shop_admin_list() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shop_admin_list() TO authenticated;

-- Change a shop. Keys the patch may carry: status, is_paid, is_featured, is_early_bird,
-- is_published, verification_badges, admin_feedback, business_name, tagline, slug.
CREATE OR REPLACE FUNCTION public.shop_admin_update(p_id UUID, p_patch JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth
AS $fn$
DECLARE v_slug TEXT; v_status TEXT; v_row curator_data;
BEGIN
  IF NOT public.can_run_shops() THEN RAISE EXCEPTION 'Only admins and the shops dashboard can change a shop.'; END IF;
  IF p_patch ? 'slug' THEN
    v_slug := lower(btrim(p_patch->>'slug'));
    IF v_slug !~ '^[a-z0-9][a-z0-9_-]{1,60}$' THEN RAISE EXCEPTION 'A shop link uses letters, numbers and dashes only.'; END IF;
    IF EXISTS (SELECT 1 FROM curator_data WHERE slug = v_slug AND id <> p_id) THEN RAISE EXCEPTION 'Another shop already uses that link.'; END IF;
  END IF;
  IF p_patch ? 'status' THEN
    v_status := p_patch->>'status';
    IF v_status NOT IN ('draft', 'pending', 'approved', 'paused', 'rejected') THEN RAISE EXCEPTION 'Status can be draft, pending, approved, paused or rejected.'; END IF;
  END IF;
  -- The shop guard (guard_curator_data) undoes protected changes unless the write is trusted.
  PERFORM set_config('p31.trusted', 'on', true);
  UPDATE curator_data SET
    status = CASE WHEN p_patch ? 'status' THEN v_status ELSE status END,
    is_paid = CASE WHEN p_patch ? 'is_paid' THEN (p_patch->>'is_paid')::boolean ELSE is_paid END,
    is_featured = CASE WHEN p_patch ? 'is_featured' THEN (p_patch->>'is_featured')::boolean ELSE is_featured END,
    is_early_bird = CASE WHEN p_patch ? 'is_early_bird' THEN (p_patch->>'is_early_bird')::boolean ELSE is_early_bird END,
    is_published = CASE WHEN p_patch ? 'is_published' THEN (p_patch->>'is_published')::boolean ELSE is_published END,
    verification_badges = CASE WHEN p_patch ? 'verification_badges' THEN ARRAY(SELECT btrim(v) FROM jsonb_array_elements_text(p_patch->'verification_badges') AS v WHERE btrim(v) <> '') ELSE verification_badges END,
    admin_feedback = CASE WHEN p_patch ? 'admin_feedback' THEN nullif(btrim(p_patch->>'admin_feedback'), '') ELSE admin_feedback END,
    business_name = CASE WHEN p_patch ? 'business_name' THEN coalesce(nullif(btrim(p_patch->>'business_name'), ''), business_name) ELSE business_name END,
    tagline = CASE WHEN p_patch ? 'tagline' THEN nullif(btrim(p_patch->>'tagline'), '') ELSE tagline END,
    slug = CASE WHEN p_patch ? 'slug' THEN v_slug ELSE slug END
  WHERE id = p_id
  RETURNING * INTO v_row;
  PERFORM set_config('p31.trusted', '', true);
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'That shop was not found.'; END IF;
  RETURN jsonb_build_object('id', v_row.id, 'status', v_row.status, 'slug', v_row.slug, 'is_featured', v_row.is_featured, 'is_paid', v_row.is_paid);
END;
$fn$;
REVOKE ALL ON FUNCTION public.shop_admin_update(UUID, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shop_admin_update(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.shop_admin_products(p_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT public.can_run_shops() THEN RAISE EXCEPTION 'Only admins and the shops dashboard can see a shop.'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('id', x.id, 'name', x.name, 'price', x.price, 'image_url', x.image_url, 'is_active', coalesce(x.is_active, true),
                                        'is_featured', coalesce(x.is_featured, false), 'badge', x.badge, 'category', x.category, 'created_at', x.created_at) ORDER BY x.created_at DESC)
    FROM products x WHERE x.curator_id = p_id), '[]'::jsonb);
END;
$fn$;
REVOKE ALL ON FUNCTION public.shop_admin_products(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shop_admin_products(UUID) TO authenticated;

-- Change a product: is_active, is_featured, badge.
CREATE OR REPLACE FUNCTION public.shop_admin_set_product(p_id BIGINT, p_patch JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_row products;
BEGIN
  IF NOT public.can_run_shops() THEN RAISE EXCEPTION 'Only admins and the shops dashboard can change a product.'; END IF;
  UPDATE products SET
    is_active = CASE WHEN p_patch ? 'is_active' THEN (p_patch->>'is_active')::boolean ELSE is_active END,
    is_featured = CASE WHEN p_patch ? 'is_featured' THEN (p_patch->>'is_featured')::boolean ELSE is_featured END,
    badge = CASE WHEN p_patch ? 'badge' THEN nullif(btrim(p_patch->>'badge'), '') ELSE badge END
  WHERE id = p_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'That product was not found.'; END IF;
  RETURN jsonb_build_object('id', v_row.id, 'is_active', v_row.is_active, 'is_featured', v_row.is_featured, 'badge', v_row.badge);
END;
$fn$;
REVOKE ALL ON FUNCTION public.shop_admin_set_product(BIGINT, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shop_admin_set_product(BIGINT, JSONB) TO authenticated;

-- ----------------------------------------------------------
-- 4. Lesson videos and session recordings, uploaded
-- ----------------------------------------------------------
ALTER TABLE public.academy_lessons ADD COLUMN IF NOT EXISTS video_path TEXT;
ALTER TABLE public.academy_sessions ADD COLUMN IF NOT EXISTS recording_path TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('academy-media', 'academy-media', false, 524288000, ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Files live under <program slug>/lessons/... and <program slug>/sessions/...
CREATE OR REPLACE FUNCTION public.academy_media_program(p_name TEXT)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$ SELECT id FROM academy_programs WHERE slug = split_part(p_name, '/', 1); $fn$;
REVOKE ALL ON FUNCTION public.academy_media_program(TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.academy_media_program(TEXT) TO authenticated;

DROP POLICY IF EXISTS "Classroom media for members" ON storage.objects;
CREATE POLICY "Classroom media for members" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'academy-media' AND public.has_academy_access(public.academy_media_program(name)));
DROP POLICY IF EXISTS "Mentors add classroom media" ON storage.objects;
CREATE POLICY "Mentors add classroom media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'academy-media' AND public.is_mentor(public.academy_media_program(name)));
DROP POLICY IF EXISTS "Mentors change classroom media" ON storage.objects;
CREATE POLICY "Mentors change classroom media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'academy-media' AND public.is_mentor(public.academy_media_program(name)));
DROP POLICY IF EXISTS "Mentors remove classroom media" ON storage.objects;
CREATE POLICY "Mentors remove classroom media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'academy-media' AND public.is_mentor(public.academy_media_program(name)));

-- ----------------------------------------------------------
-- 5. Titles in The Gathering from the team list
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.chat_roles(p_user UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  WITH u AS (SELECT id, lower(email) AS email, email_confirmed_at IS NOT NULL AS confirmed FROM auth.users WHERE id = p_user)
  SELECT jsonb_build_object(
    'admin', EXISTS (SELECT 1 FROM u JOIN site_admins a ON a.email = u.email WHERE u.confirmed OR a.email IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')),
    'team', EXISTS (SELECT 1 FROM system_operators WHERE user_id = p_user)
         OR EXISTS (SELECT 1 FROM studio_members WHERE user_id = p_user)
         OR EXISTS (SELECT 1 FROM u JOIN team_access t ON t.email = u.email WHERE u.confirmed AND (cardinality(t.tools) > 0 OR EXISTS (SELECT 1 FROM site_admins a WHERE a.email = u.email))),
    'mentor', coalesce((SELECT jsonb_agg(DISTINCT p.slug) FROM academy_mentors m JOIN academy_programs p ON p.id = m.program_id WHERE m.user_id = p_user), '[]'::jsonb),
    'student', coalesce((SELECT jsonb_agg(jsonb_build_object('program', p.slug, 'alum', e.status = 'expired'))
                          FROM academy_enrollments e JOIN academy_programs p ON p.id = e.program_id
                         WHERE e.user_id = p_user AND e.status <> 'canceled'), '[]'::jsonb),
    'vendor', (SELECT jsonb_build_object('shop', c.business_name, 'slug', c.slug) FROM curator_data c WHERE c.id = p_user AND c.status = 'approved'),
    'title', coalesce((SELECT title FROM chat_titles WHERE user_id = p_user),
                      (SELECT t.role_title FROM u JOIN team_access t ON t.email = u.email WHERE u.confirmed))
  );
$fn$;

INSERT INTO public.chat_titles (user_id, title)
SELECT u.id, t.title FROM auth.users u
  JOIN (VALUES ('founder@thep31collective.org', 'Founder & CEO'), ('ceo@p31market.com', 'Founder & CEO'),
               ('secretary@thep31collective.org', 'Executive Assistant'), ('secretary@p31market.com', 'Executive Assistant'),
               ('marketing@p31market.com', 'Marketing Strategist'),
               ('members@thep31collective.org', 'Member Liaison'), ('outreach@p31market.com', 'Member Liaison'),
               ('grants@thep31collective.org', 'Support Coordinator'), ('grants@p31market.com', 'Support Coordinator'), ('coordinator@p31market.com', 'Support Coordinator'),
               ('vendor@p31market.com', 'Marketplace Tech Support')) AS t(email, title) ON t.email = lower(u.email)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- Done. One row that says it all worked:
-- ============================================================
SELECT
  (SELECT count(*) FROM public.team_access) AS team_logins,
  EXISTS (SELECT 1 FROM public.site_admins WHERE email = 'founder@thep31collective.org') AS melanie_admin,
  to_regprocedure('public.shop_admin_list()') IS NOT NULL AS shops_ready,
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'academy-media') AS media_ready;
