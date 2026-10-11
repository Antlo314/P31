/* ============================================================
   P31 — v39: The Gathering (community messaging)
   Run after v38. Safe to run more than once.

   One place where vendors, mentorship students and alumnae, mentors,
   the P31 team and the site overseers talk: channels by audience,
   direct messages, threads, replies, reactions, photos and videos,
   badges that match each person, and a Daily Word every morning with
   its own discussion.

   Who can see what
     everyone   vendors, students, mentors, team, overseers
     vendors    approved vendors + team
     students   mentorship students and alumnae + mentors + team
     team       team, mentors, overseers
     dm         the two people in the conversation
   Everything is written through chat_* functions (checks, rate limits);
   people read through row security, so live updates respect it too.
   Replaces the old curator community chat (its history is carried over).
   ============================================================ */

-- ──────────────────────────────────────────────────────────
-- 1. Tables
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,60}$'),
  name TEXT NOT NULL,
  topic TEXT,
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'scripture', 'announcements', 'dm')),
  audience TEXT NOT NULL DEFAULT 'everyone' CHECK (audience IN ('everyone', 'vendors', 'students', 'team', 'dm')),
  section TEXT NOT NULL DEFAULT 'gather' CHECK (section IN ('gather', 'market', 'academy', 'team', 'dm')),
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  dm_key TEXT UNIQUE,
  archived BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_channel_members (
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX IF NOT EXISTS chat_channel_members_user_idx ON public.chat_channel_members (user_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,     -- null for the Daily Word and system notes
  kind TEXT NOT NULL DEFAULT 'message' CHECK (kind IN ('message', 'scripture', 'system')),
  body TEXT CHECK (body IS NULL OR length(body) <= 4000),
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,                   -- [{ type: image|video, path, name, width, height, size }]
  reply_to UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  thread_root UUID REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  reply_count INTEGER NOT NULL DEFAULT 0,
  last_reply_at TIMESTAMPTZ,
  reactions JSONB NOT NULL DEFAULT '{}'::jsonb,                     -- { emoji: [user ids] }
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,                          -- Daily Word: { day, ref, text }
  pinned BOOLEAN NOT NULL DEFAULT false,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_channel_idx ON public.chat_messages (channel_id, created_at DESC) WHERE thread_root IS NULL;
CREATE INDEX IF NOT EXISTS chat_messages_thread_idx ON public.chat_messages (thread_root, created_at) WHERE thread_root IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_messages_author_idx ON public.chat_messages (author_id, created_at DESC);
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS public.chat_reads (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

-- A title an overseer gives someone (Founder & CEO, Marketing Strategist...), shown as their first badge.
CREATE TABLE IF NOT EXISTS public.chat_titles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 40),
  set_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_scriptures (
  id INTEGER PRIMARY KEY,
  ref TEXT NOT NULL,
  text TEXT NOT NULL
);

-- ──────────────────────────────────────────────────────────
-- 2. Who someone is (drives access and badges)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_roles(p_user UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  WITH u AS (SELECT id, lower(email) AS email, email_confirmed_at IS NOT NULL AS confirmed FROM auth.users WHERE id = p_user)
  SELECT jsonb_build_object(
    'admin', EXISTS (SELECT 1 FROM u JOIN site_admins a ON a.email = u.email WHERE u.confirmed OR a.added_by IS NULL),
    'team', EXISTS (SELECT 1 FROM system_operators WHERE user_id = p_user)
         OR EXISTS (SELECT 1 FROM studio_members WHERE user_id = p_user)
         OR EXISTS (SELECT 1 FROM u JOIN team_access t ON t.email = u.email WHERE u.confirmed AND cardinality(t.tools) > 0),
    'mentor', coalesce((SELECT jsonb_agg(DISTINCT p.slug) FROM academy_mentors m JOIN academy_programs p ON p.id = m.program_id WHERE m.user_id = p_user), '[]'::jsonb),
    'student', coalesce((SELECT jsonb_agg(jsonb_build_object('program', p.slug, 'alum', e.status = 'expired'))
                          FROM academy_enrollments e JOIN academy_programs p ON p.id = e.program_id
                         WHERE e.user_id = p_user AND e.status <> 'canceled'), '[]'::jsonb),
    'vendor', (SELECT jsonb_build_object('shop', c.business_name, 'slug', c.slug) FROM curator_data c WHERE c.id = p_user AND c.status = 'approved'),
    'title', (SELECT title FROM chat_titles WHERE user_id = p_user)
  );
$fn$;
REVOKE ALL ON FUNCTION public.chat_roles(UUID) FROM public, anon, authenticated;

-- The audiences the signed-in person belongs to (empty: not part of The Gathering).
CREATE OR REPLACE FUNCTION public.chat_audiences()
RETURNS TEXT[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE r JSONB; a TEXT[] := '{}';
BEGIN
  IF auth.uid() IS NULL THEN RETURN a; END IF;
  r := public.chat_roles(auth.uid());
  IF (r->>'admin')::boolean OR (r->>'team')::boolean OR jsonb_array_length(r->'mentor') > 0 THEN
    RETURN ARRAY['everyone', 'vendors', 'students', 'team'];
  END IF;
  IF jsonb_typeof(r->'vendor') = 'object' THEN a := a || ARRAY['everyone', 'vendors']; END IF;
  IF jsonb_array_length(r->'student') > 0 THEN a := a || ARRAY['everyone', 'students']; END IF;
  RETURN a;
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.chat_audiences() TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_is_member()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$ SELECT cardinality(public.chat_audiences()) > 0; $fn$;
GRANT EXECUTE ON FUNCTION public.chat_is_member() TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_can_moderate()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT auth.uid() IS NOT NULL AND ((public.chat_roles(auth.uid())->>'admin')::boolean OR (public.chat_roles(auth.uid())->>'team')::boolean);
$fn$;
GRANT EXECUTE ON FUNCTION public.chat_can_moderate() TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_readable_channels()
RETURNS SETOF UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE aud TEXT[] := public.chat_audiences();
BEGIN
  IF cardinality(aud) = 0 THEN RETURN; END IF;
  RETURN QUERY
    SELECT c.id FROM chat_channels c
     WHERE NOT c.archived
       AND ((c.kind <> 'dm' AND c.audience = ANY (aud))
         OR (c.kind = 'dm' AND EXISTS (SELECT 1 FROM chat_channel_members m WHERE m.channel_id = c.id AND m.user_id = auth.uid())));
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.chat_readable_channels() TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 3. Row security (reads); all writes go through the functions below
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read their channels" ON public.chat_channels;
CREATE POLICY "Members read their channels" ON public.chat_channels FOR SELECT TO authenticated
  USING (id IN (SELECT public.chat_readable_channels()));

ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read conversation members" ON public.chat_channel_members;
CREATE POLICY "Members read conversation members" ON public.chat_channel_members FOR SELECT TO authenticated
  USING (channel_id IN (SELECT public.chat_readable_channels()));

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read messages" ON public.chat_messages;
CREATE POLICY "Members read messages" ON public.chat_messages FOR SELECT TO authenticated
  USING (channel_id IN (SELECT public.chat_readable_channels()));

ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own read markers" ON public.chat_reads;
CREATE POLICY "Own read markers" ON public.chat_reads FOR SELECT TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.chat_titles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read titles" ON public.chat_titles;
CREATE POLICY "Members read titles" ON public.chat_titles FOR SELECT TO authenticated USING (public.chat_is_member());

ALTER TABLE public.chat_scriptures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read scriptures" ON public.chat_scriptures;
CREATE POLICY "Members read scriptures" ON public.chat_scriptures FOR SELECT TO authenticated USING (public.chat_is_member());

-- ──────────────────────────────────────────────────────────
-- 4. Writing
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_post(p_channel UUID, p_body TEXT, p_attachments JSONB DEFAULT '[]'::jsonb,
                                            p_reply_to UUID DEFAULT NULL, p_thread UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  c RECORD; root RECORD; a JSONB; v_row chat_messages;
  v_body TEXT := nullif(btrim(coalesce(p_body, '')), '');
  v_att JSONB := coalesce(p_attachments, '[]'::jsonb);
  v_reply UUID := p_reply_to;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  SELECT * INTO c FROM chat_channels WHERE id = p_channel AND id IN (SELECT public.chat_readable_channels());
  IF c.id IS NULL THEN RAISE EXCEPTION 'You cannot post in this channel.'; END IF;
  IF p_thread IS NULL AND c.kind IN ('announcements', 'scripture') AND NOT public.chat_can_moderate() THEN
    RAISE EXCEPTION 'Only the team posts here. Join the conversation by replying in a thread.';
  END IF;
  IF jsonb_typeof(v_att) <> 'array' OR jsonb_array_length(v_att) > 6 THEN RAISE EXCEPTION 'Up to 6 photos or videos per message.'; END IF;
  FOR a IN SELECT value FROM jsonb_array_elements(v_att) LOOP
    IF coalesce(a->>'type', '') NOT IN ('image', 'video') OR coalesce(a->>'path', '') !~ ('^' || auth.uid()::text || '/[A-Za-z0-9._-]{1,120}$') THEN
      RAISE EXCEPTION 'That attachment could not be added. Try uploading it again.';
    END IF;
  END LOOP;
  IF v_body IS NULL AND jsonb_array_length(v_att) = 0 THEN RAISE EXCEPTION 'Write a message or add a photo.'; END IF;
  IF length(v_body) > 4000 THEN RAISE EXCEPTION 'Messages can be up to 4,000 characters.'; END IF;
  IF (SELECT count(*) FROM chat_messages WHERE author_id = auth.uid() AND created_at > now() - interval '1 minute') >= 20 THEN
    RAISE EXCEPTION 'Slow down a little and try again in a minute.';
  END IF;
  IF p_thread IS NOT NULL THEN
    SELECT id, channel_id, thread_root, deleted_at INTO root FROM chat_messages WHERE id = p_thread;
    IF root.id IS NULL OR root.channel_id <> p_channel OR root.thread_root IS NOT NULL THEN RAISE EXCEPTION 'That conversation is not available.'; END IF;
  END IF;
  IF v_reply IS NOT NULL AND NOT EXISTS (SELECT 1 FROM chat_messages WHERE id = v_reply AND channel_id = p_channel) THEN v_reply := NULL; END IF;

  INSERT INTO chat_messages (channel_id, author_id, body, attachments, reply_to, thread_root)
  VALUES (p_channel, auth.uid(), v_body, v_att, v_reply, p_thread)
  RETURNING * INTO v_row;

  IF p_thread IS NOT NULL THEN
    UPDATE chat_messages SET reply_count = reply_count + 1, last_reply_at = now() WHERE id = p_thread;
  ELSE
    UPDATE chat_channels SET last_message_at = now() WHERE id = p_channel;
  END IF;
  INSERT INTO chat_reads (user_id, channel_id, last_read_at) VALUES (auth.uid(), p_channel, now())
  ON CONFLICT (user_id, channel_id) DO UPDATE SET last_read_at = now();
  RETURN to_jsonb(v_row);
END;
$fn$;
REVOKE ALL ON FUNCTION public.chat_post(UUID, TEXT, JSONB, UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_post(UUID, TEXT, JSONB, UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_edit(p_id UUID, p_body TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_row chat_messages; v_body TEXT := nullif(btrim(coalesce(p_body, '')), '');
BEGIN
  IF length(v_body) > 4000 THEN RAISE EXCEPTION 'Messages can be up to 4,000 characters.'; END IF;
  UPDATE chat_messages SET body = v_body, edited_at = now()
   WHERE id = p_id AND author_id = auth.uid() AND deleted_at IS NULL AND (v_body IS NOT NULL OR jsonb_array_length(attachments) > 0)
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'You can only edit your own messages.'; END IF;
  RETURN to_jsonb(v_row);
END;
$fn$;
REVOKE ALL ON FUNCTION public.chat_edit(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_edit(UUID, TEXT) TO authenticated;

-- Removes the words and media; the message stays as a quiet placeholder so replies still make sense.
CREATE OR REPLACE FUNCTION public.chat_delete(p_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_row chat_messages;
BEGIN
  UPDATE chat_messages SET body = NULL, attachments = '[]'::jsonb, reactions = '{}'::jsonb, pinned = false, deleted_at = now()
   WHERE id = p_id AND deleted_at IS NULL AND channel_id IN (SELECT public.chat_readable_channels())
     AND (author_id = auth.uid() OR public.chat_can_moderate())
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'You can only remove your own messages.'; END IF;
  RETURN to_jsonb(v_row);
END;
$fn$;
REVOKE ALL ON FUNCTION public.chat_delete(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_delete(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_pin(p_id UUID, p_on BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_row chat_messages;
BEGIN
  IF NOT public.chat_can_moderate() THEN RAISE EXCEPTION 'Only the team can pin messages.'; END IF;
  UPDATE chat_messages SET pinned = coalesce(p_on, false) WHERE id = p_id AND deleted_at IS NULL RETURNING * INTO v_row;
  RETURN to_jsonb(v_row);
END;
$fn$;
REVOKE ALL ON FUNCTION public.chat_pin(UUID, BOOLEAN) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_pin(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_react(p_id UUID, p_emoji TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE r JSONB; arr JSONB; me TEXT := auth.uid()::text;
BEGIN
  IF p_emoji NOT IN ('🙏🏾', '❤️', '🙌🏾', '🔥', '😂', '👏🏾', '✨', '💜', '😭', '💯') THEN RAISE EXCEPTION 'That reaction is not available.'; END IF;
  SELECT reactions INTO r FROM chat_messages
   WHERE id = p_id AND deleted_at IS NULL AND channel_id IN (SELECT public.chat_readable_channels()) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That message is not available.'; END IF;
  arr := coalesce(r->p_emoji, '[]'::jsonb);
  IF arr ? me THEN arr := arr - me; ELSE arr := arr || to_jsonb(me); END IF;
  IF jsonb_array_length(arr) = 0 THEN r := r - p_emoji; ELSE r := jsonb_set(r, ARRAY[p_emoji], arr); END IF;
  UPDATE chat_messages SET reactions = r WHERE id = p_id;
  RETURN r;
END;
$fn$;
REVOKE ALL ON FUNCTION public.chat_react(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_react(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_mark_read(p_channel UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $fn$
  INSERT INTO chat_reads (user_id, channel_id, last_read_at)
  SELECT auth.uid(), p_channel, now() WHERE p_channel IN (SELECT public.chat_readable_channels())
  ON CONFLICT (user_id, channel_id) DO UPDATE SET last_read_at = now();
$fn$;
REVOKE ALL ON FUNCTION public.chat_mark_read(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_mark_read(UUID) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 5. Reading helpers: my channels, people and their badges, direct messages
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_my_channels()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'name', c.name, 'topic', c.topic, 'kind', c.kind, 'audience', c.audience,
      'section', c.section, 'icon', c.icon, 'sort_order', c.sort_order, 'last_message_at', c.last_message_at,
      'other_user', CASE WHEN c.kind = 'dm' THEN (SELECT m.user_id FROM chat_channel_members m WHERE m.channel_id = c.id AND m.user_id <> auth.uid() LIMIT 1) END,
      'unread', (SELECT count(*) FROM chat_messages x
                  WHERE x.channel_id = c.id AND x.thread_root IS NULL AND x.deleted_at IS NULL
                    AND x.author_id IS DISTINCT FROM auth.uid()
                    AND x.created_at > coalesce((SELECT last_read_at FROM chat_reads r WHERE r.user_id = auth.uid() AND r.channel_id = c.id), now() - interval '3 days'))
    ) ORDER BY c.sort_order, c.last_message_at DESC NULLS LAST), '[]'::jsonb)
  FROM chat_channels c
  WHERE c.id IN (SELECT public.chat_readable_channels());
$fn$;
REVOKE ALL ON FUNCTION public.chat_my_channels() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_my_channels() TO authenticated;

-- Everyone who belongs to The Gathering.
CREATE OR REPLACE FUNCTION public.chat_member_ids()
RETURNS SETOF UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT u.id FROM auth.users u JOIN site_admins a ON a.email = lower(u.email) WHERE u.email_confirmed_at IS NOT NULL OR a.added_by IS NULL
  UNION SELECT user_id FROM system_operators
  UNION SELECT user_id FROM studio_members
  UNION SELECT u.id FROM auth.users u JOIN team_access t ON t.email = lower(u.email) WHERE u.email_confirmed_at IS NOT NULL AND cardinality(t.tools) > 0
  UNION SELECT user_id FROM academy_mentors
  UNION SELECT user_id FROM academy_enrollments WHERE status <> 'canceled'
  UNION SELECT id FROM curator_data WHERE status = 'approved';
$fn$;
REVOKE ALL ON FUNCTION public.chat_member_ids() FROM public, anon, authenticated;

-- Names, pictures and roles for a set of people (members only; never emails).
CREATE OR REPLACE FUNCTION public.chat_people(p_ids UUID[] DEFAULT NULL)
RETURNS TABLE (id UUID, name TEXT, avatar_url TEXT, roles JSONB)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth
AS $fn$
  SELECT u.id,
         coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(c.business_name), ''), 'P31 member'),
         coalesce(p.avatar_url, c.logo_url),
         public.chat_roles(u.id)
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    LEFT JOIN curator_data c ON c.id = u.id
   WHERE public.chat_is_member()
     AND (CASE WHEN p_ids IS NULL THEN u.id IN (SELECT public.chat_member_ids()) ELSE u.id = ANY (p_ids) END)
   LIMIT 2000;
$fn$;
REVOKE ALL ON FUNCTION public.chat_people(UUID[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_people(UUID[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.chat_me()
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT jsonb_build_object('id', auth.uid(), 'member', public.chat_is_member(), 'moderator', public.chat_can_moderate(),
                            'overseer', public.is_admin(), 'audiences', to_jsonb(public.chat_audiences()),
                            'roles', CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.chat_roles(auth.uid()) END);
$fn$;
REVOKE ALL ON FUNCTION public.chat_me() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_me() TO authenticated;

-- Open (or find) a private conversation with another member.
CREATE OR REPLACE FUNCTION public.chat_open_dm(p_user UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE v_key TEXT; v_slug TEXT; v_id UUID;
BEGIN
  IF NOT public.chat_is_member() THEN RAISE EXCEPTION 'The Gathering is for P31 vendors, students and the team.'; END IF;
  IF p_user IS NULL OR p_user = auth.uid() THEN RAISE EXCEPTION 'Pick someone to message.'; END IF;
  IF p_user NOT IN (SELECT public.chat_member_ids()) THEN RAISE EXCEPTION 'That person is not part of The Gathering yet.'; END IF;
  v_key := least(auth.uid()::text, p_user::text) || ':' || greatest(auth.uid()::text, p_user::text);
  SELECT id, slug INTO v_id, v_slug FROM chat_channels WHERE dm_key = v_key;
  IF v_id IS NULL THEN
    v_slug := 'dm-' || substr(md5(v_key), 1, 12);
    INSERT INTO chat_channels (slug, name, kind, audience, section, dm_key, created_by)
    VALUES (v_slug, 'Direct message', 'dm', 'dm', 'dm', v_key, auth.uid())
    ON CONFLICT (dm_key) DO UPDATE SET archived = false
    RETURNING id, slug INTO v_id, v_slug;
    INSERT INTO chat_channel_members (channel_id, user_id) VALUES (v_id, auth.uid()), (v_id, p_user) ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_slug;
END;
$fn$;
REVOKE ALL ON FUNCTION public.chat_open_dm(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_open_dm(UUID) TO authenticated;

-- Overseers give someone a title (empty clears it).
CREATE OR REPLACE FUNCTION public.chat_set_title(p_user UUID, p_title TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only overseers can set titles.'; END IF;
  IF nullif(btrim(coalesce(p_title, '')), '') IS NULL THEN DELETE FROM chat_titles WHERE user_id = p_user; RETURN; END IF;
  INSERT INTO chat_titles (user_id, title, set_by) VALUES (p_user, left(btrim(p_title), 40), auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET title = EXCLUDED.title, set_by = EXCLUDED.set_by, created_at = now();
END;
$fn$;
REVOKE ALL ON FUNCTION public.chat_set_title(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_set_title(UUID, TEXT) TO authenticated;

-- ──────────────────────────────────────────────────────────
-- 6. Channels
-- ──────────────────────────────────────────────────────────
INSERT INTO public.chat_channels (slug, name, topic, kind, audience, section, icon, sort_order) VALUES
  ('welcome', 'Welcome', 'Start here: what The Gathering is for, and how we treat one another.', 'announcements', 'everyone', 'gather', 'sparkles', 1),
  ('daily-word', 'Daily Word', 'A new verse every morning. Share what it speaks to you in the discussion beneath it.', 'scripture', 'everyone', 'gather', 'book', 2),
  ('the-gathering', 'The Gathering', 'Talk with the whole P31 family: vendors, students, mentors and the team.', 'text', 'everyone', 'gather', 'hash', 3),
  ('prayer', 'Prayer requests', 'Share what you are carrying. We stand with you in prayer.', 'text', 'everyone', 'gather', 'heart', 4),
  ('wins', 'Wins & celebrations', 'Launches, sales, milestones, answered prayers. Celebrate out loud.', 'text', 'everyone', 'gather', 'party', 5),
  ('market', 'Market talk', 'For P31 vendors and the team: tips, questions and collaborations.', 'text', 'vendors', 'market', 'store', 10),
  ('market-day', 'Market day', 'Load-in, booths, what to bring, and the day itself.', 'text', 'vendors', 'market', 'calendar', 11),
  ('academy', 'Academy lounge', 'For mentorship students, alumnae and mentors: questions, wins and accountability.', 'text', 'students', 'academy', 'graduation', 20),
  ('team', 'Team room', 'The P31 team, mentors and overseers only.', 'text', 'team', 'team', 'shield', 30)
ON CONFLICT (slug) DO NOTHING;

-- The welcome note, once.
INSERT INTO public.chat_messages (channel_id, kind, body, pinned)
SELECT c.id, 'system',
  'Welcome to The Gathering, the home of the P31 family online.' || chr(10) || chr(10) ||
  'Vendors, mentorship students, mentors and the P31 team all meet here. A few ways we walk together:' || chr(10) ||
  '• Speak life. She openeth her mouth with wisdom; and in her tongue is the law of kindness (Proverbs 31:26).' || chr(10) ||
  '• Celebrate one another. Share your wins in Wins & celebrations, and your shop and products in Market talk.' || chr(10) ||
  '• Hold what is shared in Prayer requests with care. It stays here.' || chr(10) ||
  '• Each morning a new verse appears in Daily Word. Reply in its discussion to share what it speaks to you.' || chr(10) ||
  '• Need the team? Use Team room if you are on the team, or send any team member a direct message.',
  true
  FROM public.chat_channels c
 WHERE c.slug = 'welcome' AND NOT EXISTS (SELECT 1 FROM public.chat_messages m WHERE m.channel_id = c.id AND m.kind = 'system');

-- Titles for the team mailboxes, where an account already uses them.
INSERT INTO public.chat_titles (user_id, title)
SELECT u.id, t.title FROM auth.users u
  JOIN (VALUES ('founder@thep31collective.org', 'Founder & CEO'), ('ceo@p31market.com', 'Founder & CEO'),
               ('secretary@thep31collective.org', 'Executive Assistant'), ('marketing@p31market.com', 'Marketing Strategist'),
               ('members@thep31collective.org', 'Member Liaison'), ('coordinator@thep31collective.org', 'Support Coordinator'),
               ('vendor@p31market.com', 'Marketplace Tech Support')) AS t(email, title) ON t.email = lower(u.email)
ON CONFLICT (user_id) DO NOTHING;

-- ──────────────────────────────────────────────────────────
-- 7. The old curator chat comes along
-- ──────────────────────────────────────────────────────────
DO $mig$
DECLARE has_rcpt BOOLEAN;
BEGIN
  IF to_regclass('public.messages') IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.chat_messages WHERE meta ? 'legacy_id') THEN RETURN; END IF;
  has_rcpt := EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'recipient_id');

  IF has_rcpt THEN
    INSERT INTO public.chat_messages (channel_id, author_id, body, created_at, meta)
    SELECT c.id, m.profile_id, left(m.text, 4000), coalesce(m.created_at, now()), jsonb_build_object('legacy_id', m.id)
      FROM public.messages m
      JOIN public.chat_channels c ON c.slug = CASE m.channel_id WHEN 'general' THEN 'the-gathering' WHEN 'market-logistics' THEN 'market-day' WHEN 'wellness' THEN 'prayer' END
     WHERE m.recipient_id IS NULL AND nullif(btrim(m.text), '') IS NOT NULL;

    -- Private messages become direct-message conversations.
    INSERT INTO public.chat_channels (slug, name, kind, audience, section, dm_key)
    SELECT DISTINCT 'dm-' || substr(md5(k), 1, 12), 'Direct message', 'dm', 'dm', 'dm', k
      FROM (SELECT least(profile_id::text, recipient_id::text) || ':' || greatest(profile_id::text, recipient_id::text) AS k
              FROM public.messages WHERE recipient_id IS NOT NULL AND profile_id IS NOT NULL AND recipient_id <> profile_id) s
    ON CONFLICT (dm_key) DO NOTHING;
    INSERT INTO public.chat_channel_members (channel_id, user_id)
    SELECT c.id, x.uid FROM public.chat_channels c
      CROSS JOIN LATERAL (VALUES (split_part(c.dm_key, ':', 1)::uuid), (split_part(c.dm_key, ':', 2)::uuid)) AS x(uid)
     WHERE c.kind = 'dm' AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = x.uid)
    ON CONFLICT DO NOTHING;
    INSERT INTO public.chat_messages (channel_id, author_id, body, created_at, meta)
    SELECT c.id, m.profile_id, left(m.text, 4000), coalesce(m.created_at, now()), jsonb_build_object('legacy_id', m.id)
      FROM public.messages m
      JOIN public.chat_channels c ON c.dm_key = least(m.profile_id::text, m.recipient_id::text) || ':' || greatest(m.profile_id::text, m.recipient_id::text)
     WHERE m.recipient_id IS NOT NULL AND m.profile_id IS NOT NULL AND nullif(btrim(m.text), '') IS NOT NULL;
  ELSE
    INSERT INTO public.chat_messages (channel_id, author_id, body, created_at, meta)
    SELECT c.id, m.profile_id, left(m.text, 4000), coalesce(m.created_at, now()), jsonb_build_object('legacy_id', m.id)
      FROM public.messages m
      JOIN public.chat_channels c ON c.slug = CASE m.channel_id WHEN 'general' THEN 'the-gathering' WHEN 'market-logistics' THEN 'market-day' WHEN 'wellness' THEN 'prayer' END
     WHERE nullif(btrim(m.text), '') IS NOT NULL;
  END IF;

  UPDATE public.chat_channels c SET last_message_at = (SELECT max(created_at) FROM public.chat_messages WHERE channel_id = c.id AND thread_root IS NULL);
END;
$mig$;

-- ──────────────────────────────────────────────────────────
-- 8. Photos and videos (private: only members can see them)
-- ──────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat', 'chat', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Members see Gathering media" ON storage.objects;
CREATE POLICY "Members see Gathering media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat' AND public.chat_is_member());
DROP POLICY IF EXISTS "Members upload their own Gathering media" ON storage.objects;
CREATE POLICY "Members upload their own Gathering media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat' AND (storage.foldername(name))[1] = auth.uid()::text AND public.chat_is_member());
DROP POLICY IF EXISTS "Members remove their own Gathering media" ON storage.objects;
CREATE POLICY "Members remove their own Gathering media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ──────────────────────────────────────────────────────────
-- 9. Live updates (new messages, edits, reactions, unread dots)
-- ──────────────────────────────────────────────────────────
DO $rt$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_channels') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;
    END IF;
  END IF;
END;
$rt$;

-- ──────────────────────────────────────────────────────────
-- 10. The Daily Word
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chat_post_daily_word()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_day DATE := (now() AT TIME ZONE 'America/New_York')::date;
  v_n INTEGER; v_ch UUID; v_id UUID; s RECORD;
  v_prompts TEXT[] := ARRAY[
    'What is this word speaking to you today?',
    'How could you live this out in your business or your home this week?',
    'Who needs to hear this today? Share it with her.',
    'Share a moment when God proved this true in your life.',
    'Which word or phrase stands out to you, and why?',
    'Turn it into a one-line prayer and leave it below.'];
BEGIN
  SELECT id INTO v_ch FROM chat_channels WHERE slug = 'daily-word';
  SELECT count(*) INTO v_n FROM chat_scriptures;
  IF v_ch IS NULL OR v_n = 0 THEN RETURN NULL; END IF;
  SELECT id INTO v_id FROM chat_messages WHERE channel_id = v_ch AND kind = 'scripture' AND meta->>'day' = v_day::text;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT * INTO s FROM chat_scriptures WHERE id = ((v_day - DATE '2026-01-01') % v_n) + 1;
  INSERT INTO chat_messages (channel_id, kind, body, meta)
  VALUES (v_ch, 'scripture', v_prompts[((v_day - DATE '2026-01-01') % array_length(v_prompts, 1)) + 1],
          jsonb_build_object('day', v_day, 'ref', s.ref, 'text', s.text))
  RETURNING id INTO v_id;
  UPDATE chat_channels SET last_message_at = now() WHERE id = v_ch;
  RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.chat_post_daily_word() FROM public, anon, authenticated;

-- Verses: the same KJV wording the Content Studio uses.
INSERT INTO public.chat_scriptures (id, ref, text) VALUES
  (1, 'Proverbs 31:10', 'Who can find a virtuous woman? for her price is far above rubies.'),
  (2, 'Proverbs 31:13', 'She seeketh wool, and flax, and worketh willingly with her hands.'),
  (3, 'Proverbs 31:16', 'She considereth a field, and buyeth it: with the fruit of her hands she planteth a vineyard.'),
  (4, 'Proverbs 31:17', 'She girdeth her loins with strength, and strengtheneth her arms.'),
  (5, 'Proverbs 31:18', 'She perceiveth that her merchandise is good: her candle goeth not out by night.'),
  (6, 'Proverbs 31:20', 'She stretcheth out her hand to the poor; yea, she reacheth forth her hands to the needy.'),
  (7, 'Proverbs 31:21', 'She is not afraid of the snow for her household: for all her household are clothed with scarlet.'),
  (8, 'Proverbs 31:24', 'She maketh fine linen, and selleth it; and delivereth girdles unto the merchant.'),
  (9, 'Proverbs 31:25', 'Strength and honour are her clothing; and she shall rejoice in time to come.'),
  (10, 'Proverbs 31:26', 'She openeth her mouth with wisdom; and in her tongue is the law of kindness.'),
  (11, 'Proverbs 31:27', 'She looketh well to the ways of her household, and eateth not the bread of idleness.'),
  (12, 'Proverbs 31:28', 'Her children arise up, and call her blessed; her husband also, and he praiseth her.'),
  (13, 'Proverbs 31:29', 'Many daughters have done virtuously, but thou excellest them all.'),
  (14, 'Proverbs 31:30', 'Favour is deceitful, and beauty is vain: but a woman that feareth the LORD, she shall be praised.'),
  (15, 'Proverbs 31:31', 'Give her of the fruit of her hands; and let her own works praise her in the gates.'),
  (16, 'Proverbs 3:5', 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.'),
  (17, 'Proverbs 16:3', 'Commit thy works unto the LORD, and thy thoughts shall be established.'),
  (18, 'Proverbs 18:16', 'A man’s gift maketh room for him, and bringeth him before great men.'),
  (19, 'Proverbs 19:21', 'There are many devices in a man’s heart; nevertheless the counsel of the LORD, that shall stand.'),
  (20, 'Proverbs 22:29', 'Seest thou a man diligent in his business? he shall stand before kings; he shall not stand before mean men.'),
  (21, 'Proverbs 27:17', 'Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.'),
  (22, 'Psalm 23:1', 'The LORD is my shepherd; I shall not want.'),
  (23, 'Psalm 37:4', 'Delight thyself also in the LORD; and he shall give thee the desires of thine heart.'),
  (24, 'Psalm 46:5', 'God is in the midst of her; she shall not be moved: God shall help her, and that right early.'),
  (25, 'Psalm 90:17', 'And let the beauty of the LORD our God be upon us: and establish thou the work of our hands upon us; yea, the work of our hands establish thou it.'),
  (26, 'Ecclesiastes 9:10', 'Whatsoever thy hand findeth to do, do it with thy might…'),
  (27, 'Isaiah 40:31', 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.'),
  (28, 'Jeremiah 29:11', 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.'),
  (29, 'Lamentations 3:23', 'They are new every morning: great is thy faithfulness.'),
  (30, 'Esther 4:14', 'And who knoweth whether thou art come to the kingdom for such a time as this?'),
  (31, 'Ruth 1:16', 'Whither thou goest, I will go; and where thou lodgest, I will lodge: thy people shall be my people, and thy God my God.'),
  (32, 'Deuteronomy 8:18', 'But thou shalt remember the LORD thy God: for it is he that giveth thee power to get wealth…'),
  (33, 'Joshua 1:9', 'Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.'),
  (34, 'Matthew 5:16', 'Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.'),
  (35, 'Luke 1:45', 'And blessed is she that believed: for there shall be a performance of those things which were told her from the Lord.'),
  (36, 'Galatians 6:9', 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.'),
  (37, 'Philippians 1:6', 'Being confident of this very thing, that he which hath begun a good work in you will perform it until the day of Jesus Christ.'),
  (38, 'Philippians 4:13', 'I can do all things through Christ which strengtheneth me.'),
  (39, 'Colossians 3:23', 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men.'),
  (40, '2 Timothy 1:7', 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.'),
  (41, 'Hebrews 11:1', 'Now faith is the substance of things hoped for, the evidence of things not seen.'),
  (42, '1 Corinthians 15:58', 'Forasmuch as ye know that your labour is not in vain in the Lord.'),
  (43, 'Proverbs 3:5–6', 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.'),
  (44, 'Lamentations 3:22–23', 'It is of the LORD’s mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.'),
  (45, '2 Corinthians 12:9', 'My grace is sufficient for thee: for my strength is made perfect in weakness.'),
  (46, 'Romans 8:28', 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.'),
  (47, 'Matthew 11:28', 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.'),
  (48, 'Psalm 37:5', 'Commit thy way unto the LORD; trust also in him; and he shall bring it to pass.'),
  (49, 'Psalm 121:1–2', 'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth.')
ON CONFLICT (id) DO UPDATE SET ref = EXCLUDED.ref, text = EXCLUDED.text;

-- The scheduler has to be on (v38 turns it on; repeating this is harmless).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- 11:30 UTC every day (7:30 AM Eastern in summer, 6:30 AM in winter), and once now for today.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'p31-daily-word';
SELECT cron.schedule('p31-daily-word', '30 11 * * *', $job$ SELECT public.chat_post_daily_word(); $job$);
SELECT public.chat_post_daily_word();

-- ──────────────────────────────────────────────────────────
-- 11. The Gathering lives at /gather, so no shop can take that link
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.curator_data DROP CONSTRAINT IF EXISTS slug_not_reserved;
ALTER TABLE public.curator_data ADD CONSTRAINT slug_not_reserved CHECK (
  slug NOT IN ('about', 'directory', 'login', 'dashboard', 'visionary', 'apply', 'community', 'register', 'onboarding-exclusive',
    'shop', 'calendar', 'services', 'partner', 'favorites', 'unsubscribe', 'systems', 'mentorship', 'portal', 'enroll', 'academy',
    'studio', 'verify', 'join', 'today', 'vendors', 'volunteer', 'assets', 'icons', 'fonts', 'c', 'gather')
) NOT VALID;
