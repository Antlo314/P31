-- ============================================================
-- Storefront v35: approving a vendor application unlocks her studio
--   When an application in Systems is set to Approved, the email is added to
--   vendor_approvals automatically, so she can register at p31market.com/register
--   and her studio opens on sign-up (no second step in Vendor Approvals).
--   If she already made an account before being approved, it opens right away.
--   Moving an approved application to Declined or Waitlist removes the
--   pre-approval again, unless she has already registered.
-- Run after v34 in the Supabase SQL editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_vendor_preapproval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT := lower(trim(NEW.email));
  v_name TEXT := trim(COALESCE(NEW.full_name, ''));
  v_first TEXT := split_part(v_name, ' ', 1);
  v_last TEXT := NULLIF(trim(substr(v_name, length(split_part(v_name, ' ', 1)) + 1)), '');
BEGIN
  IF v_email = '' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO vendor_approvals (first_name, last_name, email, approved_by)
    VALUES (v_first, v_last, v_email, NEW.reviewed_by)
    ON CONFLICT (email) DO NOTHING;

    -- Already registered before the approval: open the studio now.
    PERFORM set_config('p31.trusted', 'on', true);
    UPDATE curator_data c
       SET status = 'approved', is_paid = TRUE, is_published = TRUE
      FROM auth.users u
     WHERE u.id = c.id
       AND lower(u.email) = v_email
       AND (c.status IS DISTINCT FROM 'approved' OR c.is_paid IS DISTINCT FROM TRUE);

  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'approved' AND NEW.status IN ('declined', 'waitlist') THEN
    DELETE FROM vendor_approvals va
     WHERE lower(va.email) = v_email
       AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_vendor_preapproval ON vendor_applications;
CREATE TRIGGER sync_vendor_preapproval
AFTER INSERT OR UPDATE OF status ON vendor_applications
FOR EACH ROW EXECUTE FUNCTION public.sync_vendor_preapproval();

-- Catch up: applications already marked approved before this trigger existed.
INSERT INTO vendor_approvals (first_name, last_name, email, approved_by)
SELECT split_part(trim(full_name), ' ', 1),
       NULLIF(trim(substr(trim(full_name), length(split_part(trim(full_name), ' ', 1)) + 1)), ''),
       lower(trim(email)),
       reviewed_by
  FROM vendor_applications
 WHERE status = 'approved'
ON CONFLICT (email) DO NOTHING;
