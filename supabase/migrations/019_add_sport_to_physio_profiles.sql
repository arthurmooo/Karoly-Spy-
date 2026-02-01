-- Project K: Add sport column to physio_profiles
-- Description: Adds 'sport' column to allow differentiating Bike vs Run profiles.
-- Date: 2026-02-01

ALTER TABLE public.physio_profiles 
ADD COLUMN IF NOT EXISTS sport text DEFAULT 'bike';
