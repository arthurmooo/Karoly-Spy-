-- Migration: 018_update_monitoring_karo_pace.sql
-- Description: Add pace columns to view_athlete_monitoring_karo

CREATE OR REPLACE VIEW view_athlete_monitoring_karo AS
SELECT 
    a.id AS activity_id,
    (ath.first_name || ' '::text) || ath.last_name AS athlete,
    a.session_date::date AS "Date",
    COALESCE(a.activity_name, 'Session '::text || a.nolio_id) AS "Séance",
    CASE
        WHEN a.work_type = 'intervals'::text THEN 'Intervalle'::text
        WHEN a.work_type = 'endurance'::text THEN 'Endurance'::text
        WHEN a.work_type = 'competition'::text THEN 'Compétition'::text
        ELSE initcap(COALESCE(a.work_type, 'Autre'::text))
    END AS "Type",
    to_char((a.duration_sec || ' second'::text)::interval, 'HH24:MI:SS'::text) AS "Durée",
    round((a.distance_m / 1000.0::double precision)::numeric, 2) AS "KM",
    round(COALESCE(a.manual_interval_power_mean, a.interval_power_mean)::numeric, 1) AS "PmoyW",
    round(COALESCE(a.manual_interval_hr_mean, a.interval_hr_mean)::numeric, 1) AS "HRmeanW",
    round(COALESCE(a.manual_interval_pace_mean, a.interval_pace_mean)::numeric, 2) AS "Allure Moy",
    round(COALESCE(a.manual_interval_power_last, a.interval_power_last)::numeric, 1) AS "Puissance (Last)",
    round(COALESCE(a.manual_interval_hr_last, a.interval_hr_last)::numeric, 1) AS "HRmean (Last)",
    round(COALESCE(a.manual_interval_pace_last, a.interval_pace_last)::numeric, 2) AS "Allure (Last)",
    round(a.load_index::numeric, 0) AS "MLS",
    CASE
        WHEN a.manual_interval_power_mean IS NOT NULL 
             OR a.manual_interval_hr_mean IS NOT NULL 
             OR a.manual_interval_pace_mean IS NOT NULL 
        THEN 'Modifié'::text
        ELSE 'Auto'::text
    END AS "Source"
FROM activities a
JOIN athletes ath ON a.athlete_id = ath.id
ORDER BY a.session_date DESC;
