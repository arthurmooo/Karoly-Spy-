-- Migration: Add work_type to activities
ALTER TABLE activities ADD COLUMN work_type TEXT;
COMMENT ON COLUMN activities.work_type IS 'Classification: endurance, intervals, competition, etc.';
