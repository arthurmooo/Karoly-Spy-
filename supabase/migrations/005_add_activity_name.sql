-- Migration: Add activity_name to activities
ALTER TABLE activities ADD COLUMN activity_name TEXT;
