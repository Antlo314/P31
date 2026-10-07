/* ==========================================================
   P31 MARKETPLACE — V18: SYSTEMS + COMMERCE FOUNDATION
   Run in the Supabase SQL Editor after v16 and v17.
   Safe to re-run.

   1. Tightens the v16 "trusted writer" check so it keys off
      the request's role (anon / authenticated) instead of the
      connection user. Same protection for the live site, and
      it can now be tested from the SQL Editor
      (see tests/security_check.sql).
   2. Systems operators (the private /systems area).
   3. Commerce: unlimited products with Shopify-style fields,
      store design, and a curator plan (free / premium).
   4. Tables for Social Command, Clip Studio and Pro Edit.
   ========================================================== */


-- ──────────────────────────────────────────────────────────
-- 1. Trust check v2
--    Browser/API requests always run as 'anon' or
--    'authenticated'. Anything else (SQL Editor, service-role
--    Edge Functions, Supabase internals) is server-side.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_trusted_writer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(nullif(current_setting('role', true), ''), 'none') NOT IN ('anon', 'authenticated')
      OR coalesce(current_setting('p31.trusted', true), '') = 'on'
      OR public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.guard_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF coalesce(nullif(current_setting('role', true), ''), 'none') NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  NEW.email := (SELECT email FROM auth.users WHERE id = NEW.id);
  RETURN NEW;
END;
$$;


-- ──────────────────────────────────────────────────────────
-- 2. Systems operators
--    Logins for /systems. Being an operator is granted ONLY
--    by a row here — never by email address or domain.
--
--    To add an operator:
--      a) Supabase → Authentication → Users → Add user
--         Email:    <username>@systems.p31market.com  (lowercase)
--         Password: at least 8 characters
--         Tick "Auto Confirm User"
--      b) Run, with the username exactly as they'll type it:
--         SELECT public.add_system_operator('Antlo314', 'owner');
--         SELECT public.add_system_operator('Melanie',  'member');
--    Owners can reset other operators' passwords from
--    Systems → Settings.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_operators (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE system_operators ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM system_operators WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_operator_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM system_operators WHERE user_id = auth.uid() AND role = 'owner');
$$;

DROP POLICY IF EXISTS "Operators see the team" ON system_operators;
CREATE POLICY "Operators see the team" ON system_operators
FOR SELECT TO authenticated USING (public.is_operator() OR public.is_admin());

-- SQL Editor helper (not callable from the site).
CREATE OR REPLACE FUNCTION public.add_system_operator(p_username TEXT, p_role TEXT DEFAULT 'member')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT := lower(p_username) || '@systems.p31market.com';
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = v_email;
  IF v_id IS NULL THEN
    RETURN 'No auth user with email ' || v_email || ' — create it first under Authentication → Users.';
  END IF;
  INSERT INTO system_operators (user_id, username, display_name, role)
  VALUES (v_id, p_username, p_username, p_role)
  ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, role = EXCLUDED.role;
  RETURN 'Operator ' || p_username || ' (' || p_role || ') is ready.';
END;
$$;
REVOKE ALL ON FUNCTION public.add_system_operator(TEXT, TEXT) FROM public, anon, authenticated;


-- ──────────────────────────────────────────────────────────
-- 3. Commerce
-- ──────────────────────────────────────────────────────────
-- Products: no cap, plus the fields a real catalog needs.
ALTER TABLE products
ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS inventory INTEGER,                       -- NULL = not tracked
ADD COLUMN IF NOT EXISTS sku TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb,      -- [{name:'Size', options:['S','M']}]
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,          -- hide without deleting
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS products_curator_sort_idx ON products (curator_id, sort_order, created_at DESC);

-- Store design (template, colours, fonts, section order) is the
-- curator's to edit. Plan is not — it's protected below.
ALTER TABLE curator_data
ADD COLUMN IF NOT EXISTS store_design JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';

-- Re-issue the v16 guard with 'plan' added to the protected list.
CREATE OR REPLACE FUNCTION public.guard_curator_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  protected TEXT[] := ARRAY[
    'is_paid', 'is_published', 'is_featured', 'is_early_bird',
    'verification_badges', 'admin_feedback', 'branding_package_unlocked',
    'stripe_account_id', 'stripe_charges_enabled',
    'stripe_payouts_enabled', 'stripe_details_submitted', 'plan'
  ];
  new_j JSONB;
  old_j JSONB;
  k TEXT;
  pre_approved BOOLEAN;
