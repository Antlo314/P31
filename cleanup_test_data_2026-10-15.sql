/* ============================================================
   P31 - remove the test data before real accounts go in (2026-10-15)
   Safe to run more than once: the second run finds nothing to remove.

   HOW TO RUN (no pasting): from the project folder
     npx supabase db query --linked --project-ref xsnhxjttdizljaawpumz -f cleanup_test_data_2026-10-15.sql
   The result is one row: every column 0.

   Removes
   - three test logins and everything they made (forms, invitations,
     enrollments, shop, products, chat, notes):
       mjeffers031@gmail.com (Test), melaniecameron07@gmail.com (Melanie TEST),
       botanical.alchemy@example.com (Aura Rose sample vendor)
   - test form entries that are not logins:
       the join-page and vendor-form checks (p31-sheet-test, p31-vendor-test),
       the join-page tests sent from the admin mailbox (17og, 123987og, discountsbuddy),
       the Anthony Carr intro-call test from lumenlabsatl (the Dr. G login stays)
   Keeps every real lead, vendor, team login, admin and event.
   ============================================================ */

CREATE TEMP TABLE IF NOT EXISTS _test_emails (email TEXT PRIMARY KEY);
INSERT INTO _test_emails (email) VALUES
  ('mjeffers031@gmail.com'), ('melaniecameron07@gmail.com'), ('botanical.alchemy@example.com'),
  ('p31-sheet-test@example.com'), ('p31-vendor-test@example.com'),
  ('17og@gmail.com'), ('123987og@gmail.com'), ('discountsbuddy@gmail.com'),
  ('lumenlabsatl@gmail.com')
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE IF NOT EXISTS _test_users (id UUID PRIMARY KEY);
INSERT INTO _test_users (id)
  SELECT id FROM auth.users WHERE lower(email) IN ('mjeffers031@gmail.com', 'melaniecameron07@gmail.com', 'botanical.alchemy@example.com')
ON CONFLICT DO NOTHING;

-- Records found by email (the forms go with their intake).
DELETE FROM public.coaching_intakes WHERE lower(email) IN (SELECT email FROM _test_emails);
DELETE FROM public.academy_invites WHERE lower(email) IN (SELECT email FROM _test_emails);
DELETE FROM public.academy_inquiries WHERE lower(email) IN (SELECT email FROM _test_emails);
DELETE FROM public.collective_applications WHERE lower(email) IN (SELECT email FROM _test_emails);
DELETE FROM public.vendor_applications WHERE lower(email) IN (SELECT email FROM _test_emails);
DELETE FROM public.crm_contacts WHERE lower(email) IN (SELECT email FROM _test_emails);

-- What the three test logins made. Most tables follow the login away on their own;
-- these would otherwise stay behind without an author.
DELETE FROM public.chat_messages WHERE author_id IN (SELECT id FROM _test_users);
DELETE FROM public.products WHERE curator_id IN (SELECT id FROM _test_users);
DELETE FROM public.curator_data WHERE id IN (SELECT id FROM _test_users);
-- Two links do not clear themselves: point them at nobody first.
UPDATE public.vendor_approvals SET approved_by = NULL WHERE approved_by IN (SELECT id FROM _test_users);
DO $ann$
BEGIN
  IF to_regclass('public.announcements') IS NOT NULL THEN
    UPDATE public.announcements SET created_by = NULL WHERE created_by IN (SELECT id FROM _test_users);
  END IF;
END;
$ann$;
DELETE FROM public.profiles WHERE id IN (SELECT id FROM _test_users);
DELETE FROM auth.users WHERE id IN (SELECT id FROM _test_users);

SELECT
  (SELECT count(*) FROM auth.users WHERE lower(email) IN ('mjeffers031@gmail.com', 'melaniecameron07@gmail.com', 'botanical.alchemy@example.com')) AS test_logins_left,
  (SELECT count(*) FROM public.coaching_intakes WHERE lower(email) IN (SELECT email FROM _test_emails))
    + (SELECT count(*) FROM public.academy_invites WHERE lower(email) IN (SELECT email FROM _test_emails))
    + (SELECT count(*) FROM public.academy_inquiries WHERE lower(email) IN (SELECT email FROM _test_emails)) AS test_enrollment_rows_left,
  (SELECT count(*) FROM public.collective_applications WHERE lower(email) IN (SELECT email FROM _test_emails))
    + (SELECT count(*) FROM public.vendor_applications WHERE lower(email) IN (SELECT email FROM _test_emails))
    + (SELECT count(*) FROM public.crm_contacts WHERE lower(email) IN (SELECT email FROM _test_emails)) AS test_form_rows_left,
  (SELECT count(*) FROM public.products WHERE name = 'Rose Balsam') AS sample_products_left;
