ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS manual_activity_name text;

COMMENT ON COLUMN public.activities.manual_activity_name IS
  'Nom de séance surchargé manuellement côté coach.';
