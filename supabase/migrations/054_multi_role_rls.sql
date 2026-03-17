-- 054: Multi-role routing & RLS for athlete access
-- US-14: Separate coach/athlete spaces with proper data isolation

-- 1a. Add athlete_id to user_profiles (links auth user to athlete record)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS athlete_id UUID REFERENCES athletes(id);

-- 1b. Helper function to avoid repeated subqueries in policies
CREATE OR REPLACE FUNCTION public.get_my_athlete_id() RETURNS UUID AS $$
  SELECT athlete_id FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1c. RLS policies for athletes (SELECT only)

-- activities: athlete can read own activities
CREATE POLICY athlete_read_own_activities ON activities
  FOR SELECT
  TO authenticated
  USING (
    athlete_id = public.get_my_athlete_id()
  );

-- activity_intervals: athlete can read intervals of own activities
CREATE POLICY athlete_read_own_intervals ON activity_intervals
  FOR SELECT
  TO authenticated
  USING (
    activity_id IN (
      SELECT id FROM activities WHERE athlete_id = public.get_my_athlete_id()
    )
  );

-- athletes: athlete can read own profile
CREATE POLICY athlete_read_own_profile ON athletes
  FOR SELECT
  TO authenticated
  USING (
    id = public.get_my_athlete_id()
  );

-- daily_readiness: athlete can read own readiness
CREATE POLICY athlete_read_own_readiness ON daily_readiness
  FOR SELECT
  TO authenticated
  USING (
    athlete_id = public.get_my_athlete_id()
  );

-- physio_profiles: athlete can read own physio
CREATE POLICY athlete_read_own_physio ON physio_profiles
  FOR SELECT
  TO authenticated
  USING (
    athlete_id = public.get_my_athlete_id()
  );
