-- 1. Create a function to enforce manager_id matches auth.uid()
CREATE OR REPLACE FUNCTION public.enforce_onboarding_event_manager()
RETURNS TRIGGER AS $$
BEGIN
  -- Force manager_id to be the current user
  NEW.manager_id := auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS tr_enforce_onboarding_event_manager ON public.onboarding_events;
CREATE TRIGGER tr_enforce_onboarding_event_manager
BEFORE INSERT OR UPDATE ON public.onboarding_events
FOR EACH ROW
EXECUTE FUNCTION public.enforce_onboarding_event_manager();

-- 3. Ensure table is fully locked for public/authenticated access
ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onboarding_events FROM authenticated, anon;
GRANT ALL ON public.onboarding_events TO service_role;
