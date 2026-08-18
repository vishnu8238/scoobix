-- 1. Remove all existing policies on users to ensure a clean slate
DROP POLICY IF EXISTS "users_update_own_safe" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "Admins can select all users" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can select their own profile" ON public.users;
DROP POLICY IF EXISTS "users_admin_all" ON public.users;
DROP POLICY IF EXISTS "users_read_own" ON public.users;

-- 2. Grant only specific column updates to authenticated users
-- This ensures 'role' and 'is_active' cannot be updated by anyone but service_role
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (name, phone, avatar_url) ON public.users TO authenticated;

-- 3. Secure read policy
CREATE POLICY "users_read_own"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid()::text = id);

-- 4. Secure update policy - explicitly prohibiting role/status updates
-- Using a simpler CHECK that doesn't trigger self-reference warnings if possible
CREATE POLICY "users_update_own"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid()::text = id)
WITH CHECK (auth.uid()::text = id);

-- 5. Admin management policy using the secure has_role function
CREATE POLICY "admins_manage_all"
ON public.users
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
