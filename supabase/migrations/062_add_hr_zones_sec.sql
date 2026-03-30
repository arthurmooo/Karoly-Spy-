-- Migration 062: Add hr_zones_sec column to activities
-- Stores seconds spent in each of the 6 HR sub-zones
-- Format: {"Z1i": 600, "Z1ii": 1200, "Z2i": 900, "Z2ii": 450, "Z3i": 300, "Z3ii": 150}
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS hr_zones_sec JSONB DEFAULT NULL;

COMMENT ON COLUMN activities.hr_zones_sec IS
  'Time (seconds) spent per HR sub-zone. Keys: Z1i, Z1ii, Z2i, Z2ii, Z3i, Z3ii. Requires lt1_hr and lt2_hr in physio profile.';
