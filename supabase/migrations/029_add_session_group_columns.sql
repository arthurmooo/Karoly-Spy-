-- Migration: 029_add_session_group_columns.sql
-- Description: Add grouping metadata for linked sessions (e.g. Brick Bike+Run).
-- Date: 2026-02-11

ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS session_group_id text,
ADD COLUMN IF NOT EXISTS session_group_type text,
ADD COLUMN IF NOT EXISTS session_group_role text,
ADD COLUMN IF NOT EXISTS session_group_order integer;

CREATE INDEX IF NOT EXISTS idx_activities_session_group_id ON public.activities(session_group_id);
CREATE INDEX IF NOT EXISTS idx_activities_session_group_type ON public.activities(session_group_type);
