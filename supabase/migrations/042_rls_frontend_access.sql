-- Migration: RLS policies for frontend (coach) access
-- Coaches authenticated via Supabase Auth can read their athletes' data

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Activities: coaches can SELECT
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_read_activities"
  ON public.activities
  FOR SELECT
  TO authenticated
  USING (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE coach_id = auth.uid()
    )
  );

-- Activity intervals: coaches can SELECT
ALTER TABLE public.activity_intervals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_read_activity_intervals"
  ON public.activity_intervals
  FOR SELECT
  TO authenticated
  USING (
    activity_id IN (
      SELECT a.id FROM public.activities a
      JOIN public.athletes ath ON a.athlete_id = ath.id
      WHERE ath.coach_id = auth.uid()
    )
  );

-- Activities: coaches can UPDATE coach_comment
CREATE POLICY "coach_update_activities_comment"
  ON public.activities
  FOR UPDATE
  TO authenticated
  USING (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE coach_id = auth.uid()
    )
  )
  WITH CHECK (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE coach_id = auth.uid()
    )
  );

-- Physio profiles: coaches can SELECT and INSERT
ALTER TABLE public.physio_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_read_physio_profiles"
  ON public.physio_profiles
  FOR SELECT
  TO authenticated
  USING (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE coach_id = auth.uid()
    )
  );

CREATE POLICY "coach_insert_physio_profiles"
  ON public.physio_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE coach_id = auth.uid()
    )
  );

CREATE POLICY "coach_update_physio_profiles"
  ON public.physio_profiles
  FOR UPDATE
  TO authenticated
  USING (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE coach_id = auth.uid()
    )
  );

-- Daily readiness: coaches can SELECT and INSERT/UPSERT
ALTER TABLE public.daily_readiness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_read_daily_readiness"
  ON public.daily_readiness
  FOR SELECT
  TO authenticated
  USING (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE coach_id = auth.uid()
    )
  );

CREATE POLICY "coach_upsert_daily_readiness"
  ON public.daily_readiness
  FOR INSERT
  TO authenticated
  WITH CHECK (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE coach_id = auth.uid()
    )
  );
