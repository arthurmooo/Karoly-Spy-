ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS activity_streams jsonb,
  ADD COLUMN IF NOT EXISTS garmin_laps jsonb;

COMMENT ON COLUMN activities.activity_streams IS 'Downsampled 5s stream points [{t,hr,spd,pwr,cad,alt}]';
COMMENT ON COLUMN activities.garmin_laps IS 'Garmin LAP records [{lap_n,start,dur,dist,avg_hr,avg_spd,avg_pwr,avg_cad}]';