BEGIN
  IF public.is_trusted_writer() THEN
    RETURN NEW;
  END IF;

  new_j := to_jsonb(NEW);

  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS (
      SELECT 1 FROM vendor_approvals va
      JOIN auth.users u ON lower(u.email) = lower(va.email)
      WHERE u.id = auth.uid()
    ) INTO pre_approved;

    new_j := new_j
      || jsonb_build_object(
           'status',       CASE WHEN pre_approved THEN 'approved' ELSE 'pending' END,
           'is_paid',      pre_approved,
           'is_published', pre_approved);
    IF new_j ? 'is_featured'               THEN new_j := new_j || '{"is_featured": false}'; END IF;
    IF new_j ? 'verification_badges'       THEN new_j := new_j || '{"verification_badges": null}'; END IF;
    IF new_j ? 'admin_feedback'            THEN new_j := new_j || '{"admin_feedback": null}'; END IF;
    IF new_j ? 'branding_package_unlocked' THEN new_j := new_j || '{"branding_package_unlocked": false}'; END IF;
    IF new_j ? 'stripe_account_id'         THEN new_j := new_j || '{"stripe_account_id": null}'; END IF;
    IF new_j ? 'stripe_charges_enabled'    THEN new_j := new_j || '{"stripe_charges_enabled": false}'; END IF;
    IF new_j ? 'stripe_payouts_enabled'    THEN new_j := new_j || '{"stripe_payouts_enabled": false}'; END IF;
    IF new_j ? 'stripe_details_submitted'  THEN new_j := new_j || '{"stripe_details_submitted": false}'; END IF;
    IF new_j ? 'plan'                      THEN new_j := new_j || '{"plan": "free"}'; END IF;

  ELSE -- UPDATE
    old_j := to_jsonb(OLD);
    FOREACH k IN ARRAY protected LOOP
      IF old_j ? k THEN
        new_j := jsonb_set(new_j, ARRAY[k], old_j -> k);
      END IF;
    END LOOP;

    IF NOT (
      NEW.status IS NOT DISTINCT FROM OLD.status
      OR (NEW.status = 'pending' AND coalesce(OLD.status, 'draft') IN ('draft', 'rejected'))
    ) THEN
      new_j := jsonb_set(new_j, '{status}', to_jsonb(OLD.status));
    END IF;
  END IF;

  NEW := jsonb_populate_record(NEW, new_j);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_premium_curator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM curator_data WHERE id = auth.uid() AND plan = 'premium');
$$;


-- ──────────────────────────────────────────────────────────
-- 4. Social Command (operators only)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_searches (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  source TEXT NOT NULL,            -- e.g. 'facebook_groups', 'instagram_hashtag'
  query TEXT NOT NULL,
  result_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_prospects (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  platform TEXT NOT NULL,          -- facebook, instagram, tiktok, web
  kind TEXT NOT NULL DEFAULT 'group', -- group, person, page, hashtag
  name TEXT,
  url TEXT NOT NULL UNIQUE,
  audience_size INTEGER,
  description TEXT,
  source_query TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'joined', 'partner', 'ignore')),
  notes TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_posts (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  platforms TEXT[] NOT NULL DEFAULT '{}',
  caption TEXT,
  media_urls TEXT[] DEFAULT '{}',
  scheduled_for TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posted', 'failed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE social_searches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Operators run social searches" ON social_searches;
CREATE POLICY "Operators run social searches" ON social_searches
FOR ALL TO authenticated USING (public.is_operator()) WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "Operators manage prospects" ON social_prospects;
CREATE POLICY "Operators manage prospects" ON social_prospects
FOR ALL TO authenticated USING (public.is_operator()) WITH CHECK (public.is_operator());

DROP POLICY IF EXISTS "Operators manage posts" ON social_posts;
CREATE POLICY "Operators manage posts" ON social_posts
FOR ALL TO authenticated USING (public.is_operator()) WITH CHECK (public.is_operator());


-- ──────────────────────────────────────────────────────────
-- 5. Pro Edit queue (premium curators + operators)
--    Footage goes to the private 'studio' bucket; Iris (the
--    DaVinci Resolve editor in LumenCommand) picks jobs up,
--    edits, and uploads the result.
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pro_edit_jobs (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT,
  source_paths TEXT[] NOT NULL,    -- paths inside the 'studio' bucket
  style TEXT,                      -- Iris visual style
  aspect TEXT DEFAULT '9:16',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  result_path TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Set by tools/iris_bridge.py once Iris has built the edit package.
ALTER TABLE pro_edit_jobs ADD COLUMN IF NOT EXISTS iris_package TEXT;
ALTER TABLE pro_edit_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Request pro edits" ON pro_edit_jobs;
CREATE POLICY "Request pro edits" ON pro_edit_jobs
FOR INSERT TO authenticated
WITH CHECK (requested_by = auth.uid() AND (public.is_premium_curator() OR public.is_operator()));

DROP POLICY IF EXISTS "See own pro edits" ON pro_edit_jobs;
CREATE POLICY "See own pro edits" ON pro_edit_jobs
FOR SELECT TO authenticated
USING (requested_by = auth.uid() OR public.is_operator() OR public.is_admin());

DROP POLICY IF EXISTS "Operators update pro edits" ON pro_edit_jobs;
CREATE POLICY "Operators update pro edits" ON pro_edit_jobs
FOR UPDATE TO authenticated USING (public.is_operator()) WITH CHECK (public.is_operator());

INSERT INTO storage.buckets (id, name, public)
VALUES ('studio', 'studio', false)
ON CONFLICT (id) DO NOTHING;

-- Files live under <user id>/... ; you see your own, operators see all.
DROP POLICY IF EXISTS "Studio upload own folder" ON storage.objects;
CREATE POLICY "Studio upload own folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'studio' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Studio read own or operator" ON storage.objects;
CREATE POLICY "Studio read own or operator" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'studio' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_operator()));

DROP POLICY IF EXISTS "Studio operators write results" ON storage.objects;
CREATE POLICY "Studio operators write results" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'studio' AND public.is_operator());


-- Updated-at bookkeeping
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_social_prospects ON social_prospects;
CREATE TRIGGER touch_social_prospects BEFORE UPDATE ON social_prospects
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_social_posts ON social_posts;
CREATE TRIGGER touch_social_posts BEFORE UPDATE ON social_posts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS touch_pro_edit_jobs ON pro_edit_jobs;
CREATE TRIGGER touch_pro_edit_jobs BEFORE UPDATE ON pro_edit_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Live status updates for Pro Edit (the page refreshes itself).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE pro_edit_jobs;
EXCEPTION WHEN duplicate_object OR undefined_object THEN
  NULL; -- already published, or realtime publication not present
END $$;
