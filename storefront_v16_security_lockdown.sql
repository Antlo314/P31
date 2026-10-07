/* ==========================================================
   P31 MARKETPLACE — V16: SECURITY LOCKDOWN
   Closes four holes found in the October 2026 audit:

   1. Admin escalation — admin policies trusted profiles.email,
      which every user could rewrite on their own profile.
   2. Self-approval — curators could set is_paid / status /
      is_published / badges on their own curator_data row.
   3. Onboarding access code lived in the public JS bundle.
   4. Storage — any signed-in user could overwrite or delete
      any other curator's images.

   Also hides the pre-approved vendor list (it was publicly
   readable, exposing names and emails).

   Run this whole file in the Supabase SQL Editor. Safe to
   re-run.
   ========================================================== */


-- ──────────────────────────────────────────────────────────
-- 0. Single source of truth for "is this caller an admin?"
--    Reads the email from auth.users (which users cannot
--    write), never from profiles.
--    Admin emails must match src/context/AuthContext.jsx.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND lower(email) IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
  );
$$;

-- Server-side callers (SQL editor, Edge Functions with the
-- service role key, and our own SECURITY DEFINER functions)
-- are trusted to write protected columns.
-- Every browser/API request connects as 'authenticator';
-- session_user (unlike current_user) is not changed by
-- SECURITY DEFINER, so it is safe to check inside triggers.
CREATE OR REPLACE FUNCTION public.is_trusted_writer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT session_user <> 'authenticator'
      OR coalesce(auth.role(), '') = 'service_role'
      OR coalesce(current_setting('p31.trusted', true), '') = 'on'
      OR public.is_admin();
$$;


