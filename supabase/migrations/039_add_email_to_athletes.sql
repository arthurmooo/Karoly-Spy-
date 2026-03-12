ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill Steven Galibert's email
UPDATE public.athletes
SET email = 'galibert.steven81@hotmail.fr'
WHERE lower(first_name) = 'steven' AND lower(last_name) = 'galibert';
