-- View: view_performance_audit
-- Description: Detailed analysis of decoupling and drift for competitions
-- Source: Back-ported from Supabase Production 2026-01-25

CREATE OR REPLACE VIEW view_performance_audit AS
 WITH decoupling_calc AS (
         SELECT act.id,
            ((((act.segmented_metrics -> 'splits_4'::text) -> 'phase_1'::text) ->> 'ratio'::text))::double precision AS r1,
            ((((act.segmented_metrics -> 'splits_4'::text) -> 'phase_2'::text) ->> 'ratio'::text))::double precision AS r2,
            ((((act.segmented_metrics -> 'splits_4'::text) -> 'phase_3'::text) ->> 'ratio'::text))::double precision AS r3,
            ((((act.segmented_metrics -> 'splits_4'::text) -> 'phase_4'::text) ->> 'ratio'::text))::double precision AS r4
           FROM activities act
        )
 SELECT a.session_date::date AS date,
    ((ath.first_name || ' '::text) || ath.last_name) AS athlete,
    COALESCE(a.source_sport, a.sport_type) AS sport,
    COALESCE(a.activity_name, ('Session '::text || a.nolio_id)) AS course_name,
    round(((a.duration_sec / (60.0)::double precision))::numeric, 1) AS temps_min,
    round(((a.distance_m / (1000.0)::double precision))::numeric, 2) AS dist_totale_km,
    round(((dc.r1 / dc.r1))::numeric, 2) AS decoupling_q1,
    round(((dc.r2 / dc.r1))::numeric, 2) AS decoupling_q2,
    round(((dc.r3 / dc.r1))::numeric, 2) AS decoupling_q3,
    round(((dc.r4 / dc.r1))::numeric, 2) AS decoupling_q4,
    ((a.segmented_metrics ->> 'drift_percent'::text))::double precision AS derive_totale_pct
   FROM ((activities a
     JOIN athletes ath ON ((a.athlete_id = ath.id)))
     JOIN decoupling_calc dc ON ((a.id = dc.id)))
  WHERE (a.work_type = 'competition'::text)
  ORDER BY a.session_date DESC;
