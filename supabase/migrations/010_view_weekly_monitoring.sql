-- Migration: 010_view_weekly_monitoring.sql
-- Description: Analytics views for weekly load and health trends.

-- 1. Vue Hebdomadaire (La "Matrice" Coach)
CREATE OR REPLACE VIEW view_weekly_monitoring AS
WITH weekly_stats AS (
    SELECT 
        athlete_id,
        date_trunc('week', session_date) AS week_start,
        SUM(load_index) AS total_mls,
        SUM(duration_sec) / 3600.0 AS total_hours,
        COUNT(*) AS session_count,
        AVG(CASE WHEN work_type = 'intervals' THEN load_index ELSE NULL END) AS avg_interval_mls
    FROM activities
    GROUP BY athlete_id, date_trunc('week', session_date)
)
SELECT 
    ath.first_name || ' ' || ath.last_name AS athlete,
    ws.week_start::date,
    ROUND(ws.total_mls::numeric, 1) AS mls_hebdo,
    ROUND(ws.total_hours::numeric, 1) AS heures_hebdo,
    ws.session_count AS nb_seances,
    ROUND(ws.avg_interval_mls::numeric, 1) AS mls_moyen_intervalles
FROM weekly_stats ws
JOIN athletes ath ON ws.athlete_id = ath.id
ORDER BY ws.week_start DESC, athlete;

-- 2. Dashboard "Alerte Fraîcheur" (Match Charge vs Santé)
CREATE OR REPLACE VIEW view_coach_alerts AS
WITH last_7d_load AS (
    SELECT 
        athlete_id,
        SUM(load_index) AS load_7d
    FROM activities
    WHERE session_date > (NOW() - INTERVAL '7 days')
    GROUP BY athlete_id
),
health_trend AS (
    SELECT 
        dr.athlete_id,
        dr.rmssd,
        dr.rmssd_30d_avg,
        dr.resting_hr
    FROM daily_readiness dr
    WHERE (dr.athlete_id, dr.date) IN (SELECT athlete_id, MAX(date) FROM daily_readiness GROUP BY athlete_id)
)
SELECT 
    ath.first_name || ' ' || ath.last_name AS athlete,
    ROUND(COALESCE(l7.load_7d, 0)::numeric, 1) AS charge_7j,
    ht.rmssd AS rmssd_matin,
    ROUND((ht.rmssd / NULLIF(ht.rmssd_30d_avg, 0))::numeric, 2) AS ratio_rmssd_30j,
    CASE 
        WHEN ht.rmssd < (ht.rmssd_30d_avg * 0.85) THEN '🔴 Alerte Fatigue'
        WHEN ht.rmssd < (ht.rmssd_30d_avg * 0.95) THEN '🟡 Vigilance'
        ELSE '🟢 OK'
    END AS statut_fraicheur
FROM athletes ath
LEFT JOIN last_7d_load l7 ON ath.id = l7.athlete_id
LEFT JOIN health_trend ht ON ath.id = ht.athlete_id
ORDER BY ratio_rmssd_30j ASC;
