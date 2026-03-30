-- Fix: use COALESCE(manual_activity_name, activity_name, ...) in monitoring view
-- so that coach manual overrides of session name are displayed in Retool.

CREATE OR REPLACE VIEW public.view_athlete_monitoring_karo AS
WITH pace_data AS (
    SELECT
        a.id AS activity_id,
        (ath.first_name || ' ' || ath.last_name) AS athlete,
        a.session_date::date AS "Date",
        CASE
            WHEN lower(a.sport_type) = 'run' THEN 'Course'
            WHEN lower(a.sport_type) = 'bike' THEN 'Vélo'
            WHEN lower(a.sport_type) = 'swim' THEN 'Natation'
            WHEN lower(a.sport_type) = 'ski' THEN 'Ski'
            WHEN lower(a.sport_type) = 'strength' THEN 'Muscu'
            ELSE COALESCE(a.sport_type, 'Autre')
        END AS "Sport",
        CASE
            WHEN COALESCE(a.source_sport, a.activity_name, '') ILIKE '%home trainer%' THEN 'Indoor (HT)'
            WHEN COALESCE(a.source_sport, a.activity_name, '') ILIKE '%tapis%' THEN 'Indoor (Tapis)'
            WHEN lower(a.sport_type) = 'swim' THEN 'Indoor'
            WHEN lower(a.sport_type) = 'strength' THEN 'Indoor'
            WHEN lower(a.sport_type) = ANY (ARRAY['run', 'bike', 'ski']) THEN 'Outdoor'
            ELSE NULL
        END AS "Lieu",
        COALESCE(a.manual_activity_name, a.activity_name, 'Session ' || a.nolio_id) AS "Séance",
        CASE
            WHEN a.work_type = 'intervals' THEN 'Intervalle'
            WHEN a.work_type = 'endurance' THEN 'Endurance'
            WHEN a.work_type = 'competition' THEN 'Compétition'
            ELSE initcap(COALESCE(a.work_type, 'Autre'))
        END AS "Type",
        to_char((a.duration_sec || ' second')::interval, 'HH24:MI:SS') AS "Durée",
        round((a.distance_m / 1000.0)::numeric, 2) AS "KM",
        round(COALESCE(a.manual_interval_power_mean, a.interval_power_mean)::numeric, 1) AS "PmoyW",
        round(COALESCE(a.manual_interval_hr_mean, a.interval_hr_mean)::numeric, 1) AS "HRmeanW",
        round(COALESCE(a.manual_interval_power_last, a.interval_power_last)::numeric, 1) AS "Puissance (Last)",
        round(COALESCE(a.manual_interval_hr_last, a.interval_hr_last)::numeric, 1) AS "HRmean (Last)",
        round(a.load_index::numeric, 0) AS "MLS",
        a.decoupling_index,
        a.segmented_metrics,
        a.form_analysis,
        COALESCE(a.manual_interval_pace_mean, a.interval_pace_mean) AS pace_mean_raw,
        COALESCE(a.manual_interval_pace_last, a.interval_pace_last) AS pace_last_raw,
        lower(a.sport_type) AS sport_lower,
        CASE
            WHEN a.manual_interval_power_mean IS NOT NULL
              OR a.manual_interval_hr_mean IS NOT NULL
              OR a.manual_interval_pace_mean IS NOT NULL
              OR a.manual_interval_power_last IS NOT NULL
              OR a.manual_interval_hr_last IS NOT NULL
              OR a.manual_interval_pace_last IS NOT NULL
              OR a.manual_interval_block_1_power_mean IS NOT NULL
              OR a.manual_interval_block_1_power_last IS NOT NULL
              OR a.manual_interval_block_1_hr_mean IS NOT NULL
              OR a.manual_interval_block_1_hr_last IS NOT NULL
              OR a.manual_interval_block_1_pace_mean IS NOT NULL
              OR a.manual_interval_block_1_pace_last IS NOT NULL
              OR a.manual_interval_block_2_power_mean IS NOT NULL
              OR a.manual_interval_block_2_power_last IS NOT NULL
              OR a.manual_interval_block_2_hr_mean IS NOT NULL
              OR a.manual_interval_block_2_hr_last IS NOT NULL
              OR a.manual_interval_block_2_pace_mean IS NOT NULL
              OR a.manual_interval_block_2_pace_last IS NOT NULL
            THEN 'Modifié'
            ELSE 'Auto'
        END AS "Source",
        a.session_group_id,
        a.session_group_type,
        a.session_group_role,
        a.session_group_order,
        a.session_date,
        a.avg_hr,
        a.avg_power,
        a.duration_sec,
        a.distance_m,
        a.manual_interval_block_1_power_mean,
        a.manual_interval_block_1_power_last,
        a.manual_interval_block_1_hr_mean,
        a.manual_interval_block_1_hr_last,
        a.manual_interval_block_1_pace_mean,
        a.manual_interval_block_1_pace_last,
        ((a.segmented_metrics -> 'interval_blocks') -> 0 ->> 'interval_power_mean')::double precision AS jsonb_block_1_power_mean,
        ((a.segmented_metrics -> 'interval_blocks') -> 0 ->> 'interval_power_last')::double precision AS jsonb_block_1_power_last,
        ((a.segmented_metrics -> 'interval_blocks') -> 0 ->> 'interval_hr_mean')::double precision AS jsonb_block_1_hr_mean,
        ((a.segmented_metrics -> 'interval_blocks') -> 0 ->> 'interval_hr_last')::double precision AS jsonb_block_1_hr_last,
        ((a.segmented_metrics -> 'interval_blocks') -> 0 ->> 'interval_pace_mean')::double precision AS jsonb_block_1_pace_mean,
        ((a.segmented_metrics -> 'interval_blocks') -> 0 ->> 'interval_pace_last')::double precision AS jsonb_block_1_pace_last,
        a.manual_interval_block_2_power_mean,
        a.manual_interval_block_2_power_last,
        a.manual_interval_block_2_hr_mean,
        a.manual_interval_block_2_hr_last,
        a.manual_interval_block_2_pace_mean,
        a.manual_interval_block_2_pace_last,
        ((a.segmented_metrics -> 'interval_blocks') -> 1 ->> 'interval_power_mean')::double precision AS jsonb_block_2_power_mean,
        ((a.segmented_metrics -> 'interval_blocks') -> 1 ->> 'interval_power_last')::double precision AS jsonb_block_2_power_last,
        ((a.segmented_metrics -> 'interval_blocks') -> 1 ->> 'interval_hr_mean')::double precision AS jsonb_block_2_hr_mean,
        ((a.segmented_metrics -> 'interval_blocks') -> 1 ->> 'interval_hr_last')::double precision AS jsonb_block_2_hr_last,
        ((a.segmented_metrics -> 'interval_blocks') -> 1 ->> 'interval_pace_mean')::double precision AS jsonb_block_2_pace_mean,
        ((a.segmented_metrics -> 'interval_blocks') -> 1 ->> 'interval_pace_last')::double precision AS jsonb_block_2_pace_last
    FROM activities a
    JOIN athletes ath ON a.athlete_id = ath.id
)
SELECT
    activity_id,
    athlete,
    "Date",
    "Sport",
    "Lieu",
    "Séance",
    "Type",
    "Durée",
    "KM",
    round(avg_hr::numeric, 1) AS "Hr Séance",
    CASE
        WHEN sport_lower LIKE '%bike%' OR sport_lower LIKE '%velo%' THEN
            CASE
                WHEN avg_power IS NOT NULL THEN round(avg_power::numeric, 1)::text || ' W'
                WHEN distance_m > 0 AND duration_sec > 0 THEN round((distance_m / duration_sec * 3.6)::numeric, 1)::text || ' km/h'
                ELSE NULL
            END
        WHEN sport_lower LIKE '%swim%' OR sport_lower LIKE '%natation%' THEN
            CASE
                WHEN distance_m > 0 AND duration_sec > 0 THEN to_char(duration_sec / distance_m * 100.0 * '00:00:01'::interval, 'FMMI''SS') || '/100m'
                ELSE NULL
            END
        ELSE
            CASE
                WHEN distance_m > 0 AND duration_sec > 0 THEN to_char(duration_sec / distance_m * 1000.0 * '00:00:01'::interval, 'FMMI''SS"/km"')
                ELSE NULL
            END
    END AS "Intensité Séance",
    "PmoyW",
    "HRmeanW",
    CASE
        WHEN pace_mean_raw IS NULL THEN NULL
        WHEN sport_lower LIKE '%bike%' OR sport_lower LIKE '%velo%' THEN round((60.0 / pace_mean_raw)::numeric, 1)::text || ' km/h'
        WHEN sport_lower LIKE '%swim%' OR sport_lower LIKE '%natation%' THEN to_char(pace_mean_raw * '00:01:00'::interval, 'FMMI''SS') || '/100m'
        ELSE to_char(pace_mean_raw * '00:01:00'::interval, 'FMMI''SS"/km')
    END AS "Allure Moy",
    "Puissance (Last)",
    "HRmean (Last)",
    CASE
        WHEN pace_last_raw IS NULL THEN NULL
        WHEN sport_lower LIKE '%bike%' OR sport_lower LIKE '%velo%' THEN round((60.0 / pace_last_raw)::numeric, 1)::text || ' km/h'
        WHEN sport_lower LIKE '%swim%' OR sport_lower LIKE '%natation%' THEN to_char(pace_last_raw * '00:01:00'::interval, 'FMMI''SS') || '/100m'
        ELSE to_char(pace_last_raw * '00:01:00'::interval, 'FMMI''SS"/km')
    END AS "Allure (Last)",
    round(COALESCE(
        decoupling_index / 100.0 + 1.0,
        ((segmented_metrics -> 'splits_2' -> 'phase_2' ->> 'ratio')::double precision)
        / NULLIF((segmented_metrics -> 'splits_2' -> 'phase_1' ->> 'ratio')::double precision, 0)
    )::numeric, 2) AS "Découplage",
    round(((segmented_metrics -> 'splits_4' -> 'phase_1' ->> 'ratio')::double precision / NULLIF((segmented_metrics -> 'splits_4' -> 'phase_1' ->> 'ratio')::double precision, 0))::numeric, 2) AS "Q1",
    round(((segmented_metrics -> 'splits_4' -> 'phase_2' ->> 'ratio')::double precision / NULLIF((segmented_metrics -> 'splits_4' -> 'phase_1' ->> 'ratio')::double precision, 0))::numeric, 2) AS "Q2",
    round(((segmented_metrics -> 'splits_4' -> 'phase_3' ->> 'ratio')::double precision / NULLIF((segmented_metrics -> 'splits_4' -> 'phase_1' ->> 'ratio')::double precision, 0))::numeric, 2) AS "Q3",
    round(((segmented_metrics -> 'splits_4' -> 'phase_4' ->> 'ratio')::double precision / NULLIF((segmented_metrics -> 'splits_4' -> 'phase_1' ->> 'ratio')::double precision, 0))::numeric, 2) AS "Q4",
    COALESCE(jsonb_array_length(COALESCE(segmented_metrics -> 'interval_blocks', '[]'::jsonb)), 0) AS interval_blocks_count,
    round(COALESCE(manual_interval_block_1_power_mean, jsonb_block_1_power_mean)::numeric, 1) AS interval_block_1_power_mean,
    round(COALESCE(manual_interval_block_1_power_last, jsonb_block_1_power_last)::numeric, 1) AS interval_block_1_power_last,
    round(COALESCE(manual_interval_block_1_hr_mean, jsonb_block_1_hr_mean)::numeric, 1) AS interval_block_1_hr_mean,
    round(COALESCE(manual_interval_block_1_hr_last, jsonb_block_1_hr_last)::numeric, 1) AS interval_block_1_hr_last,
    round(COALESCE(manual_interval_block_1_pace_mean, jsonb_block_1_pace_mean)::numeric, 2) AS interval_block_1_pace_mean,
    round(COALESCE(manual_interval_block_1_pace_last, jsonb_block_1_pace_last)::numeric, 2) AS interval_block_1_pace_last,
    CASE
        WHEN COALESCE(manual_interval_block_1_pace_mean, jsonb_block_1_pace_mean) IS NULL THEN NULL
        ELSE to_char(COALESCE(manual_interval_block_1_pace_mean, jsonb_block_1_pace_mean) * '00:01:00'::interval, 'FMMI''SS"/km"')
    END AS interval_block_1_pace_mean_fmt,
    CASE
        WHEN COALESCE(manual_interval_block_1_pace_last, jsonb_block_1_pace_last) IS NULL THEN NULL
        ELSE to_char(COALESCE(manual_interval_block_1_pace_last, jsonb_block_1_pace_last) * '00:01:00'::interval, 'FMMI''SS"/km"')
    END AS interval_block_1_pace_last_fmt,
    round(COALESCE(manual_interval_block_2_power_mean, jsonb_block_2_power_mean)::numeric, 1) AS interval_block_2_power_mean,
    round(COALESCE(manual_interval_block_2_power_last, jsonb_block_2_power_last)::numeric, 1) AS interval_block_2_power_last,
    round(COALESCE(manual_interval_block_2_hr_mean, jsonb_block_2_hr_mean)::numeric, 1) AS interval_block_2_hr_mean,
    round(COALESCE(manual_interval_block_2_hr_last, jsonb_block_2_hr_last)::numeric, 1) AS interval_block_2_hr_last,
    round(COALESCE(manual_interval_block_2_pace_mean, jsonb_block_2_pace_mean)::numeric, 2) AS interval_block_2_pace_mean,
    round(COALESCE(manual_interval_block_2_pace_last, jsonb_block_2_pace_last)::numeric, 2) AS interval_block_2_pace_last,
    CASE
        WHEN COALESCE(manual_interval_block_2_pace_mean, jsonb_block_2_pace_mean) IS NULL THEN NULL
        ELSE to_char(COALESCE(manual_interval_block_2_pace_mean, jsonb_block_2_pace_mean) * '00:01:00'::interval, 'FMMI''SS"/km"')
    END AS interval_block_2_pace_mean_fmt,
    CASE
        WHEN COALESCE(manual_interval_block_2_pace_last, jsonb_block_2_pace_last) IS NULL THEN NULL
        ELSE to_char(COALESCE(manual_interval_block_2_pace_last, jsonb_block_2_pace_last) * '00:01:00'::interval, 'FMMI''SS"/km"')
    END AS interval_block_2_pace_last_fmt,
    session_group_type,
    session_group_id,
    session_group_role,
    session_group_order,
    "MLS",
    "Source",
    form_analysis,
    form_analysis ->> 'template_key' AS template_key,
    (form_analysis ->> 'comparable_count')::integer AS comparable_count,
    form_analysis ->> 'comparison_mode' AS comparison_mode,
    ((form_analysis -> 'temperature') ->> 'temp')::double precision AS temp,
    ((form_analysis -> 'temperature') ->> 'tref')::double precision AS tref,
    ((form_analysis -> 'temperature') ->> 'beta_hr')::double precision AS beta_hr,
    ((form_analysis -> 'temperature') ->> 'hr_corr')::double precision AS hr_corr,
    ((form_analysis -> 'temperature') ->> 'drift_corr')::double precision AS drift_corr,
    ((form_analysis -> 'ea') ->> 'today')::double precision AS ea_today,
    ((form_analysis -> 'ea') ->> 'baseline')::double precision AS ea_base,
    ((form_analysis -> 'ea') ->> 'delta_pct')::double precision AS ea_delta_pct,
    (form_analysis -> 'decoupling') ->> 'metric' AS dec_metric,
    ((form_analysis -> 'decoupling') ->> 'today')::double precision AS dec_value,
    ((form_analysis -> 'hrend_drift') ->> 'today')::double precision AS hrend_drift,
    ((form_analysis -> 'rpe') ->> 'today')::double precision AS form_rpe,
    (form_analysis -> 'decision') ->> 'final' AS decision,
    ((form_analysis -> 'decision') ->> 'durability_flag')::boolean AS durability_flag
FROM pace_data
ORDER BY session_date DESC;
