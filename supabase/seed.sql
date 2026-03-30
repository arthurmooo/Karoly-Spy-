-- Deterministic seed used by local E2E and CI.
-- Auth users are created separately by web/scripts/e2e-auth-fixtures.mjs

INSERT INTO public.athletes (
  id,
  first_name,
  last_name,
  nolio_id,
  start_date,
  is_active,
  email
)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  'Athlete',
  'E2E',
  'nolio-e2e-athlete',
  CURRENT_DATE - INTERVAL '90 days',
  true,
  'athlete.e2e@projectk.test'
)
ON CONFLICT (id) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  nolio_id = EXCLUDED.nolio_id,
  start_date = EXCLUDED.start_date,
  is_active = EXCLUDED.is_active,
  email = EXCLUDED.email;

INSERT INTO public.physio_profiles (
  id,
  athlete_id,
  sport,
  lt1_hr,
  lt2_hr,
  lt1_power_pace,
  lt2_power_pace,
  cp_cs,
  weight,
  valid_from
)
VALUES (
  '55555555-5555-4555-8555-555555555555',
  '33333333-3333-4333-8333-333333333333',
  'CAP',
  145,
  168,
  4.2,
  5.1,
  5.4,
  68.5,
  NOW() - INTERVAL '120 days'
)
ON CONFLICT (id) DO UPDATE
SET
  athlete_id = EXCLUDED.athlete_id,
  sport = EXCLUDED.sport,
  lt1_hr = EXCLUDED.lt1_hr,
  lt2_hr = EXCLUDED.lt2_hr,
  lt1_power_pace = EXCLUDED.lt1_power_pace,
  lt2_power_pace = EXCLUDED.lt2_power_pace,
  cp_cs = EXCLUDED.cp_cs,
  weight = EXCLUDED.weight,
  valid_from = EXCLUDED.valid_from;

INSERT INTO public.activities (
  id,
  athlete_id,
  nolio_id,
  session_date,
  sport_type,
  source_sport,
  activity_name,
  duration_sec,
  moving_time_sec,
  distance_m,
  rpe,
  load_index,
  durability_index,
  decoupling_index,
  avg_hr,
  work_type,
  athlete_feedback_rating,
  athlete_feedback_text,
  coach_comment,
  athlete_comment,
  source_json
)
VALUES (
  '44444444-4444-4444-8444-444444444444',
  '33333333-3333-4333-8333-333333333333',
  'nolio-e2e-activity',
  (CURRENT_DATE - INTERVAL '1 day') + TIME '07:30',
  'CAP',
  'Run',
  'Footing E2E du jour',
  3900,
  3840,
  12000,
  5,
  4.6,
  0.97,
  2.1,
  148,
  'Endurance',
  NULL,
  NULL,
  NULL,
  NULL,
  jsonb_build_object(
    'rpe', 5,
    'feeling', 3,
    'description', 'Séance seedée pour les parcours E2E'
  )
)
ON CONFLICT (id) DO UPDATE
SET
  athlete_id = EXCLUDED.athlete_id,
  nolio_id = EXCLUDED.nolio_id,
  session_date = EXCLUDED.session_date,
  sport_type = EXCLUDED.sport_type,
  source_sport = EXCLUDED.source_sport,
  activity_name = EXCLUDED.activity_name,
  duration_sec = EXCLUDED.duration_sec,
  moving_time_sec = EXCLUDED.moving_time_sec,
  distance_m = EXCLUDED.distance_m,
  rpe = EXCLUDED.rpe,
  load_index = EXCLUDED.load_index,
  durability_index = EXCLUDED.durability_index,
  decoupling_index = EXCLUDED.decoupling_index,
  avg_hr = EXCLUDED.avg_hr,
  work_type = EXCLUDED.work_type,
  athlete_feedback_rating = NULL,
  athlete_feedback_text = NULL,
  coach_comment = NULL,
  athlete_comment = NULL,
  source_json = EXCLUDED.source_json;

