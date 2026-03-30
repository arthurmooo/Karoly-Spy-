-- 055: Create planned_workouts table for Nolio planned sessions sync
CREATE TABLE planned_workouts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  nolio_planned_id integer UNIQUE NOT NULL,
  planned_date date NOT NULL,
  sport text NOT NULL,
  name text NOT NULL,
  duration_planned_sec integer,
  distance_planned_m real,
  rpe integer,
  structured_workout jsonb,
  linked_activity_id uuid REFERENCES activities(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_planned_workouts_athlete_date ON planned_workouts(athlete_id, planned_date);
CREATE INDEX idx_planned_workouts_linked ON planned_workouts(linked_activity_id);

-- RLS
ALTER TABLE planned_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can read planned workouts of their athletes"
  ON planned_workouts FOR SELECT
  USING (
    athlete_id IN (
      SELECT id FROM athletes WHERE coach_id = auth.uid()
    )
  );

CREATE POLICY "Athletes can read own planned workouts"
  ON planned_workouts FOR SELECT
  USING (
    athlete_id IN (
      SELECT up.athlete_id FROM user_profiles up
      WHERE up.id = auth.uid()
    )
  );
