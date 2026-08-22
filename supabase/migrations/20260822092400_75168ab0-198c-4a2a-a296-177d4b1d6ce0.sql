-- 1. Table Grants
GRANT SELECT ON public.restaurants TO anon, authenticated;
GRANT SELECT ON public.users TO anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.portal_access TO authenticated;

-- 2. RLS Security
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public restaurants are viewable by everyone" ON public.restaurants;
CREATE POLICY "Public restaurants are viewable by everyone"
ON public.restaurants FOR SELECT
TO anon, authenticated
USING (true); -- Broad access until archived column is confirmed

-- 3. Service Access
GRANT ALL ON public.restaurants TO service_role;
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.user_roles TO service_role;
GRANT ALL ON public.portal_access TO service_role;
