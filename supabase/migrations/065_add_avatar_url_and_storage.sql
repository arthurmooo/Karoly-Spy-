-- 065: Add avatar_url column + avatars storage bucket
-- Athlete profile page: photo upload support

-- 1. Add avatar_url column to athletes
ALTER TABLE athletes ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- 2. Create avatars storage bucket (public, 2MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies

-- Anyone authenticated can read avatars (public bucket)
CREATE POLICY avatars_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

-- Athletes can upload/update their own avatar
CREATE POLICY avatars_athlete_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.get_my_athlete_id()::text
  );

CREATE POLICY avatars_athlete_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.get_my_athlete_id()::text
  );

CREATE POLICY avatars_athlete_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = public.get_my_athlete_id()::text
  );

-- Coaches can upload avatars for their athletes
CREATE POLICY avatars_coach_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM athletes WHERE coach_id = auth.uid()
    )
  );

CREATE POLICY avatars_coach_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM athletes WHERE coach_id = auth.uid()
    )
  );

-- 4. RLS: athletes can update their own avatar_url
CREATE POLICY athlete_update_own_avatar ON athletes
  FOR UPDATE
  TO authenticated
  USING (id = public.get_my_athlete_id())
  WITH CHECK (id = public.get_my_athlete_id());