-- ──────────────────────────────────────────────────────────
-- 1. profiles.email can no longer be forged.
--    It is pinned to the real auth email on insert and
--    cannot be changed by the user afterwards. This also
--    neutralises any older policy that still reads
--    profiles.email.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF session_user <> 'authenticator'
     OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.email := (SELECT email FROM auth.users WHERE id = NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_email ON profiles;
CREATE TRIGGER guard_profile_email
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_email();

-- Repair any profile whose email was already tampered with.
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND p.email IS DISTINCT FROM u.email;


-- ──────────────────────────────────────────────────────────
-- 2. Re-point every admin policy at is_admin().
-- ──────────────────────────────────────────────────────────
-- Some older migrations were never run on every database, so a
-- table may be missing. Each rewrite is skipped if its table does
-- not exist (the NOTICE lists which ones were skipped).
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN SELECT * FROM (VALUES
    ('partnerships',        'Admins can view inquiries',
       'FOR SELECT TO authenticated USING (public.is_admin())'),
    ('partnerships',        'Admins can update inquiries',
       'FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())'),
    ('messages',            'Messages deletion',
       'FOR DELETE TO authenticated USING (auth.uid() = profile_id OR public.is_admin())'),
    ('market_events',       'Admins can manage all institutional data',
       'FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())'),
    ('analytics_snapshots', 'Admins can manage all analytics',
       'FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())'),
    ('announcements',       'Admins can manage announcements',
       'FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())'),
    ('leads',               'Admins can view leads',
       'FOR SELECT TO authenticated USING (public.is_admin())'),
    ('activity_logs',       'Curators can view their own activity logs',
       'FOR SELECT TO authenticated USING (auth.uid() = curator_id OR public.is_admin())'),
    ('orders',              'Admins view all orders',
       'FOR SELECT USING (public.is_admin())')
  ) AS t(tbl, name, body)
  LOOP
    IF to_regclass('public.' || p.tbl) IS NULL THEN
      RAISE NOTICE 'Skipped policy "%": table % does not exist', p.name, p.tbl;
      CONTINUE;
    END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.name, p.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I %s', p.name, p.tbl, p.body);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Admins delete curators" ON curator_data;
CREATE POLICY "Admins delete curators" ON curator_data
FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins delete any product" ON products;
CREATE POLICY "Admins delete any product" ON products
FOR DELETE USING (public.is_admin());

-- Governance (approve / reject / feature / badges) updates other
-- curators' rows, so admins need an explicit update policy.
DROP POLICY IF EXISTS "Admins update curators" ON curator_data;
CREATE POLICY "Admins update curators" ON curator_data
FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ──────────────────────────────────────────────────────────
-- 3. Pre-approved vendor list: admins only, plus a curator
--    may see their own row. (Was readable by anyone.)
-- ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can check approval status" ON vendor_approvals;
DROP POLICY IF EXISTS "Admins can manage vendor approvals" ON vendor_approvals;
CREATE POLICY "Admins can manage vendor approvals" ON vendor_approvals
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Curators can see own approval" ON vendor_approvals;
CREATE POLICY "Curators can see own approval" ON vendor_approvals
FOR SELECT TO authenticated
USING (lower(email) = lower(auth.jwt() ->> 'email'));


-- ──────────────────────────────────────────────────────────
-- 4. curator_data: the database, not the browser, decides
--    payment, approval and publishing.
--
--    INSERT by a normal user: approved + paid + published
--      only if their auth email is on vendor_approvals;
--      otherwise 'pending', unpaid, unpublished.
--    UPDATE by a normal user: protected columns keep their
--      old values. The only status change allowed is
--      submitting for review (draft / rejected → pending).
-- ──────────────────────────────────────────────────────────
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
    'stripe_payouts_enabled', 'stripe_details_submitted'
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

DROP TRIGGER IF EXISTS guard_curator_data ON curator_data;
CREATE TRIGGER guard_curator_data
BEFORE INSERT OR UPDATE ON curator_data
FOR EACH ROW EXECUTE FUNCTION public.guard_curator_data();


-- ──────────────────────────────────────────────────────────
-- 5. Onboarding access code moves server-side.
--    The table has RLS on and no policies, so it can only be
--    read through the two functions below.
--
--    The old code was published in the site's JavaScript,
--    so ROTATE IT after running this:
--      UPDATE onboarding_codes SET active = false;
--      INSERT INTO onboarding_codes (code) VALUES ('YOUR-NEW-CODE');
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_codes (
  code TEXT PRIMARY KEY,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE onboarding_codes ENABLE ROW LEVEL SECURITY;

INSERT INTO onboarding_codes (code) VALUES ('P31_EXCELLENCE_2026')
ON CONFLICT (code) DO NOTHING;

-- Step 1 of /onboarding-exclusive: is this code valid?
CREATE OR REPLACE FUNCTION public.check_onboarding_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM onboarding_codes WHERE code = p_code AND active);
$$;

-- Step 2: after sign-up, unlock the caller's own studio.
CREATE OR REPLACE FUNCTION public.redeem_onboarding_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.check_onboarding_code(p_code) THEN
    RETURN FALSE;
  END IF;

  PERFORM set_config('p31.trusted', 'on', true);
  UPDATE curator_data SET is_paid = TRUE WHERE id = auth.uid();
  PERFORM set_config('p31.trusted', '', true);
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.check_onboarding_code(TEXT) FROM public;
REVOKE ALL ON FUNCTION public.redeem_onboarding_code(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.check_onboarding_code(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_onboarding_code(TEXT) TO authenticated;


-- ──────────────────────────────────────────────────────────
-- 6. Storage: you can only change or delete files you
--    uploaded (admins can manage everything). Reading stays
--    public and any signed-in curator can still upload.
-- ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Curator Update Access"      ON storage.objects;
DROP POLICY IF EXISTS "Curator Delete Access"      ON storage.objects;
DROP POLICY IF EXISTS "Curator Banner Update"      ON storage.objects;
DROP POLICY IF EXISTS "Curator Logo Update"        ON storage.objects;
DROP POLICY IF EXISTS "Allow Individual Updates"   ON storage.objects;
DROP POLICY IF EXISTS "Allow Individual Deletions" ON storage.objects;
DROP POLICY IF EXISTS "P31 owners update files"    ON storage.objects;
DROP POLICY IF EXISTS "P31 owners delete files"    ON storage.objects;

CREATE POLICY "P31 owners update files" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id IN ('products', 'banners', 'logos', 'avatars')
  AND (owner_id = auth.uid()::text OR public.is_admin())
);

CREATE POLICY "P31 owners delete files" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id IN ('products', 'banners', 'logos', 'avatars')
  AND (owner_id = auth.uid()::text OR public.is_admin())
);


-- ──────────────────────────────────────────────────────────
-- 7. Check: run this after the migration. Every UPDATE or
--    DELETE row should mention owner_id or is_admin. If you
--    see one that only checks auth.role() = 'authenticated',
--    drop it: it re-opens hole #4.
-- ──────────────────────────────────────────────────────────
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY cmd, policyname;
