-- Enable RLS and establish policies for portal access and profiles
-- 1. portal_access
ALTER TABLE public.portal_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portal_access_read_own" ON public.portal_access;
CREATE POLICY "portal_access_read_own" ON public.portal_access
  FOR SELECT TO authenticated
  USING (email_normalized = (SELECT email FROM auth.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "portal_access_admin_all" ON public.portal_access;
CREATE POLICY "portal_access_admin_all" ON public.portal_access
  FOR ALL TO authenticated
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'scoobix.info@gmail.com');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_access TO authenticated;
GRANT ALL ON public.portal_access TO service_role;

-- 2. users (profiles)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_read_own" ON public.users;
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid()::text);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid()::text);

DROP POLICY IF EXISTS "users_admin_all" ON public.users;
CREATE POLICY "users_admin_all" ON public.users
  FOR ALL TO authenticated
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'scoobix.info@gmail.com');

GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
