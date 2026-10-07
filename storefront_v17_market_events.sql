/* ==========================================================
   P31 MARKETPLACE — V17: MARKET DATES FROM THE DATABASE
   The homepage, Calendar page and curator dashboard now read
   their dates from market_events and only show events dated
   today or later, so past markets drop off on their own.

   To add or change a market: Supabase → Table Editor →
   market_events. Leave venue/address empty to show
   "Venue to be announced".

   Run this in the Supabase SQL Editor (after v16). Safe to
   re-run.
   ========================================================== */

ALTER TABLE market_events
ADD COLUMN IF NOT EXISTS start_time TEXT,   -- e.g. '3:30 PM'
ADD COLUMN IF NOT EXISTS venue TEXT,        -- e.g. 'Embassy Suites'
ADD COLUMN IF NOT EXISTS address TEXT,      -- e.g. '2029 Satellite Blvd, Duluth, GA 30097'
ADD COLUMN IF NOT EXISTS rsvp_url TEXT;     -- optional ticket / RSVP link

-- Upcoming markets, as listed on the site before this change.
-- Venue is left blank because none has been announced yet.
INSERT INTO market_events (title, event_date, start_time, description, is_active)
SELECT v.title, v.event_date, v.start_time, v.description, TRUE
FROM (VALUES
  ('Winter Gala',    DATE '2026-12-27', '3:30 PM', 'The P31 Collective''s winter gathering.'),
  ('Spring Renewal', DATE '2027-03-28', '3:30 PM', 'The P31 Collective''s spring gathering.')
) AS v(title, event_date, start_time, description)
WHERE NOT EXISTS (
  SELECT 1 FROM market_events e
  WHERE e.title = v.title AND e.event_date = v.event_date
);
