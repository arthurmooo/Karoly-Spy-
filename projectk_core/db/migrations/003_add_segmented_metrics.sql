-- Migration: Add segmented_metrics JSONB column to activities table
-- Date: 2026-01-15

ALTER TABLE activities
ADD COLUMN IF NOT EXISTS segmented_metrics JSONB;
