-- Migration: 015_view_louis_richard_pilot.sql
-- Description: Create a specific view for Louis Richard history as requested by Karoly.

DROP VIEW IF EXISTS view_pilot_louis_richard;

CREATE OR REPLACE VIEW view_pilot_louis_richard AS
SELECT 
    a.session_date::date AS "Date",
    COALESCE(a.activity_name, 'Session ' || a.nolio_id) AS "Séance",
    CASE 
        WHEN a.work_type = 'intervals' THEN 'Intervalle'
        WHEN a.work_type = 'endurance' THEN 'Endurance'
        WHEN a.work_type = 'competition' THEN 'Compétition'
        ELSE INITCAP(COALESCE(a.work_type, 'Autre'))
    END AS "Type",
    TO_CHAR((a.duration_sec || ' second')::interval, 'HH24:MI:SS') AS "Durée",
    ROUND((a.distance_m / 1000.0)::numeric, 2) AS "KM",
    ROUND(a.interval_power_mean::numeric, 1) AS "PmoyW",
    ROUND(a.interval_hr_mean::numeric, 1) AS "HRmeanW",
    ROUND(a.interval_power_last::numeric, 1) AS "Puissance (Last)",
    ROUND(a.interval_hr_last::numeric, 1) AS "HRmean (Last)",
    ROUND((a.segmented_metrics->'splits_2'->'phase_1'->>'torque')::numeric, 1) AS "Torque (Nm)",
    CASE 
        WHEN a.avg_hr > 0 THEN ROUND((a.avg_power / a.avg_hr)::numeric, 2)
        ELSE NULL 
    END AS "Ratio Efficacité (W/FC)",
    ROUND(((a.segmented_metrics->'splits_2'->'phase_2'->>'ratio')::float / NULLIF((a.segmented_metrics->'splits_2'->'phase_1'->>'ratio')::float, 0))::numeric, 2) AS "Découplage 1/2",
    ROUND(a.load_index::numeric, 0) AS "MLS",
    CASE 
        WHEN a.temp_avg IS NOT NULL AND a.humidity_avg IS NOT NULL THEN 
            ROUND(a.temp_avg::numeric, 1) || '°C, ' || ROUND(a.humidity_avg::numeric, 0) || '%'
        WHEN a.temp_avg IS NOT NULL THEN 
            ROUND(a.temp_avg::numeric, 1) || '°C'
        ELSE NULL 
    END AS "Météo"
FROM activities a
JOIN athletes ath ON a.athlete_id = ath.id
WHERE ath.first_name = 'Louis' AND ath.last_name = 'Richard'
ORDER BY a.session_date DESC;