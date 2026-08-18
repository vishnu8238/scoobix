-- 1. Remove all existing privileges from public roles to reset access
REVOKE ALL ON public.user_roles FROM public, anon, authenticated;

-- 2. Grant only read access to authenticated users
GRANT SELECT ON public.user_roles TO authenticated;

-- 3. Ensure service_role retains full control
GRANT ALL ON public.user_roles TO service_role;

-- 4. Re-verify RLS is enabled
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. Drop the existing permissive policy if it exists and replace with a restrictive one
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
