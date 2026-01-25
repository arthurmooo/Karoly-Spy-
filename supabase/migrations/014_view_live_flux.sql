-- View: view_live_flux
-- Description: Real-time feed of ingested activities with MLS and decoupling
-- Source: Back-ported from Supabase Production 2026-01-25

CREATE OR REPLACE VIEW view_live_flux AS
 SELECT (a.session_date AT TIME ZONE 'UTC'::text) AS date_heure,
    ((ath.first_name || ' '::text) || ath.last_name) AS athlete,
    a.activity_name AS seance,
        CASE
            WHEN (a.work_type = 'intervals'::text) THEN 'Intervalle'::text
            WHEN (a.work_type = 'endurance'::text) THEN 'Endurance'::text
            WHEN (a.work_type = 'competition'::text) THEN 'Compétition'::text
            ELSE initcap(a.work_type)
        END AS type_seance,
    COALESCE(a.source_sport, a.sport_type) AS sport,
    a.load_index AS mls,
    a.rpe,
    round(((((((a.segmented_metrics -> 'splits_2'::text) -> 'phase_2'::text) ->> 'ratio'::text))::double precision / ((((a.segmented_metrics -> 'splits_2'::text) -> 'phase_1'::text) ->> 'ratio'::text))::double precision))::numeric, 2) AS decouplage,
    round(((a.duration_sec / (60.0)::double precision))::numeric, 1) AS duree_min,
    round(((a.distance_m / (1000.0)::double precision))::numeric, 2) AS km,
    a.avg_hr AS bpm_moyen,
    a.temp_avg AS temp,
    a.humidity_avg AS hum
   FROM (activities a
     JOIN athletes ath ON ((a.athlete_id = ath.id)))
  ORDER BY a.session_date DESC;
