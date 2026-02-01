-- Project K: Add drift_pahr_percent column to activities
-- Description: Adds 'drift_pahr_percent' to store aerobic decoupling drift.
-- Date: 2026-02-01

ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS drift_pahr_percent double precision;
