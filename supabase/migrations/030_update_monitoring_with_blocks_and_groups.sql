-- Migration: 030_update_monitoring_with_blocks_and_groups.sql
-- Description: Expose interval block metrics (block_1/block_2) and session grouping fields in monitoring view.
-- Date: 2026-02-11

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
        a.decoupling_index,
        a.segmented_metrics,
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
        a.session_group_id,
        a.session_group_type,
        a.session_group_role,
        a.session_group_order,
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
    round(COALESCE(
        (decoupling_index / 100 + 1),
        ((segmented_metrics->'splits_2'->'phase_2'->>'ratio')::float / NULLIF((segmented_metrics->'splits_2'->'phase_1'->>'ratio')::float, 0))
    )::numeric, 2) AS "Découplage",
    round(((segmented_metrics->'splits_4'->'phase_1'->>'ratio')::float / NULLIF((segmented_metrics->'splits_4'->'phase_1'->>'ratio')::float, 0))::numeric, 2) AS "Q1",
    round(((segmented_metrics->'splits_4'->'phase_2'->>'ratio')::float / NULLIF((segmented_metrics->'splits_4'->'phase_1'->>'ratio')::float, 0))::numeric, 2) AS "Q2",
    round(((segmented_metrics->'splits_4'->'phase_3'->>'ratio')::float / NULLIF((segmented_metrics->'splits_4'->'phase_1'->>'ratio')::float, 0))::numeric, 2) AS "Q3",
    round(((segmented_metrics->'splits_4'->'phase_4'->>'ratio')::float / NULLIF((segmented_metrics->'splits_4'->'phase_1'->>'ratio')::float, 0))::numeric, 2) AS "Q4",
    COALESCE(jsonb_array_length(COALESCE(segmented_metrics->'interval_blocks', '[]'::jsonb)), 0) AS interval_blocks_count,
    round(((segmented_metrics->'interval_blocks'->0->>'interval_power_mean')::float)::numeric, 1) AS interval_block_1_power_mean,
    round(((segmented_metrics->'interval_blocks'->0->>'interval_power_last')::float)::numeric, 1) AS interval_block_1_power_last,
    round(((segmented_metrics->'interval_blocks'->0->>'interval_hr_mean')::float)::numeric, 1) AS interval_block_1_hr_mean,
    round(((segmented_metrics->'interval_blocks'->0->>'interval_hr_last')::float)::numeric, 1) AS interval_block_1_hr_last,
    round(((segmented_metrics->'interval_blocks'->0->>'interval_pace_mean')::float)::numeric, 2) AS interval_block_1_pace_mean,
    round(((segmented_metrics->'interval_blocks'->0->>'interval_pace_last')::float)::numeric, 2) AS interval_block_1_pace_last,
    round(((segmented_metrics->'interval_blocks'->1->>'interval_power_mean')::float)::numeric, 1) AS interval_block_2_power_mean,
    round(((segmented_metrics->'interval_blocks'->1->>'interval_power_last')::float)::numeric, 1) AS interval_block_2_power_last,
    round(((segmented_metrics->'interval_blocks'->1->>'interval_hr_mean')::float)::numeric, 1) AS interval_block_2_hr_mean,
    round(((segmented_metrics->'interval_blocks'->1->>'interval_hr_last')::float)::numeric, 1) AS interval_block_2_hr_last,
    round(((segmented_metrics->'interval_blocks'->1->>'interval_pace_mean')::float)::numeric, 2) AS interval_block_2_pace_mean,
    round(((segmented_metrics->'interval_blocks'->1->>'interval_pace_last')::float)::numeric, 2) AS interval_block_2_pace_last,
    session_group_type,
    session_group_id,
    session_group_role,
    session_group_order,
    "MLS",
    "Source"
FROM pace_data
ORDER BY session_date DESC;
