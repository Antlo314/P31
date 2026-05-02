/* ==========================================================
   P31 MARKETPLACE — V11 SAFETY & ANNOUNCEMENTS
   ========================================================== */

-- 1. Global Announcements Table (Missing from previous versions)
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- info, urgent
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Leads Table (Missing from previous versions)
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. RLS for Announcements
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active announcements" 
ON announcements FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage announcements" 
ON announcements FOR ALL 
TO authenticated 
USING (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND email IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
));

CREATE POLICY "Anyone can insert leads" 
ON leads FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view leads" 
ON leads FOR SELECT 
TO authenticated 
USING (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND email IN ('info@lumenlabsatl.com', 'proverbs31markets@gmail.com')
));
