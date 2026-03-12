-- User profiles: links auth.users to app roles
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'coach' CHECK (role IN ('coach', 'athlete')),
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Service role full access on user_profiles" ON public.user_profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Coach FK on athletes
ALTER TABLE public.athletes ADD COLUMN IF NOT EXISTS coach_id uuid REFERENCES public.user_profiles(id);

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

-- Coaches see only their own athletes
CREATE POLICY "Coaches can read own athletes" ON public.athletes
  FOR SELECT TO authenticated
  USING (coach_id = auth.uid());
