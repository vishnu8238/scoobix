-- Explicitly revoke execute from anon and authenticated to satisfy linter
REVOKE EXECUTE ON FUNCTION public.enforce_onboarding_event_manager() FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_onboarding_event_manager() FROM authenticated;

-- Ensure it's still granted to service_role for trigger execution
GRANT EXECUTE ON FUNCTION public.enforce_onboarding_event_manager() TO service_role;
