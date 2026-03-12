-- Add moving_time_sec to activities (active time excluding pauses)
-- duration_sec remains as elapsed time for backwards compatibility
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS moving_time_sec DOUBLE PRECISION;
