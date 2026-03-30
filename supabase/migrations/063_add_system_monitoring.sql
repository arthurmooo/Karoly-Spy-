-- System monitoring: key/value store for system metrics (storage, quotas, etc.)
CREATE TABLE public.system_monitoring (
  key TEXT PRIMARY KEY,
  value_gb NUMERIC(8,3),
  limit_gb NUMERIC(8,3),
  checked_at TIMESTAMPTZ DEFAULT now(),
  details JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.system_monitoring ENABLE ROW LEVEL SECURITY;

-- Service role can read/write
CREATE POLICY "service_role_full_access_system_monitoring"
  ON public.system_monitoring
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Coaches can read (dashboard widget)
CREATE POLICY "coach_read_system_monitoring"
  ON public.system_monitoring
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'coach');

-- RPC: get total storage usage in bytes for a given bucket
-- SECURITY DEFINER because storage.objects is not exposed via PostgREST
CREATE OR REPLACE FUNCTION public.get_storage_usage_bytes(bucket TEXT)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(SUM((metadata->>'size')::bigint), 0)
  FROM storage.objects
  WHERE bucket_id = bucket;
$$;

-- Seed: initial known value (1.34 GB, measured 2026-03-20)
INSERT INTO public.system_monitoring (key, value_gb, limit_gb, checked_at, details)
VALUES (
  'storage_raw_fits',
  1.340,
  100.000,
  now(),
  '{"file_count": 5400, "avg_file_kb": 248, "seed": true}'::jsonb
);
