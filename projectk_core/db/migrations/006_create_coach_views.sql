-- Migration: 006_create_coach_views.sql
-- Description: Creates SQL views for Karoly's coaching dashboard.

-- 1. Le Flux Live (Tour de contrôle)
CREATE OR REPLACE VIEW view_live_flux AS
SELECT 
    a.session_date AT TIME ZONE 'UTC' AS date_heure,
    ath.first_name || ' ' || ath.last_name AS athlete,
    a.sport_type AS sport,
    a.load_index AS mls,
    a.rpe,
    ROUND((a.duration_sec / 60.0)::numeric, 1) AS duree_min,
    ROUND((a.distance_m / 1000.0)::numeric, 2) AS km,
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
    a.decoupling_index AS decouplage_1_2,
    a.temp_avg AS temp,
    a.humidity_avg AS hum
FROM activities a
JOIN athletes ath ON a.athlete_id = ath.id
ORDER BY a.session_date DESC;

-- 3. L'Audit Performance (Spécial Compétition)
CREATE OR REPLACE VIEW view_performance_audit AS
SELECT 
    a.session_date::date AS date,
    ath.first_name || ' ' || ath.last_name AS athlete,
    COALESCE(a.activity_name, 'Session ' || a.nolio_id) AS course_name,
    ROUND((a.duration_sec / 60.0)::numeric, 1) AS temps_min,
    ROUND((a.distance_m / 1000.0)::numeric, 2) AS dist_totale_km,
    a.decoupling_index AS decouplage_1_2,
    (a.segmented_metrics->'splits_4'->'phase_1'->>'ratio')::float AS ratio_1_4,
    (a.segmented_metrics->'splits_4'->'phase_2'->>'ratio')::float AS ratio_2_4,
    (a.segmented_metrics->'splits_4'->'phase_3'->>'ratio')::float AS ratio_3_4,
    (a.segmented_metrics->'splits_4'->'phase_4'->>'ratio')::float AS ratio_4_4,
    (a.segmented_metrics->>'drift_percent')::float AS derive_totale
FROM activities a
JOIN athletes ath ON a.athlete_id = ath.id
WHERE a.work_type = 'competition'
ORDER BY a.session_date DESC;

-- 4. Le Radar Santé (Pilotage matinal)
CREATE OR REPLACE VIEW view_health_radar AS
WITH latest_health AS (
    SELECT DISTINCT ON (athlete_id) *
    FROM daily_readiness
    ORDER BY athlete_id, date DESC
)
SELECT 
    ath.first_name || ' ' || ath.last_name AS athlete,
    lh.date,
    lh.rmssd AS rmssd_matinal,
    lh.resting_hr AS fc_repos,
    CASE 
        WHEN lh.rmssd_30d_avg > 0 THEN ROUND(((lh.rmssd / lh.rmssd_30d_avg - 1) * 100)::numeric, 1)
        ELSE NULL 
    END AS tendance_rmssd_pct,
    (SELECT pp.weight 
     FROM physio_profiles pp 
     WHERE pp.athlete_id = lh.athlete_id 
       AND pp.valid_from <= (lh.date + interval '1 day')
     ORDER BY pp.valid_from DESC 
     LIMIT 1) AS poids
FROM latest_health lh
JOIN athletes ath ON lh.athlete_id = ath.id
ORDER BY lh.date DESC;
