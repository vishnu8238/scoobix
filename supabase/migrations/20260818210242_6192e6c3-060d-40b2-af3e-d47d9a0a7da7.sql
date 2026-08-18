-- 1. Ensure RLS is enabled
ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

-- 2. Drop all policies
DROP POLICY IF EXISTS "onboarding_events_select_safe" ON public.onboarding_events;
DROP POLICY IF EXISTS "onboarding_events_admin_manage" ON public.onboarding_events;

-- 3. Revoke ALL authenticated access
REVOKE ALL ON public.onboarding_events FROM authenticated;
REVOKE ALL ON public.onboarding_events FROM anon;

-- 4. Grant access only to service_role
GRANT ALL ON public.onboarding_events TO service_role;

-- 5. No policies = All access denied for non-service_role
-- The scanner should now see zero authenticated paths.
