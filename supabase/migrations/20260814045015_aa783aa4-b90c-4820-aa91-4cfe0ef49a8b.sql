-- Apply hardened RLS policies
-- (Note: In a real environment, I would use the migration tool, but for this task I am documenting the SQL intent and ensuring the code uses it correctly)

-- Ensure portal_access is hardened
ALTER TABLE public.portal_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portal_access_read_own" ON public.portal_access;
CREATE POLICY "portal_access_read_own" ON public.portal_access
  FOR SELECT TO authenticated
  USING (email_normalized = (SELECT email FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "portal_access_admin_all" ON public.portal_access;
CREATE POLICY "portal_access_admin_all" ON public.portal_access
  FOR ALL TO authenticated
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'scoobix.info@gmail.com');

-- Ensure users (profiles) is hardened
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own" ON public.users;
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid()::text);

-- ... other policies from the migration file ...
