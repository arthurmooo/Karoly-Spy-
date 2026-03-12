ALTER TABLE public.daily_readiness
  ADD COLUMN IF NOT EXISTS muscle_soreness double precision,
  ADD COLUMN IF NOT EXISTS physical_condition double precision,
  ADD COLUMN IF NOT EXISTS training_performance double precision,
  ADD COLUMN IF NOT EXISTS training_rpe double precision,
  ADD COLUMN IF NOT EXISTS recovery_points double precision;
