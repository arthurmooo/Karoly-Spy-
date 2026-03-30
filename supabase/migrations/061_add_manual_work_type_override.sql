ALTER TABLE public.activities
ADD COLUMN IF NOT EXISTS manual_work_type text,
ADD COLUMN IF NOT EXISTS detected_work_type text,
ADD COLUMN IF NOT EXISTS analysis_dirty boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.activities.manual_work_type IS
  'Type de séance surchargé manuellement côté coach.';

COMMENT ON COLUMN public.activities.detected_work_type IS
  'Type de séance détecté automatiquement par le classifier.';

COMMENT ON COLUMN public.activities.analysis_dirty IS
  'Indique que les analyses dérivées doivent être recalculées.';

UPDATE public.activities
SET
  detected_work_type = COALESCE(detected_work_type, work_type),
  manual_work_type = NULL,
  analysis_dirty = COALESCE(analysis_dirty, false);
