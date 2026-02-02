-- Project K: Add missing metrics columns to activities
-- Description: Adds mec, int_index, energy_kj, normalized_power, tss to activities table.
-- Date: 2026-02-01

ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS mec double precision,
ADD COLUMN IF NOT EXISTS int_index double precision,
ADD COLUMN IF NOT EXISTS energy_kj double precision,
ADD COLUMN IF NOT EXISTS normalized_power double precision,
ADD COLUMN IF NOT EXISTS tss double precision;
