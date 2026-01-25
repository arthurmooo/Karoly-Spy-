-- Migration: 011_view_intervals_deep_dive.sql
-- Description: Detailed view for each interval block to analyze intra-session fatigue.

CREATE OR REPLACE VIEW view_intervals_deep_dive AS
SELECT 
    (a.session_date)::date AS date,
    ath.first_name || ' ' || ath.last_name AS athlete,
    a.activity_name AS seance,
    ai.type AS bloc_type,
    ROUND((ai.duration / 60.0)::numeric, 2) AS duree_min,
    ROUND(ai.avg_power::numeric, 1) AS puissance_moy,
    ROUND(ai.avg_hr::numeric, 1) AS fc_moy,
    ROUND(ai.pa_hr_ratio::numeric, 3) AS ratio_efficacite,
    ROUND(ai.decoupling::numeric, 2) AS drift_interne_pct,
    ai.detection_source AS source
FROM activity_intervals ai
JOIN activities a ON ai.activity_id = a.id
JOIN athletes ath ON a.athlete_id = ath.id
ORDER BY a.session_date DESC, ai.start_time ASC;
