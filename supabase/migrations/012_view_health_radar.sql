-- View: view_health_radar
-- Description: Monitoring of morning health markers relative to 30d averages
-- Source: Back-ported from Supabase Production 2026-01-25

CREATE OR REPLACE VIEW view_health_radar AS
 WITH latest_health AS (
         SELECT DISTINCT ON (daily_readiness.athlete_id) daily_readiness.athlete_id,
            daily_readiness.date,
            daily_readiness.rmssd,
            daily_readiness.resting_hr,
            daily_readiness.sleep_duration,
            daily_readiness.sleep_score,
            daily_readiness.rmssd_30d_avg,
            daily_readiness.resting_hr_30d_avg,
            daily_readiness.created_at
           FROM daily_readiness
          ORDER BY daily_readiness.athlete_id, daily_readiness.date DESC
        )
 SELECT ((ath.first_name || ' '::text) || ath.last_name) AS athlete,
    lh.date,
    lh.rmssd AS rmssd_matinal,
    lh.resting_hr AS fc_repos,
        CASE
            WHEN (lh.rmssd_30d_avg > (0)::double precision) THEN round(((((lh.rmssd / lh.rmssd_30d_avg) - (1)::double precision) * (100)::double precision))::numeric, 1)
            ELSE NULL::numeric
        END AS tendance_rmssd_pct,
    ( SELECT pp.weight
           FROM physio_profiles pp
          WHERE ((pp.athlete_id = lh.athlete_id) AND (pp.valid_from <= (lh.date + '1 day'::interval)))
          ORDER BY pp.valid_from DESC
         LIMIT 1) AS poids
   FROM (latest_health lh
     JOIN athletes ath ON ((lh.athlete_id = ath.id)))
  ORDER BY lh.date DESC;
