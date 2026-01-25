-- Migration: Rename interval metrics columns to match standard naming convention
-- Date: 2026-01-15

ALTER TABLE activities 
RENAME COLUMN last_interval_power TO interval_power_last;

ALTER TABLE activities 
RENAME COLUMN last_interval_hr TO interval_hr_last;

ALTER TABLE activities 
RENAME COLUMN intervals_avg_power TO interval_power_mean;

ALTER TABLE activities 
RENAME COLUMN intervals_avg_hr TO interval_hr_mean;
