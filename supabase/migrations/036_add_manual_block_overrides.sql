-- Migration: 036_add_manual_block_overrides.sql
-- Description: Adds manual override columns for block-based interval metrics
--              so coach Karoly can edit block 1 & block 2 values in Retool.
-- Date: 2026-02-13

-- Block 1 overrides
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS manual_interval_block_1_power_mean double precision,
ADD COLUMN IF NOT EXISTS manual_interval_block_1_power_last double precision,
ADD COLUMN IF NOT EXISTS manual_interval_block_1_hr_mean double precision,
ADD COLUMN IF NOT EXISTS manual_interval_block_1_hr_last double precision,
ADD COLUMN IF NOT EXISTS manual_interval_block_1_pace_mean double precision,
ADD COLUMN IF NOT EXISTS manual_interval_block_1_pace_last double precision;

-- Block 2 overrides
ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS manual_interval_block_2_power_mean double precision,
ADD COLUMN IF NOT EXISTS manual_interval_block_2_power_last double precision,
ADD COLUMN IF NOT EXISTS manual_interval_block_2_hr_mean double precision,
ADD COLUMN IF NOT EXISTS manual_interval_block_2_hr_last double precision,
ADD COLUMN IF NOT EXISTS manual_interval_block_2_pace_mean double precision,
ADD COLUMN IF NOT EXISTS manual_interval_block_2_pace_last double precision;
