-- 1. Revoke UPDATE and DELETE from authenticated role
REVOKE UPDATE, DELETE ON public.onboarding_events FROM authenticated;

-- 2. Ensure only service_role and admin can perform these actions
-- Policies already handle logic, but REVOKE is a stronger primitive.

-- 3. Confirm RLS is enabled
ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;
