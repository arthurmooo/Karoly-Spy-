-- Expose LnRMSSD 7-day rolling average and dynamic SWC signal on the coach health view.

DROP VIEW IF EXISTS public.view_health_radar;

CREATE VIEW public.view_health_radar AS
WITH latest_health AS (
  SELECT DISTINCT ON (dr.athlete_id)
    dr.athlete_id,
    dr.date,
    dr.rmssd,
    dr.resting_hr,
    dr.sleep_duration,
    dr.sleep_score,
    dr.rmssd_30d_avg,
    dr.resting_hr_30d_avg,
    dr.created_at
  FROM public.daily_readiness dr
  ORDER BY dr.athlete_id, dr.date DESC
)
SELECT
  lh.athlete_id,
  ath.first_name || ' ' || ath.last_name AS athlete,
  lh.date,
  lh.rmssd AS rmssd_matinal,
  lh.resting_hr AS fc_repos,
  CASE
    WHEN lh.rmssd_30d_avg > 0 THEN ROUND((((lh.rmssd / lh.rmssd_30d_avg) - 1) * 100)::numeric, 1)
    ELSE NULL::numeric
  END AS tendance_rmssd_pct,
  (
    SELECT pp.weight
    FROM public.physio_profiles pp
    WHERE pp.athlete_id = lh.athlete_id
      AND pp.valid_from <= (lh.date + interval '1 day')
    ORDER BY pp.valid_from DESC
    LIMIT 1
  ) AS poids,
  CASE
    WHEN swc.current_points >= 4
      THEN ROUND(swc.ln_rmssd_7d_avg::numeric, 3)
    ELSE NULL::numeric
  END AS ln_rmssd_7d_avg,
  CASE
    WHEN swc.baseline_points >= 7
      THEN ROUND(swc.swc_mean_28d::numeric, 3)
    ELSE NULL::numeric
  END AS swc_mean_28d,
  CASE
    WHEN swc.baseline_points >= 7 AND swc.swc_sd_28d IS NOT NULL
      THEN ROUND((swc.swc_mean_28d - (0.5 * swc.swc_sd_28d))::numeric, 3)
    ELSE NULL::numeric
  END AS swc_low_28d,
  CASE
    WHEN swc.baseline_points >= 7 AND swc.swc_sd_28d IS NOT NULL
      THEN ROUND((swc.swc_mean_28d + (0.5 * swc.swc_sd_28d))::numeric, 3)
    ELSE NULL::numeric
  END AS swc_high_28d,
  CASE
    WHEN swc.current_points < 4 OR swc.baseline_points < 7 OR swc.swc_sd_28d IS NULL
      THEN 'insufficient_data'::text
    WHEN swc.ln_rmssd_7d_avg < (swc.swc_mean_28d - (0.5 * swc.swc_sd_28d))
      THEN 'below_swc'::text
    WHEN swc.ln_rmssd_7d_avg > (swc.swc_mean_28d + (0.5 * swc.swc_sd_28d))
      THEN 'above_swc'::text
    ELSE 'within_swc'::text
  END AS swc_status,
  CASE
    WHEN swc.current_points < 4 OR swc.baseline_points < 7 OR swc.swc_sd_28d IS NULL
      THEN NULL::text
    WHEN swc.ln_rmssd_7d_avg < (swc.swc_mean_28d - (0.5 * swc.swc_sd_28d))
      OR swc.ln_rmssd_7d_avg > (swc.swc_mean_28d + (0.5 * swc.swc_sd_28d))
      THEN 'low/rest'::text
    ELSE 'normal'::text
  END AS swc_recommendation
FROM latest_health lh
JOIN public.athletes ath ON ath.id = lh.athlete_id
LEFT JOIN LATERAL (
  SELECT
    (
      SELECT AVG(LN(curr.rmssd))
      FROM public.daily_readiness curr
      WHERE curr.athlete_id = lh.athlete_id
        AND curr.date >= (lh.date - interval '6 days')
        AND curr.date <= lh.date
        AND curr.rmssd > 0
    ) AS ln_rmssd_7d_avg,
    (
      SELECT COUNT(*)
      FROM public.daily_readiness curr
      WHERE curr.athlete_id = lh.athlete_id
        AND curr.date >= (lh.date - interval '6 days')
        AND curr.date <= lh.date
        AND curr.rmssd > 0
    ) AS current_points,
    (
      SELECT AVG(LN(hist.rmssd))
      FROM public.daily_readiness hist
      WHERE hist.athlete_id = lh.athlete_id
        AND hist.date >= (lh.date - interval '28 days')
        AND hist.date < lh.date
        AND hist.rmssd > 0
    ) AS swc_mean_28d,
    (
      SELECT STDDEV_SAMP(LN(hist.rmssd))
      FROM public.daily_readiness hist
      WHERE hist.athlete_id = lh.athlete_id
        AND hist.date >= (lh.date - interval '28 days')
        AND hist.date < lh.date
        AND hist.rmssd > 0
    ) AS swc_sd_28d,
    (
      SELECT COUNT(*)
      FROM public.daily_readiness hist
      WHERE hist.athlete_id = lh.athlete_id
        AND hist.date >= (lh.date - interval '28 days')
        AND hist.date < lh.date
        AND hist.rmssd > 0
    ) AS baseline_points
) swc ON TRUE
ORDER BY lh.date DESC;
