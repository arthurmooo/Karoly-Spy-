-- Migration: 008_fix_karoly_decoupling_views.sql
-- Description: Re-align coach dashboard decoupling views with Karoly Dec%.

-- 1. Le Flux Live (Tour de contrôle)
DROP VIEW IF EXISTS view_live_flux;
CREATE OR REPLACE VIEW view_live_flux AS
SELECT 
    a.session_date AT TIME ZONE 'UTC' AS date_heure,
    ath.first_name || ' ' || ath.last_name AS athlete,
    a.activity_name AS seance,
    CASE 
        WHEN a.work_type = 'intervals' THEN 'Intervalle'
        WHEN a.work_type = 'endurance' THEN 'Endurance'
        WHEN a.work_type = 'competition' THEN 'Compétition'
        ELSE INITCAP(a.work_type)
    END AS type_seance,
    COALESCE(a.source_sport, a.sport_type) AS sport,
    a.load_index AS mls,
    a.rpe,
    ROUND((
        1 - (
            (a.segmented_metrics->'splits_2'->'phase_2'->>'ratio')::float
            / NULLIF((a.segmented_metrics->'splits_2'->'phase_1'->>'ratio')::float, 0)
        )
    )::numeric * 100, 2) AS decouplage,
    ROUND((a.duration_sec / 60.0)::numeric, 1) AS duree_min,
    ROUND((a.distance_m / 1000.0)::numeric, 2) AS km,
    a.avg_hr AS bpm_moyen,
    a.temp_avg AS temp,
    a.humidity_avg AS hum
FROM activities a
JOIN athletes ath ON a.athlete_id = ath.id
ORDER BY a.session_date DESC;

-- 2. L'Historique Athlète (Numbers automatisé)
CREATE OR REPLACE VIEW view_athlete_history AS
SELECT 
    a.session_date::date AS date,
    ath.first_name || ' ' || ath.last_name AS athlete,
    COALESCE(a.source_sport, a.sport_type) AS sport,
    ROUND((a.duration_sec / 60.0)::numeric, 1) AS duree_min,
    ROUND((a.distance_m / 1000.0)::numeric, 2) AS km,
    a.interval_power_mean AS pmoy_w,
    a.interval_hr_mean AS hrmean_w,
    a.interval_power_last AS puissance_last,
    a.interval_hr_last AS hrmean_last,
    (a.segmented_metrics->'splits_2'->'phase_1'->>'torque')::float AS torque_nm, 
    CASE 
        WHEN a.avg_hr > 0 THEN ROUND((a.avg_power / a.avg_hr)::numeric, 2)
        ELSE NULL 
    END AS ratio_efficacite,
    ROUND((
        1 - (
            (a.segmented_metrics->'splits_2'->'phase_2'->>'ratio')::float
            / NULLIF((a.segmented_metrics->'splits_2'->'phase_1'->>'ratio')::float, 0)
        )
    )::numeric * 100, 2) AS decouplage_relatif,
    a.temp_avg AS temp,
    a.humidity_avg AS hum
FROM activities a
JOIN athletes ath ON a.athlete_id = ath.id
ORDER BY a.session_date DESC;

-- 3. L'Audit Performance (Spécial Compétition)
CREATE OR REPLACE VIEW view_performance_audit AS
WITH decoupling_calc AS (
    SELECT 
        a.id,
        (a.segmented_metrics->'splits_4'->'phase_1'->>'ratio')::float AS r1,
        (a.segmented_metrics->'splits_4'->'phase_2'->>'ratio')::float AS r2,
        (a.segmented_metrics->'splits_4'->'phase_3'->>'ratio')::float AS r3,
        (a.segmented_metrics->'splits_4'->'phase_4'->>'ratio')::float AS r4
    FROM activities a
)
SELECT 
    a.session_date::date AS date,
    ath.first_name || ' ' || ath.last_name AS athlete,
    COALESCE(a.source_sport, a.sport_type) AS sport,
    COALESCE(a.activity_name, 'Session ' || a.nolio_id) AS course_name,
    ROUND((a.duration_sec / 60.0)::numeric, 1) AS temps_min,
    ROUND((a.distance_m / 1000.0)::numeric, 2) AS dist_totale_km,
    ROUND(((1 - (dc.r1 / NULLIF(dc.r1, 0))) * 100)::numeric, 2) AS decoupling_q1,
    ROUND(((1 - (dc.r2 / NULLIF(dc.r1, 0))) * 100)::numeric, 2) AS decoupling_q2,
    ROUND(((1 - (dc.r3 / NULLIF(dc.r1, 0))) * 100)::numeric, 2) AS decoupling_q3,
    ROUND(((1 - (dc.r4 / NULLIF(dc.r1, 0))) * 100)::numeric, 2) AS decoupling_q4,
    (a.segmented_metrics->>'drift_percent')::float AS derive_totale_pct
FROM activities a
JOIN athletes ath ON a.athlete_id = ath.id
JOIN decoupling_calc dc ON a.id = dc.id
WHERE a.work_type = 'competition'
ORDER BY a.session_date DESC;
