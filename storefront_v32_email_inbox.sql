/* ============================================================
   P31 — v32: the shared email inbox (Carla drafts, the team sends)
   Run after v31. Safe to run more than once.

   Email sent to members@thep31collective.org and vendor@p31market.com
   is forwarded (a copy) to a private Resend address. The email-inbound
   function files each one into a conversation here and Carla writes a
   draft reply. Yanni and the admins (Content Studio, Email) read it,
   edit if needed and press Send; email-send sends it from the right
   inbox, in the same thread. Nothing is ever sent without a person.

   Only Content Studio people (admins, Studio seats and anyone given
   the Content Studio tool) can read or change these. New rows come in
   only through the Edge Functions.
   ============================================================ */

CREATE TABLE IF NOT EXISTS public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox TEXT NOT NULL CHECK (mailbox IN ('collective', 'market')),
  subject TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'needs_reply' CHECK (status IN ('needs_reply', 'sent', 'ignored')),
  category TEXT,
  summary TEXT,
  needs_human BOOLEAN NOT NULL DEFAULT false,
  human_reason TEXT,
  draft TEXT,
  draft_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_from_contact BOOLEAN NOT NULL DEFAULT true,
  handled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_threads_status_idx ON public.email_threads (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS email_threads_contact_idx ON public.email_threads (mailbox, lower(contact_email), last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  resend_id TEXT UNIQUE,
  message_id TEXT,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT NOT NULL DEFAULT '',
  body_text TEXT NOT NULL DEFAULT '',
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_messages_thread_idx ON public.email_messages (thread_id, created_at);
CREATE INDEX IF NOT EXISTS email_messages_msgid_idx ON public.email_messages (message_id);

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Studio reads email" ON public.email_threads;
CREATE POLICY "Studio reads email" ON public.email_threads FOR SELECT TO authenticated
  USING (public.is_studio_member());
DROP POLICY IF EXISTS "Studio updates email" ON public.email_threads;
CREATE POLICY "Studio updates email" ON public.email_threads FOR UPDATE TO authenticated
  USING (public.is_studio_member()) WITH CHECK (public.is_studio_member());
DROP POLICY IF EXISTS "Studio reads email messages" ON public.email_messages;
CREATE POLICY "Studio reads email messages" ON public.email_messages FOR SELECT TO authenticated
  USING (public.is_studio_member());

DROP TRIGGER IF EXISTS touch_email_threads ON public.email_threads;
CREATE TRIGGER touch_email_threads BEFORE UPDATE ON public.email_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
