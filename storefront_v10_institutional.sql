/* ==========================================================
   P31 MARKETPLACE — V10 INSTITUTIONAL OPERATIONS
   ========================================================== */

-- 1. Event RSVPs Table
CREATE TABLE IF NOT EXISTS market_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  location TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES market_events(id) ON DELETE CASCADE,
  curator_id UUID REFERENCES curator_data(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'confirmed', -- confirmed, cancelled, waitlist
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, curator_id)
);

-- 2. Weekly Analytics Snapshots
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  curator_id UUID REFERENCES curator_data(id) ON DELETE CASCADE,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  views_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. RLS for RSVPs
ALTER TABLE market_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public events are viewable by all" 
ON market_events FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Curators can manage their own RSVPs" 
ON event_rsvps FOR ALL 
TO authenticated 
USING (curator_id = auth.uid())
WITH CHECK (curator_id = auth.uid());

CREATE POLICY "Curators can view their own analytics" 
ON analytics_snapshots FOR SELECT 
TO authenticated 
USING (curator_id = auth.uid());

CREATE POLICY "Admins can manage all institutional data" 
ON market_events FOR ALL 
TO authenticated 
USING (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND email IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
));

CREATE POLICY "Admins can manage all analytics" 
ON analytics_snapshots FOR ALL 
TO authenticated 
USING (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND email IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
));

-- 4. Initial Seed for upcoming June Market
INSERT INTO market_events (title, event_date, location, description)
VALUES ('June Solstice Artisan Market', '2026-06-21', 'The Sanctuary Grounds', 'The flagship seasonal gathering of the P31 Collective.')
ON CONFLICT DO NOTHING;
