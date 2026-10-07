/* ==========================================================
   P31 SECURITY SELF-TEST
   Paste into the Supabase SQL Editor and run (after v18).

   It signs in "as" a real non-admin curator, tries each of
   the attacks the October 2026 audit found, records what
   happened, then ROLLS EVERYTHING BACK — no data changes.

   Every row in the result should say passed = true.
   ========================================================== */

DROP TABLE IF EXISTS p31_security_test;
CREATE TEMP TABLE p31_security_test (
  n INT, check_name TEXT, expected TEXT, actual TEXT, passed BOOLEAN
);

DO $$
DECLARE
  v_uid UUID;
  v_email TEXT;
  v_before JSONB;
  v_after JSONB;
  v_txt TEXT;
  v_int INT;
  results JSONB := '[]'::jsonb;
BEGIN
  IF to_regclass('public.system_operators') IS NULL THEN
    INSERT INTO p31_security_test VALUES
      (0, 'Run storefront_v18_systems_and_commerce.sql first, then this test', 'v18 applied', 'v18 not found', false);
    RETURN;
  END IF;

  SELECT u.id, u.email INTO v_uid, v_email
  FROM auth.users u
  JOIN curator_data c ON c.id = u.id
  JOIN profiles p ON p.id = u.id
  WHERE lower(u.email) NOT IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
    AND NOT EXISTS (SELECT 1 FROM system_operators o WHERE o.user_id = u.id)
  LIMIT 1;

  IF v_uid IS NULL THEN
    INSERT INTO p31_security_test VALUES
      (0, 'Find a non-admin curator to impersonate', 'found', 'none found', false);
    RETURN;
  END IF;

  SELECT to_jsonb(c) INTO v_before FROM curator_data c WHERE id = v_uid;

  BEGIN
    -- Become that curator, exactly as the website would.
    PERFORM set_config('role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_uid, 'role', 'authenticated', 'email', v_email)::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);

    results := results || jsonb_build_object('n', 1,
      'c', 'Curator is not an admin', 'e', 'false', 'a', public.is_admin()::text);

    -- Hole 1: forge an admin email on your own profile.
    UPDATE profiles SET email = 'info@lumenlabsatl.com' WHERE id = v_uid;
    -- (v19 hides the email column from site users, so read it back as the owner)
    PERFORM set_config('role', 'none', true);
    SELECT email INTO v_txt FROM profiles WHERE id = v_uid;
    PERFORM set_config('role', 'authenticated', true);
    results := results || jsonb_build_object('n', 2,
      'c', 'Profile email stays the real login email', 'e', v_email, 'a', v_txt);
    results := results || jsonb_build_object('n', 3,
      'c', 'Still not an admin after trying', 'e', 'false', 'a', public.is_admin()::text);

    -- Hole 2: approve / pay / feature yourself.
    UPDATE curator_data
    SET is_paid = true, is_published = true, status = 'approved', is_featured = true, plan = 'premium'
    WHERE id = v_uid;
    SELECT to_jsonb(c) INTO v_after FROM curator_data c WHERE id = v_uid;
    results := results
      || jsonb_build_object('n', 4, 'c', 'Cannot mark self paid',
           'e', coalesce(v_before->>'is_paid', 'null'), 'a', coalesce(v_after->>'is_paid', 'null'))
      || jsonb_build_object('n', 5, 'c', 'Cannot publish self',
           'e', coalesce(v_before->>'is_published', 'null'), 'a', coalesce(v_after->>'is_published', 'null'))
      || jsonb_build_object('n', 6, 'c', 'Cannot approve self',
           'e', coalesce(v_before->>'status', 'null'),
           'a', coalesce(v_after->>'status', 'null'))
      || jsonb_build_object('n', 7, 'c', 'Cannot feature self',
           'e', coalesce(v_before->>'is_featured', 'null'), 'a', coalesce(v_after->>'is_featured', 'null'))
      || jsonb_build_object('n', 8, 'c', 'Cannot upgrade own plan',
           'e', coalesce(v_before->>'plan', 'null'), 'a', coalesce(v_after->>'plan', 'null'));

    -- Other curators' rows are off limits.
    UPDATE curator_data SET tagline = tagline WHERE id <> v_uid;
    GET DIAGNOSTICS v_int = ROW_COUNT;
    results := results || jsonb_build_object('n', 9,
      'c', 'Cannot edit other curators', 'e', '0', 'a', v_int::text);

    UPDATE products SET name = name WHERE curator_id <> v_uid;
    GET DIAGNOSTICS v_int = ROW_COUNT;
    results := results || jsonb_build_object('n', 10,
      'c', 'Cannot edit other curators'' products', 'e', '0', 'a', v_int::text);

    -- Hole 4: other people's images.
    UPDATE storage.objects SET metadata = metadata
    WHERE owner_id IS DISTINCT FROM v_uid::text;
    GET DIAGNOSTICS v_int = ROW_COUNT;
    results := results || jsonb_build_object('n', 11,
      'c', 'Cannot overwrite other people''s files', 'e', '0', 'a', v_int::text);

    -- Private lists.
    SELECT count(*) INTO v_int FROM vendor_approvals WHERE lower(email) <> lower(v_email);
    results := results || jsonb_build_object('n', 12,
      'c', 'Cannot read pre-approved vendor list', 'e', '0', 'a', v_int::text);

    SELECT count(*) INTO v_int FROM onboarding_codes;
    results := results || jsonb_build_object('n', 13,
      'c', 'Cannot read onboarding codes', 'e', '0', 'a', v_int::text);

    results := results || jsonb_build_object('n', 14,
      'c', 'Wrong onboarding code is rejected', 'e', 'false',
      'a', public.check_onboarding_code('not-the-code')::text);

    SELECT count(*) INTO v_int FROM social_prospects;
    results := results || jsonb_build_object('n', 15,
      'c', 'Curators cannot see Systems data', 'e', '0', 'a', v_int::text);

    results := results || jsonb_build_object('n', 16,
      'c', 'Curator is not a Systems operator', 'e', 'false', 'a', public.is_operator()::text);

    -- v19 privacy: account emails are not readable by other users.
    BEGIN
      EXECUTE 'SELECT email FROM public.profiles LIMIT 1' INTO v_txt;
      results := results || jsonb_build_object('n', 19, 'c', 'Cannot read other people''s account emails', 'e', 'blocked', 'a', 'readable');
    EXCEPTION WHEN insufficient_privilege THEN
      results := results || jsonb_build_object('n', 19, 'c', 'Cannot read other people''s account emails', 'e', 'blocked', 'a', 'blocked');
    END;

    IF to_regclass('public.leads') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM public.leads' INTO v_int;
      results := results || jsonb_build_object('n', 17,
        'c', 'Cannot read newsletter leads', 'e', '0', 'a', v_int::text);
    END IF;

    IF to_regclass('public.partnerships') IS NOT NULL THEN
      EXECUTE 'SELECT count(*) FROM public.partnerships' INTO v_int;
      results := results || jsonb_build_object('n', 18,
        'c', 'Cannot read partnership inquiries', 'e', '0', 'a', v_int::text);
    END IF;

    RAISE EXCEPTION 'p31_rollback';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'p31_rollback' THEN
      results := results || jsonb_build_object('n', 99,
        'c', 'Test stopped on an unexpected error', 'e', 'no error', 'a', SQLERRM);
    END IF;
  END;

  INSERT INTO p31_security_test
  SELECT (r->>'n')::int, r->>'c', r->>'e', r->>'a', (r->>'e') = (r->>'a')
  FROM jsonb_array_elements(results) r;
END $$;

SELECT * FROM p31_security_test ORDER BY n;
