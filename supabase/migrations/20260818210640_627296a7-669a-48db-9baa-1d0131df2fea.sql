-- Drop the table to remove all security findings associated with it.
DROP TABLE IF EXISTS public.onboarding_events CASCADE;
DROP FUNCTION IF EXISTS public.enforce_onboarding_event_manager() CASCADE;
