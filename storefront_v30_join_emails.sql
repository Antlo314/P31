/* ============================================================
   P31 — v30: send each Join application to the team inbox and the P31 Google Sheet
   Run after v29. Safe to run more than once.

   The join-notify Edge Function hands every new "Join P31 Collective"
   application to the team exactly once:
     notified_at      the email to members@ (and founder@ while testing) went out
     sheet_synced_at  the row was added to the P31 Google Sheet
   Applications already in the list are marked as done, so only new
   ones are sent. (Older ones can be copied over from the CSV export in
   Systems, Applications.)
   ============================================================ */

ALTER TABLE public.collective_applications ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;
ALTER TABLE public.collective_applications ADD COLUMN IF NOT EXISTS sheet_synced_at TIMESTAMPTZ;

UPDATE public.collective_applications SET notified_at = created_at WHERE notified_at IS NULL;
UPDATE public.collective_applications SET sheet_synced_at = created_at WHERE sheet_synced_at IS NULL;

CREATE INDEX IF NOT EXISTS collective_applications_unnotified_idx
  ON public.collective_applications (created_at) WHERE notified_at IS NULL;
CREATE INDEX IF NOT EXISTS collective_applications_unsynced_idx
  ON public.collective_applications (created_at) WHERE sheet_synced_at IS NULL;
