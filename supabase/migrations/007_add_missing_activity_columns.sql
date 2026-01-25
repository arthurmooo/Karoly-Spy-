-- Migration: 007_add_missing_activity_columns.sql
-- Description: Adds duration_sec and distance_m to activities table.

ALTER TABLE activities ADD COLUMN IF NOT EXISTS duration_sec FLOAT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS distance_m FLOAT;
