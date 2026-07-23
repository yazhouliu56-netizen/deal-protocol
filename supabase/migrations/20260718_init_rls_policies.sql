-- RLS Policies — Production Lockdown
-- Apply in Supabase SQL Editor after verifying no active conflicts

---------------------------------------
-- 1. demands table
---------------------------------------
ALTER TABLE demands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client view own demands" ON demands;
DROP POLICY IF EXISTS "Client view own demands" ON demands;
CREATE POLICY "Client view own demands" ON demands
  FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Provider view assigned demands" ON demands;
DROP POLICY IF EXISTS "Provider view assigned demands" ON demands;
CREATE POLICY "Provider view assigned demands" ON demands
  FOR SELECT USING (auth.uid() = provider_id);

DROP POLICY IF EXISTS "Provider update assigned demands" ON demands;
DROP POLICY IF EXISTS "Provider update assigned demands" ON demands;
CREATE POLICY "Provider update assigned demands" ON demands
  FOR UPDATE USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Admin full access demands" ON demands;
DROP POLICY IF EXISTS "Admin full access demands" ON demands;
CREATE POLICY "Admin full access demands" ON demands
  FOR ALL USING (
    auth.jwt() ->> 'email' LIKE '%@admin.com'
  );

---------------------------------------
-- 2. profiles table
---------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Anyone read public profile" ON profiles;
DROP POLICY IF EXISTS "Anyone read public profile" ON profiles;
CREATE POLICY "Anyone read public profile" ON profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
CREATE POLICY "Admin full access profiles" ON profiles
  FOR ALL USING (
    auth.jwt() ->> 'email' LIKE '%@admin.com'
  );

---------------------------------------
-- 3. notifications table (after 015)
---------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users view own notifications" ON notifications;
CREATE POLICY "Users view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin full access notifications" ON notifications;
DROP POLICY IF EXISTS "Admin full access notifications" ON notifications;
CREATE POLICY "Admin full access notifications" ON notifications
  FOR ALL USING (
    auth.jwt() ->> 'email' LIKE '%@admin.com'
  );

---------------------------------------
-- 6. Enable Realtime on demands
---------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'demands'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE demands;
  END IF;
END $$;
