-- Migration: 056_add_form_analysis_to_activities_and_monitoring_view.sql
-- Description: Add form_analysis JSONB SOT payload and expose its key fields in monitoring view.
-- Date: 2026-03-17

ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS form_analysis jsonb;

DROP VIEW IF EXISTS public.view_athlete_monitoring_karo;

CREATE OR REPLACE VIEW public.view_athlete_monitoring_karo AS
WITH pace_data AS (
         SELECT a.id AS activity_id,
            ((ath.first_name || ' '::text) || ath.last_name) AS athlete,
            (a.session_date)::date AS "Date",
                CASE
                    WHEN (lower(a.sport_type) = 'run'::text) THEN 'Course'::text
                    WHEN (lower(a.sport_type) = 'bike'::text) THEN 'Vélo'::text
                    WHEN (lower(a.sport_type) = 'swim'::text) THEN 'Natation'::text
                    WHEN (lower(a.sport_type) = 'ski'::text) THEN 'Ski'::text
                    WHEN (lower(a.sport_type) = 'strength'::text) THEN 'Muscu'::text
                    ELSE COALESCE(a.sport_type, 'Autre'::text)
                END AS "Sport",
                CASE
                    WHEN COALESCE(a.source_sport, a.activity_name, '') ILIKE '%home trainer%' THEN 'Indoor (HT)'
                    WHEN COALESCE(a.source_sport, a.activity_name, '') ILIKE '%tapis%' THEN 'Indoor (Tapis)'
                    WHEN lower(a.sport_type) = 'swim' THEN 'Indoor'
                    WHEN lower(a.sport_type) = 'strength' THEN 'Indoor'
                    WHEN lower(a.sport_type) IN ('run', 'bike', 'ski') THEN 'Outdoor'
                    ELSE NULL
                END AS "Lieu",
            COALESCE(a.activity_name, ('Session '::text || a.nolio_id)) AS "Séance",
                CASE
                    WHEN (a.work_type = 'intervals'::text) THEN 'Intervalle'::text
                    WHEN (a.work_type = 'endurance'::text) THEN 'Endurance'::text
                    WHEN (a.work_type = 'competition'::text) THEN 'Compétition'::text
                    ELSE initcap(COALESCE(a.work_type, 'Autre'::text))
                END AS "Type",
            to_char(((a.duration_sec || ' second'::text))::interval, 'HH24:MI:SS'::text) AS "Durée",
            round(((a.distance_m / (1000.0)::double precision))::numeric, 2) AS "KM",
            round((COALESCE(a.manual_interval_power_mean, a.interval_power_mean))::numeric, 1) AS "PmoyW",
            round((COALESCE(a.manual_interval_hr_mean, a.interval_hr_mean))::numeric, 1) AS "HRmeanW",
            round((COALESCE(a.manual_interval_power_last, a.interval_power_last))::numeric, 1) AS "Puissance (Last)",
            round((COALESCE(a.manual_interval_hr_last, a.interval_hr_last))::numeric, 1) AS "HRmean (Last)",
            round((a.load_index)::numeric, 0) AS "MLS",
            a.decoupling_index,
            a.segmented_metrics,
            a.form_analysis,
            COALESCE(a.manual_interval_pace_mean, a.interval_pace_mean) AS pace_mean_raw,
            COALESCE(a.manual_interval_pace_last, a.interval_pace_last) AS pace_last_raw,
            lower(a.sport_type) AS sport_lower,
                CASE
                    WHEN (a.manual_interval_power_mean IS NOT NULL
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
                       OR a.manual_interval_block_2_pace_last IS NOT NULL)
                    THEN 'Modifié'::text
                    ELSE 'Auto'::text
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
            (((a.segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_power_mean'::text)::double precision AS jsonb_block_1_power_mean,
            (((a.segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_power_last'::text)::double precision AS jsonb_block_1_power_last,
            (((a.segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_hr_mean'::text)::double precision AS jsonb_block_1_hr_mean,
            (((a.segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_hr_last'::text)::double precision AS jsonb_block_1_hr_last,
            (((a.segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_pace_mean'::text)::double precision AS jsonb_block_1_pace_mean,
            (((a.segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_pace_last'::text)::double precision AS jsonb_block_1_pace_last,
            a.manual_interval_block_2_power_mean,
            a.manual_interval_block_2_power_last,
            a.manual_interval_block_2_hr_mean,
            a.manual_interval_block_2_hr_last,
            a.manual_interval_block_2_pace_mean,
            a.manual_interval_block_2_pace_last,
            (((a.segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_power_mean'::text)::double precision AS jsonb_block_2_power_mean,
            (((a.segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_power_last'::text)::double precision AS jsonb_block_2_power_last,
            (((a.segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_hr_mean'::text)::double precision AS jsonb_block_2_hr_mean,
            (((a.segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_hr_last'::text)::double precision AS jsonb_block_2_hr_last,
            (((a.segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_pace_mean'::text)::double precision AS jsonb_block_2_pace_mean,
            (((a.segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_pace_last'::text)::double precision AS jsonb_block_2_pace_last
           FROM (activities a
             JOIN athletes ath ON ((a.athlete_id = ath.id)))
        )
 SELECT activity_id,
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
        WHEN (sport_lower ~~ '%bike%'::text OR sport_lower ~~ '%velo%'::text) THEN
            CASE
                WHEN avg_power IS NOT NULL THEN (round(avg_power::numeric, 1))::text || ' W'
                WHEN distance_m > 0 AND duration_sec > 0 THEN (round(((distance_m / duration_sec) * 3.6)::numeric, 1))::text || ' km/h'
                ELSE NULL
            END
        WHEN (sport_lower ~~ '%swim%'::text OR sport_lower ~~ '%natation%'::text) THEN
            CASE
                WHEN distance_m > 0 AND duration_sec > 0 THEN
                    to_char(((duration_sec / distance_m) * 100.0 * '00:00:01'::interval), 'FMMI''SS') || '/100m'
                ELSE NULL
            END
        ELSE
            CASE
                WHEN distance_m > 0 AND duration_sec > 0 THEN
                    to_char(((duration_sec / distance_m) * 1000.0 * '00:00:01'::interval), 'FMMI''SS"/km"')
                ELSE NULL
            END
    END AS "Intensité Séance",
    "PmoyW",
    "HRmeanW",
        CASE
            WHEN (pace_mean_raw IS NULL) THEN NULL::text
            WHEN ((sport_lower ~~ '%bike%'::text) OR (sport_lower ~~ '%velo%'::text)) THEN ((round((((60.0)::double precision / pace_mean_raw))::numeric, 1))::text || ' km/h'::text)
            WHEN ((sport_lower ~~ '%swim%'::text) OR (sport_lower ~~ '%natation%'::text)) THEN (to_char((pace_mean_raw * '00:01:00'::interval), 'FMMI''SS'::text) || '/100m'::text)
            ELSE to_char((pace_mean_raw * '00:01:00'::interval), 'FMMI''SS"/km'::text)
        END AS "Allure Moy",
    "Puissance (Last)",
    "HRmean (Last)",
        CASE
            WHEN (pace_last_raw IS NULL) THEN NULL::text
            WHEN ((sport_lower ~~ '%bike%'::text) OR (sport_lower ~~ '%velo%'::text)) THEN ((round((((60.0)::double precision / pace_last_raw))::numeric, 1))::text || ' km/h'::text)
            WHEN ((sport_lower ~~ '%swim%'::text) OR (sport_lower ~~ '%natation%'::text)) THEN (to_char((pace_last_raw * '00:01:00'::interval), 'FMMI''SS'::text) || '/100m'::text)
            ELSE to_char((pace_last_raw * '00:01:00'::interval), 'FMMI''SS"/km'::text)
        END AS "Allure (Last)",
    round((COALESCE(((decoupling_index / (100)::double precision) + (1)::double precision), (((((segmented_metrics -> 'splits_2'::text) -> 'phase_2'::text) ->> 'ratio'::text))::double precision / NULLIF(((((segmented_metrics -> 'splits_2'::text) -> 'phase_1'::text) ->> 'ratio'::text))::double precision, (0)::double precision))))::numeric, 2) AS "Découplage",
    round(((((((segmented_metrics -> 'splits_4'::text) -> 'phase_1'::text) ->> 'ratio'::text))::double precision / NULLIF(((((segmented_metrics -> 'splits_4'::text) -> 'phase_1'::text) ->> 'ratio'::text))::double precision, (0)::double precision)))::numeric, 2) AS "Q1",
    round(((((((segmented_metrics -> 'splits_4'::text) -> 'phase_2'::text) ->> 'ratio'::text))::double precision / NULLIF(((((segmented_metrics -> 'splits_4'::text) -> 'phase_1'::text) ->> 'ratio'::text))::double precision, (0)::double precision)))::numeric, 2) AS "Q2",
    round(((((((segmented_metrics -> 'splits_4'::text) -> 'phase_3'::text) ->> 'ratio'::text))::double precision / NULLIF(((((segmented_metrics -> 'splits_4'::text) -> 'phase_1'::text) ->> 'ratio'::text))::double precision, (0)::double precision)))::numeric, 2) AS "Q3",
    round(((((((segmented_metrics -> 'splits_4'::text) -> 'phase_4'::text) ->> 'ratio'::text))::double precision / NULLIF(((((segmented_metrics -> 'splits_4'::text) -> 'phase_1'::text) ->> 'ratio'::text))::double precision, (0)::double precision)))::numeric, 2) AS "Q4",
    COALESCE(jsonb_array_length(COALESCE((segmented_metrics -> 'interval_blocks'::text), '[]'::jsonb)), 0) AS interval_blocks_count,
    round(COALESCE(manual_interval_block_1_power_mean, jsonb_block_1_power_mean)::numeric, 1) AS interval_block_1_power_mean,
    round(COALESCE(manual_interval_block_1_power_last, jsonb_block_1_power_last)::numeric, 1) AS interval_block_1_power_last,
    round(COALESCE(manual_interval_block_1_hr_mean, jsonb_block_1_hr_mean)::numeric, 1) AS interval_block_1_hr_mean,
    round(COALESCE(manual_interval_block_1_hr_last, jsonb_block_1_hr_last)::numeric, 1) AS interval_block_1_hr_last,
    round(COALESCE(manual_interval_block_1_pace_mean, jsonb_block_1_pace_mean)::numeric, 2) AS interval_block_1_pace_mean,
    round(COALESCE(manual_interval_block_1_pace_last, jsonb_block_1_pace_last)::numeric, 2) AS interval_block_1_pace_last,
        CASE
            WHEN COALESCE(manual_interval_block_1_pace_mean, jsonb_block_1_pace_mean) IS NULL THEN NULL::text
            ELSE to_char((COALESCE(manual_interval_block_1_pace_mean, jsonb_block_1_pace_mean) * '00:01:00'::interval), 'FMMI''SS"/km"')
        END AS interval_block_1_pace_mean_fmt,
        CASE
            WHEN COALESCE(manual_interval_block_1_pace_last, jsonb_block_1_pace_last) IS NULL THEN NULL::text
            ELSE to_char((COALESCE(manual_interval_block_1_pace_last, jsonb_block_1_pace_last) * '00:01:00'::interval), 'FMMI''SS"/km"')
        END AS interval_block_1_pace_last_fmt,
    round(COALESCE(manual_interval_block_2_power_mean, jsonb_block_2_power_mean)::numeric, 1) AS interval_block_2_power_mean,
    round(COALESCE(manual_interval_block_2_power_last, jsonb_block_2_power_last)::numeric, 1) AS interval_block_2_power_last,
    round(COALESCE(manual_interval_block_2_hr_mean, jsonb_block_2_hr_mean)::numeric, 1) AS interval_block_2_hr_mean,
    round(COALESCE(manual_interval_block_2_hr_last, jsonb_block_2_hr_last)::numeric, 1) AS interval_block_2_hr_last,
    round(COALESCE(manual_interval_block_2_pace_mean, jsonb_block_2_pace_mean)::numeric, 2) AS interval_block_2_pace_mean,
    round(COALESCE(manual_interval_block_2_pace_last, jsonb_block_2_pace_last)::numeric, 2) AS interval_block_2_pace_last,
        CASE
            WHEN COALESCE(manual_interval_block_2_pace_mean, jsonb_block_2_pace_mean) IS NULL THEN NULL::text
            ELSE to_char((COALESCE(manual_interval_block_2_pace_mean, jsonb_block_2_pace_mean) * '00:01:00'::interval), 'FMMI''SS"/km"')
        END AS interval_block_2_pace_mean_fmt,
        CASE
            WHEN COALESCE(manual_interval_block_2_pace_last, jsonb_block_2_pace_last) IS NULL THEN NULL::text
            ELSE to_char((COALESCE(manual_interval_block_2_pace_last, jsonb_block_2_pace_last) * '00:01:00'::interval), 'FMMI''SS"/km"')
        END AS interval_block_2_pace_last_fmt,
    session_group_type,
    session_group_id,
    session_group_role,
    session_group_order,
    "MLS",
    "Source",
    form_analysis,
    (form_analysis ->> 'template_key'::text) AS template_key,
    ((form_analysis ->> 'comparable_count'::text))::integer AS comparable_count,
    (form_analysis ->> 'comparison_mode'::text) AS comparison_mode,
    (((form_analysis -> 'temperature'::text) ->> 'temp'::text))::double precision AS temp,
    (((form_analysis -> 'temperature'::text) ->> 'tref'::text))::double precision AS tref,
    (((form_analysis -> 'temperature'::text) ->> 'beta_hr'::text))::double precision AS beta_hr,
    (((form_analysis -> 'temperature'::text) ->> 'hr_corr'::text))::double precision AS hr_corr,
    (((form_analysis -> 'temperature'::text) ->> 'drift_corr'::text))::double precision AS drift_corr,
    (((form_analysis -> 'ea'::text) ->> 'today'::text))::double precision AS ea_today,
    (((form_analysis -> 'ea'::text) ->> 'baseline'::text))::double precision AS ea_base,
    (((form_analysis -> 'ea'::text) ->> 'delta_pct'::text))::double precision AS ea_delta_pct,
    (((form_analysis -> 'decoupling'::text) ->> 'metric'::text)) AS dec_metric,
    (((form_analysis -> 'decoupling'::text) ->> 'today'::text))::double precision AS dec_value,
    (((form_analysis -> 'hrend_drift'::text) ->> 'today'::text))::double precision AS hrend_drift,
    (((form_analysis -> 'rpe'::text) ->> 'today'::text))::double precision AS form_rpe,
    (((form_analysis -> 'decision'::text) ->> 'final'::text)) AS decision,
    (((form_analysis -> 'decision'::text) ->> 'durability_flag'::text))::boolean AS durability_flag
   FROM pace_data
  ORDER BY session_date DESC;
