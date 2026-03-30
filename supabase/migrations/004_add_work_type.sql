-- Migration: Add work_type to activities
ALTER TABLE activities ADD COLUMN IF NOT EXISTS work_type TEXT;
