-- Migration: 024_add_sport_column_to_monitoring_view.sql
-- Description: Add 'Sport' column and improve sport labeling in view_athlete_monitoring_karo

DROP VIEW IF EXISTS view_athlete_monitoring_karo;

CREATE VIEW view_athlete_monitoring_karo AS
WITH pace_data AS (
    SELECT 
        a.id AS activity_id,
        (ath.first_name || ' '::text) || ath.last_name AS athlete,
        a.session_date::date AS "Date",
        CASE 
            WHEN lower(a.sport_type) = 'run' THEN 'Course'
            WHEN lower(a.sport_type) = 'bike' THEN 'Vélo'
            WHEN lower(a.sport_type) = 'swim' THEN 'Natation'
            WHEN lower(a.sport_type) = 'ski' THEN 'Ski'
            WHEN lower(a.sport_type) = 'strength' THEN 'Muscu'
            ELSE COALESCE(a.sport_type, 'Autre')
        END AS "Sport",
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
        round(COALESCE(a.manual_interval_power_last, a.interval_power_last)::numeric, 1) AS "Puissance (Last)",
        round(COALESCE(a.manual_interval_hr_last, a.interval_hr_last)::numeric, 1) AS "HRmean (Last)",
        round(a.load_index::numeric, 0) AS "MLS",
        COALESCE(a.manual_interval_pace_mean, a.interval_pace_mean) as pace_mean_raw,
        COALESCE(a.manual_interval_pace_last, a.interval_pace_last) as pace_last_raw,
        lower(a.sport_type) as sport_lower,
        CASE
            WHEN a.manual_interval_power_mean IS NOT NULL 
                 OR a.manual_interval_hr_mean IS NOT NULL 
                 OR a.manual_interval_pace_mean IS NOT NULL 
                 OR a.manual_interval_power_last IS NOT NULL 
                 OR a.manual_interval_hr_last IS NOT NULL 
                 OR a.manual_interval_pace_last IS NOT NULL 
            THEN 'Modifié'::text
            ELSE 'Auto'::text
        END AS "Source",
        a.session_date
    FROM activities a
    JOIN athletes ath ON a.athlete_id = ath.id
)
SELECT 
    activity_id,
    athlete,
    "Date",
    "Sport",
    "Séance",
    "Type",
    "Durée",
    "KM",
    "PmoyW",
    "HRmeanW",
    CASE 
        WHEN pace_mean_raw IS NULL THEN NULL
        WHEN sport_lower LIKE '%bike%' OR sport_lower LIKE '%velo%' THEN 
            round((60.0 / pace_mean_raw)::numeric, 1)::text || ' km/h'
        WHEN sport_lower LIKE '%swim%' OR sport_lower LIKE '%natation%' THEN 
            to_char((pace_mean_raw * '1 minute'::interval), 'FMMI''SS') || '/100m'
        ELSE to_char((pace_mean_raw * '1 minute'::interval), 'FMMI''SS"/km')
    END AS "Allure Moy",
    "Puissance (Last)",
    "HRmean (Last)",
    CASE 
        WHEN pace_last_raw IS NULL THEN NULL
        WHEN sport_lower LIKE '%bike%' OR sport_lower LIKE '%velo%' THEN 
            round((60.0 / pace_last_raw)::numeric, 1)::text || ' km/h'
        WHEN sport_lower LIKE '%swim%' OR sport_lower LIKE '%natation%' THEN 
            to_char((pace_last_raw * '1 minute'::interval), 'FMMI''SS') || '/100m'
        ELSE to_char((pace_last_raw * '1 minute'::interval), 'FMMI''SS"/km')
    END AS "Allure (Last)",
    "MLS",
    "Source"
FROM pace_data
ORDER BY session_date DESC;
