-- Migration: Add activity_name to activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS activity_name TEXT;
