-- Migration: 025_add_athlete_name_to_physio_profiles.sql
-- Description: Add athlete_name column to physio_profiles table

ALTER TABLE public.physio_profiles ADD COLUMN athlete_name text;
