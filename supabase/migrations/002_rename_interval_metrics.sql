-- Migration: Rename interval metrics columns to match standard naming convention
-- Date: 2026-01-15

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activities'
      AND column_name = 'last_interval_power'
  ) THEN
    ALTER TABLE activities RENAME COLUMN last_interval_power TO interval_power_last;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activities'
      AND column_name = 'last_interval_hr'
  ) THEN
    ALTER TABLE activities RENAME COLUMN last_interval_hr TO interval_hr_last;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activities'
      AND column_name = 'intervals_avg_power'
  ) THEN
    ALTER TABLE activities RENAME COLUMN intervals_avg_power TO interval_power_mean;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'activities'
      AND column_name = 'intervals_avg_hr'
  ) THEN
    ALTER TABLE activities RENAME COLUMN intervals_avg_hr TO interval_hr_mean;
  END IF;
END $$;
