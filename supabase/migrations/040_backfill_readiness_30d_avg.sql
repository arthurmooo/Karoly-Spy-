-- Backfill rmssd_30d_avg and resting_hr_30d_avg for all existing daily_readiness rows
UPDATE public.daily_readiness dr
SET
  rmssd_30d_avg = sub.rmssd_avg,
  resting_hr_30d_avg = sub.hr_avg
FROM (
  SELECT
    athlete_id,
    date,
    AVG(rmssd) OVER (
      PARTITION BY athlete_id
      ORDER BY date
      ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
    ) AS rmssd_avg,
    AVG(resting_hr) OVER (
      PARTITION BY athlete_id
      ORDER BY date
      ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
    ) AS hr_avg
  FROM public.daily_readiness
  WHERE rmssd IS NOT NULL OR resting_hr IS NOT NULL
) sub
WHERE dr.athlete_id = sub.athlete_id AND dr.date = sub.date;
