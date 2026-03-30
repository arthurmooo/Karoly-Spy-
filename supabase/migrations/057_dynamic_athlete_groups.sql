-- 057: Dynamic athlete groups
-- Replace hardcoded athlete_group TEXT column with a dedicated table + FK

-- 1. Create athlete_groups table
CREATE TABLE IF NOT EXISTS athlete_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748B',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coach_id, name)
);

-- 2. RLS on athlete_groups
ALTER TABLE athlete_groups ENABLE ROW LEVEL SECURITY;

-- Coach: full CRUD on own groups
CREATE POLICY "coach_manage_own_groups"
ON athlete_groups
FOR ALL
TO authenticated
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());

-- Athlete: read groups belonging to their coach
CREATE POLICY "athlete_read_coach_groups"
ON athlete_groups
FOR SELECT
TO authenticated
USING (
  coach_id IN (
    SELECT coach_id FROM athletes WHERE id = public.get_my_athlete_id()
  )
);

-- Service role: full access (implicit, but explicit for clarity)
CREATE POLICY "service_role_full_access_groups"
ON athlete_groups
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3. Seed default groups for each distinct coach
INSERT INTO athlete_groups (coach_id, name, color, sort_order)
SELECT DISTINCT a.coach_id, v.name, v.color, v.sort_order
FROM athletes a
CROSS JOIN (VALUES
  ('Elite', '#F97316', 0),
  ('Préparation', '#2563EB', 1),
  ('Loisir', '#64748B', 2)
) AS v(name, color, sort_order)
WHERE a.coach_id IS NOT NULL
ON CONFLICT (coach_id, name) DO NOTHING;

-- 4. Add FK column on athletes
ALTER TABLE athletes
ADD COLUMN IF NOT EXISTS athlete_group_id UUID REFERENCES athlete_groups(id) ON DELETE SET NULL;

-- 5. Migrate existing data
UPDATE athletes SET athlete_group_id = ag.id
FROM athlete_groups ag
WHERE athletes.coach_id = ag.coach_id
  AND (
    (athletes.athlete_group = 'elite' AND ag.name = 'Elite')
    OR (athletes.athlete_group = 'preparation' AND ag.name = 'Préparation')
    OR (athletes.athlete_group = 'loisir' AND ag.name = 'Loisir')
  );

-- 6. Drop old column and its CHECK constraint
ALTER TABLE athletes DROP COLUMN IF EXISTS athlete_group;
