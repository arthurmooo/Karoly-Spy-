-- Add manual block structure columns (count + duration) so manual detection
-- can override the auto-detected block structure, not just the metrics.
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS manual_interval_block_1_count INTEGER,
  ADD COLUMN IF NOT EXISTS manual_interval_block_1_duration_sec REAL,
  ADD COLUMN IF NOT EXISTS manual_interval_block_2_count INTEGER,
  ADD COLUMN IF NOT EXISTS manual_interval_block_2_duration_sec REAL;
