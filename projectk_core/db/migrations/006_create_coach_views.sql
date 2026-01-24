-- Migration: 006_create_coach_views.sql
-- Description: Creates SQL views for Karoly's coaching dashboard.

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
    ROUND(((a.segmented_metrics->'splits_2'->'phase_2'->>'ratio')::float / (a.segmented_metrics->'splits_2'->'phase_1'->>'ratio')::float)::numeric, 2) AS decouplage,
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
    ROUND(((a.segmented_metrics->'splits_2'->'phase_2'->>'ratio')::float / (a.segmented_metrics->'splits_2'->'phase_1'->>'ratio')::float)::numeric, 2) AS decouplage_relatif,
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
    ROUND((dc.r1 / dc.r1)::numeric, 2) AS decoupling_q1,
    ROUND((dc.r2 / dc.r1)::numeric, 2) AS decoupling_q2,
    ROUND((dc.r3 / dc.r1)::numeric, 2) AS decoupling_q3,
    ROUND((dc.r4 / dc.r1)::numeric, 2) AS decoupling_q4,
    (a.segmented_metrics->>'drift_percent')::float AS derive_totale_pct
FROM activities a
JOIN athletes ath ON a.athlete_id = ath.id
JOIN decoupling_calc dc ON a.id = dc.id
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

-- 5. Les Profils Actuels (Paramètres physiologiques)
CREATE OR REPLACE VIEW view_athlete_profiles_active AS
SELECT 
    ath.first_name || ' ' || ath.last_name AS athlete,
    pp.sport,
    pp.lt1_hr,
    pp.lt2_hr,
    pp.cp_cs,
    pp.weight,
    pp.valid_from AT TIME ZONE 'UTC' AS actif_depuis
FROM physio_profiles pp
JOIN athletes ath ON pp.athlete_id = ath.id
WHERE pp.valid_to IS NULL
ORDER BY athlete, pp.sport;
