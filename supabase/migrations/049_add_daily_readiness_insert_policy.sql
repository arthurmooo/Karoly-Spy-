DROP POLICY IF EXISTS "coach_insert_daily_readiness" ON public.daily_readiness;
DROP POLICY IF EXISTS "coach_upsert_daily_readiness" ON public.daily_readiness;

CREATE POLICY "coach_insert_daily_readiness"
  ON public.daily_readiness
  FOR INSERT
  TO authenticated
  WITH CHECK (
    athlete_id IN (
      SELECT id FROM public.athletes WHERE coach_id = auth.uid()
    )
  );
