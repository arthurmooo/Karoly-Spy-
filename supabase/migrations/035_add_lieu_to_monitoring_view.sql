-- Add "Lieu" (Indoor/Outdoor) column to view_athlete_monitoring_karo
-- Logic: detect from source_sport or activity_name keywords
--   "Home Trainer" → Indoor (HT)
--   "Tapis"        → Indoor (Tapis)
--   Swim/Strength  → Indoor
--   Run/Bike/Ski   → Outdoor (default)

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
            COALESCE(a.manual_interval_pace_mean, a.interval_pace_mean) AS pace_mean_raw,
            COALESCE(a.manual_interval_pace_last, a.interval_pace_last) AS pace_last_raw,
            lower(a.sport_type) AS sport_lower,
                CASE
                    WHEN ((a.manual_interval_power_mean IS NOT NULL) OR (a.manual_interval_hr_mean IS NOT NULL) OR (a.manual_interval_pace_mean IS NOT NULL) OR (a.manual_interval_power_last IS NOT NULL) OR (a.manual_interval_hr_last IS NOT NULL) OR (a.manual_interval_pace_last IS NOT NULL)) THEN 'Modifié'::text
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
            a.distance_m
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
    round((((((segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_power_mean'::text))::double precision)::numeric, 1) AS interval_block_1_power_mean,
    round((((((segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_power_last'::text))::double precision)::numeric, 1) AS interval_block_1_power_last,
    round((((((segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_hr_mean'::text))::double precision)::numeric, 1) AS interval_block_1_hr_mean,
    round((((((segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_hr_last'::text))::double precision)::numeric, 1) AS interval_block_1_hr_last,
    round((((((segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_pace_mean'::text))::double precision)::numeric, 2) AS interval_block_1_pace_mean,
    round((((((segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_pace_last'::text))::double precision)::numeric, 2) AS interval_block_1_pace_last,
        CASE
            WHEN ((((segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_pace_mean'::text) IS NULL) THEN NULL::text
            ELSE to_char((((((segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_pace_mean'::text))::double precision * '00:01:00'::interval), 'FMMI''SS"/km"')
        END AS interval_block_1_pace_mean_fmt,
        CASE
            WHEN ((((segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_pace_last'::text) IS NULL) THEN NULL::text
            ELSE to_char((((((segmented_metrics -> 'interval_blocks'::text) -> 0) ->> 'interval_pace_last'::text))::double precision * '00:01:00'::interval), 'FMMI''SS"/km"')
        END AS interval_block_1_pace_last_fmt,
    round((((((segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_power_mean'::text))::double precision)::numeric, 1) AS interval_block_2_power_mean,
    round((((((segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_power_last'::text))::double precision)::numeric, 1) AS interval_block_2_power_last,
    round((((((segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_hr_mean'::text))::double precision)::numeric, 1) AS interval_block_2_hr_mean,
    round((((((segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_hr_last'::text))::double precision)::numeric, 1) AS interval_block_2_hr_last,
    round((((((segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_pace_mean'::text))::double precision)::numeric, 2) AS interval_block_2_pace_mean,
    round((((((segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_pace_last'::text))::double precision)::numeric, 2) AS interval_block_2_pace_last,
        CASE
            WHEN ((((segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_pace_mean'::text) IS NULL) THEN NULL::text
            ELSE to_char((((((segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_pace_mean'::text))::double precision * '00:01:00'::interval), 'FMMI''SS"/km"')
        END AS interval_block_2_pace_mean_fmt,
        CASE
            WHEN ((((segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_pace_last'::text) IS NULL) THEN NULL::text
            ELSE to_char((((((segmented_metrics -> 'interval_blocks'::text) -> 1) ->> 'interval_pace_last'::text))::double precision * '00:01:00'::interval), 'FMMI''SS"/km"')
        END AS interval_block_2_pace_last_fmt,
    session_group_type,
    session_group_id,
    session_group_role,
    session_group_order,
    "MLS",
    "Source"
   FROM pace_data
  ORDER BY session_date DESC;
