-- 1. Fix search_path and restrict execution for the security definer function
ALTER FUNCTION public.enforce_onboarding_event_manager() 
SET search_path = public
SECURITY DEFINER;

-- 2. Revoke execute from public (includes anon and authenticated)
REVOKE EXECUTE ON FUNCTION public.enforce_onboarding_event_manager() FROM PUBLIC;

-- 3. Only allow service_role to execute (or other specific roles if needed, but here it's for the trigger)
GRANT EXECUTE ON FUNCTION public.enforce_onboarding_event_manager() TO service_role;