WITH readiness_seed AS (
  SELECT
    '33333333-3333-4333-8333-333333333333'::uuid AS athlete_id,
    (CURRENT_DATE - gs.day_offset)::date AS date,
    CASE
      WHEN gs.day_offset <= 6 THEN (28 + (gs.day_offset % 3))::double precision
      ELSE (60 + ((gs.day_offset % 5) - 2))::double precision
    END AS rmssd,
    CASE
      WHEN gs.day_offset <= 6 THEN (55 + (gs.day_offset % 2))::double precision
      ELSE (47 + (gs.day_offset % 3))::double precision
    END AS resting_hr,
    7.4::double precision AS sleep_duration,
    82::double precision AS sleep_score,
    4::double precision AS sleep_quality,
    4::double precision AS mental_energy,
    CASE WHEN gs.day_offset <= 6 THEN 2::double precision ELSE 4::double precision END AS fatigue,
    4::double precision AS lifestyle,
    4::double precision AS muscle_soreness,
    4::double precision AS physical_condition,
    4::double precision AS training_performance,
    CASE WHEN gs.day_offset <= 6 THEN 3::double precision ELSE 5::double precision END AS training_rpe,
    CASE WHEN gs.day_offset <= 6 THEN 42::double precision ELSE 68::double precision END AS recovery_points,
    NULL::text AS sickness,
    NULL::text AS alcohol
  FROM generate_series(34, 0, -1) AS gs(day_offset)
),
readiness_windowed AS (
  SELECT
    athlete_id,
    date,
    rmssd,
    resting_hr,
    sleep_duration,
    sleep_score,
    sleep_quality,
    mental_energy,
    fatigue,
    lifestyle,
    muscle_soreness,
    physical_condition,
    training_performance,
    training_rpe,
    recovery_points,
    sickness,
    alcohol,
    ROUND(
      AVG(rmssd) OVER (
        PARTITION BY athlete_id
        ORDER BY date
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
      )::numeric,
      1
    )::double precision AS rmssd_30d_avg,
    ROUND(
      AVG(resting_hr) OVER (
        PARTITION BY athlete_id
        ORDER BY date
        ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
      )::numeric,
      1
    )::double precision AS resting_hr_30d_avg
  FROM readiness_seed
)
INSERT INTO public.daily_readiness (
  athlete_id,
  date,
  rmssd,
  resting_hr,
  sleep_duration,
  sleep_score,
  sleep_quality,
  mental_energy,
  fatigue,
  lifestyle,
  muscle_soreness,
  physical_condition,
  training_performance,
  training_rpe,
  recovery_points,
  sickness,
  alcohol,
  rmssd_30d_avg,
  resting_hr_30d_avg
)
SELECT
  athlete_id,
  date,
  rmssd,
  resting_hr,
  sleep_duration,
  sleep_score,
  sleep_quality,
  mental_energy,
  fatigue,
  lifestyle,
  muscle_soreness,
  physical_condition,
  training_performance,
  training_rpe,
  recovery_points,
  sickness,
  alcohol,
  rmssd_30d_avg,
  resting_hr_30d_avg
FROM readiness_windowed
ON CONFLICT (athlete_id, date) DO UPDATE
SET
  rmssd = EXCLUDED.rmssd,
  resting_hr = EXCLUDED.resting_hr,
  sleep_duration = EXCLUDED.sleep_duration,
  sleep_score = EXCLUDED.sleep_score,
  sleep_quality = EXCLUDED.sleep_quality,
  mental_energy = EXCLUDED.mental_energy,
  fatigue = EXCLUDED.fatigue,
  lifestyle = EXCLUDED.lifestyle,
  muscle_soreness = EXCLUDED.muscle_soreness,
  physical_condition = EXCLUDED.physical_condition,
  training_performance = EXCLUDED.training_performance,
  training_rpe = EXCLUDED.training_rpe,
  recovery_points = EXCLUDED.recovery_points,
  sickness = EXCLUDED.sickness,
  alcohol = EXCLUDED.alcohol,
  rmssd_30d_avg = EXCLUDED.rmssd_30d_avg,
  resting_hr_30d_avg = EXCLUDED.resting_hr_30d_avg;
