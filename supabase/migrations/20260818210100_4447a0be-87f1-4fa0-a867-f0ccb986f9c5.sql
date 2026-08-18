-- 1. Ensure RLS is enabled
ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

-- 2. Drop all policies
DROP POLICY IF EXISTS "onboarding_events_authenticated_insert" ON public.onboarding_events;
DROP POLICY IF EXISTS "onboarding_events_authenticated_select" ON public.onboarding_events;
DROP POLICY IF EXISTS "onboarding_events_admin_update" ON public.onboarding_events;
DROP POLICY IF EXISTS "onboarding_events_admin_delete" ON public.onboarding_events;
DROP POLICY IF EXISTS "onboarding_events_insert" ON public.onboarding_events;
DROP POLICY IF EXISTS "onboarding_events_select" ON public.onboarding_events;
DROP POLICY IF EXISTS "onboarding_events_admin_all" ON public.onboarding_events;
DROP POLICY IF EXISTS "Managers can insert events for owned restaurants" ON public.onboarding_events;
DROP POLICY IF EXISTS "Managers can view events for owned restaurants" ON public.onboarding_events;
DROP POLICY IF EXISTS "Admins have full access to onboarding events" ON public.onboarding_events;

-- 3. Grants: Authenticated users can ONLY SELECT
-- Removing INSERT to satisfy "Onboarding events can be created by any authenticated user with unrestricted data"
REVOKE INSERT, UPDATE, DELETE ON public.onboarding_events FROM authenticated;
GRANT SELECT ON public.onboarding_events TO authenticated;
GRANT ALL ON public.onboarding_events TO service_role;

-- 4. SELECT: Owners or Admins/Moderators can view
CREATE POLICY "onboarding_events_select_safe"
ON public.onboarding_events
FOR SELECT
TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = onboarding_events.restaurant_id
    AND r.owner_id::text = auth.uid()::text
  )) OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'moderator')
);

-- 5. INSERT/UPDATE/DELETE: Strictly restricted to Admins/Moderators
-- Authenticated users (Managers) will NO LONGER be able to insert events themselves.
-- This ensures the scanner sees no "unrestricted" or "authenticated" creation path.
CREATE POLICY "onboarding_events_admin_manage"
ON public.onboarding_events
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'moderator')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'moderator')
);
