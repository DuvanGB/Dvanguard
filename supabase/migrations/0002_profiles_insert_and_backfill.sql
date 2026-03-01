-- Allow authenticated users to create their own profile row when missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_insert_own'
  ) THEN
    CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Backfill profiles for users created before triggers/migrations were applied.
INSERT INTO public.profiles (id, email)
SELECT id, COALESCE(email, '')
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email
WHERE public.profiles.email IS DISTINCT FROM EXCLUDED.email;
