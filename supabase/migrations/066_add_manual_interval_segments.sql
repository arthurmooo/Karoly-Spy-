ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS manual_interval_segments jsonb;

COMMENT ON COLUMN public.activities.manual_interval_segments IS
'Canonical manual interval reps grouped by block: [{block_index, segments:[{start_sec,end_sec,duration_sec,distance_m,avg_speed,avg_power,avg_hr}]}]';
