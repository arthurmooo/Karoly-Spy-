-- Migration: 059_add_load_components_and_acwr_view.sql
-- Description: Persist per-activity ACWR load components and expose a flattened monitoring view.
-- Date: 2026-03-18

ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS load_components jsonb;

DROP VIEW IF EXISTS public.view_acwr_monitoring;

CREATE OR REPLACE VIEW public.view_acwr_monitoring AS
SELECT
    a.id AS activity_id,
    a.athlete_id,
    ath.first_name || ' ' || ath.last_name AS athlete,
    a.session_date,
    a.sport_type,
    a.work_type,
    a.moving_time_sec,
    a.duration_sec,
    a.distance_m,
    a.rpe,
    a.load_index,
    a.load_components,
    ROUND(((a.load_components -> 'external' ->> 'duration_min')::numeric), 2) AS external_duration_min,
    ROUND(((a.load_components -> 'external' ->> 'distance_km')::numeric), 3) AS external_distance_km,
    ROUND(((a.load_components -> 'external' ->> 'intensity_ratio_avg')::numeric), 3) AS external_intensity_ratio_avg,
    ROUND(((a.load_components -> 'internal' ->> 'srpe_load')::numeric), 2) AS internal_srpe_load,
    ROUND(((a.load_components -> 'internal' ->> 'time_lt1_sec')::numeric), 0) AS internal_time_lt1_sec,
    ROUND(((a.load_components -> 'internal' ->> 'time_between_lt1_lt2_sec')::numeric), 0) AS internal_time_between_lt1_lt2_sec,
    ROUND(((a.load_components -> 'internal' ->> 'time_gt_lt2_sec')::numeric), 0) AS internal_time_gt_lt2_sec,
    ROUND(((a.load_components -> 'global' ->> 'mls')::numeric), 1) AS global_mls
FROM public.activities a
JOIN public.athletes ath ON ath.id = a.athlete_id
ORDER BY a.session_date DESC, athlete;
