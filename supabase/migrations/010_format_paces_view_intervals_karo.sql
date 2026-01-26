-- Migration: Format paces to M'SS in view_intervals_karo
-- Date: 2026-01-26

DROP VIEW IF EXISTS view_intervals_karo;

CREATE VIEW view_intervals_karo AS
 SELECT (a.session_date)::date AS date,
    ((ath.first_name || ' '::text) || ath.last_name) AS athlete,
    a.activity_name AS seance,
    COALESCE(a.source_sport, a.sport_type) AS sport,
        CASE
            WHEN ((lower(COALESCE(a.source_sport, a.sport_type)) !~~ '%run%'::text) AND (lower(COALESCE(a.source_sport, a.sport_type)) !~~ '%course%'::text) AND (lower(COALESCE(a.source_sport, a.sport_type)) !~~ '%trail%'::text)) THEN a.interval_power_last
            ELSE NULL::double precision
        END AS "Puissance (W)",
        CASE
            WHEN ((lower(COALESCE(a.source_sport, a.sport_type)) ~~ '%run%'::text) OR (lower(COALESCE(a.source_sport, a.sport_type)) ~~ '%course%'::text) OR (lower(COALESCE(a.source_sport, a.sport_type)) ~~ '%trail%'::text)) THEN 
                CASE 
                    WHEN a.interval_pace_last IS NOT NULL THEN (FLOOR(a.interval_pace_last)::text || '''' || TO_CHAR(MOD((a.interval_pace_last * 60)::numeric, 60), 'FM00'))
                    ELSE NULL
                END
            ELSE NULL
        END AS "Allure (min/km)",
    a.interval_hr_last AS "HRmean (bpm)",
        CASE
            WHEN ((lower(COALESCE(a.source_sport, a.sport_type)) !~~ '%run%'::text) AND (lower(COALESCE(a.source_sport, a.sport_type)) !~~ '%course%'::text) AND (lower(COALESCE(a.source_sport, a.sport_type)) !~~ '%trail%'::text)) THEN a.interval_power_mean
            ELSE NULL::double precision
        END AS "Pmoy (W)",
        CASE
            WHEN ((lower(COALESCE(a.source_sport, a.sport_type)) ~~ '%run%'::text) OR (lower(COALESCE(a.source_sport, a.sport_type)) ~~ '%course%'::text) OR (lower(COALESCE(a.source_sport, a.sport_type)) ~~ '%trail%'::text)) THEN 
                CASE 
                    WHEN a.interval_pace_mean IS NOT NULL THEN (FLOOR(a.interval_pace_mean)::text || '''' || TO_CHAR(MOD((a.interval_pace_mean * 60)::numeric, 60), 'FM00'))
                    ELSE NULL
                END
            ELSE NULL
        END AS "Amoy (min/km)",
    a.interval_hr_mean AS "HRmean W (bpm)",
    a.interval_detection_source AS "Detection"
   FROM (activities a
     JOIN athletes ath ON ((a.athlete_id = ath.id)))
  WHERE (a.work_type = 'intervals'::text)
  ORDER BY a.session_date DESC;
