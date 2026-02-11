-- Migration: 031_create_brick_sessions_view.sql
-- Description: Create grouped Brick view (Bike + Run) while keeping individual rows in monitoring view.
-- Date: 2026-02-11

CREATE OR REPLACE VIEW view_brick_sessions_karo AS
WITH grouped AS (
    SELECT
        a.session_group_id,
        a.athlete_id,
        MAX(CASE WHEN lower(a.sport_type) = 'bike' THEN a.id::text END) AS bike_activity_id,
        MAX(CASE WHEN lower(a.sport_type) = 'run' THEN a.id::text END) AS run_activity_id
    FROM activities a
    WHERE a.session_group_type = 'brick'
      AND a.session_group_id IS NOT NULL
    GROUP BY a.session_group_id, a.athlete_id
)
SELECT
    g.session_group_id,
    ath.first_name || ' ' || ath.last_name AS athlete,
    bike.session_date AS bike_session_date,
    bike.nolio_id AS bike_nolio_id,
    bike.activity_name AS bike_activity_name,
    bike.distance_m AS bike_distance_m,
    bike.duration_sec AS bike_duration_sec,
    bike.load_index AS bike_mls,
    bike.decoupling_index AS bike_decoupling_index,
    bike.avg_power AS bike_avg_power,
    bike.avg_hr AS bike_avg_hr,
    run.session_date AS run_session_date,
    run.nolio_id AS run_nolio_id,
    run.activity_name AS run_activity_name,
    run.distance_m AS run_distance_m,
    run.duration_sec AS run_duration_sec,
    run.load_index AS run_mls,
    run.decoupling_index AS run_decoupling_index,
    run.interval_pace_mean AS run_interval_pace_mean,
    run.interval_pace_last AS run_interval_pace_last,
    run.avg_hr AS run_avg_hr
FROM grouped g
JOIN athletes ath ON ath.id = g.athlete_id
JOIN activities bike ON bike.id::text = g.bike_activity_id
JOIN activities run ON run.id::text = g.run_activity_id
ORDER BY COALESCE(run.session_date, bike.session_date) DESC;
