-- 1. Reset permissions
REVOKE ALL ON public.users FROM public, anon, authenticated;

-- 2. Grant least privilege
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (name, phone, avatar_url) ON public.users TO authenticated;

-- 3. Service role keeps all
GRANT ALL ON public.users TO service_role;

-- 4. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 5. Drop the vulnerable policy
DROP POLICY IF EXISTS "users_update_own" ON public.users;

-- 6. Add secure replacement for updates
CREATE POLICY "users_update_own_safe"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid()::text = id)
WITH CHECK (
  auth.uid()::text = id AND
  (CASE WHEN role IS DISTINCT FROM (SELECT role FROM public.users WHERE id = auth.uid()::text) THEN FALSE ELSE TRUE END) AND
  (CASE WHEN is_active IS DISTINCT FROM (SELECT is_active FROM public.users WHERE id = auth.uid()::text) THEN FALSE ELSE TRUE END)
);

-- 7. Ensure select is still possible
DROP POLICY IF EXISTS "users_read_own" ON public.users;
CREATE POLICY "users_read_own"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid()::text = id);
