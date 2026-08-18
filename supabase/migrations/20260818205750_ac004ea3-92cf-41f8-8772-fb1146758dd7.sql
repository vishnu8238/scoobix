-- 1. Ensure RLS is enabled
ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

-- 2. Drop all policies to start fresh
DROP POLICY IF EXISTS "onboarding_events_insert" ON public.onboarding_events;
DROP POLICY IF EXISTS "onboarding_events_select" ON public.onboarding_events;
DROP POLICY IF EXISTS "onboarding_events_admin_all" ON public.onboarding_events;
DROP POLICY IF EXISTS "Managers can insert events for owned restaurants" ON public.onboarding_events;
DROP POLICY IF EXISTS "Managers can view events for owned restaurants" ON public.onboarding_events;
DROP POLICY IF EXISTS "Admins have full access to onboarding events" ON public.onboarding_events;
DROP POLICY IF EXISTS "Managers cannot update events" ON public.onboarding_events;
DROP POLICY IF EXISTS "Managers cannot delete events" ON public.onboarding_events;

-- 3. Grants: Authenticated users can only SELECT and INSERT
GRANT SELECT, INSERT ON public.onboarding_events TO authenticated;
GRANT ALL ON public.onboarding_events TO service_role;

-- 4. INSERT: Only the owner of the restaurant can create an event
CREATE POLICY "onboarding_events_authenticated_insert"
ON public.onboarding_events
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = onboarding_events.restaurant_id
    AND r.owner_id::text = auth.uid()::text
  )
);

-- 5. SELECT: Owners or Admins/Moderators can view
CREATE POLICY "onboarding_events_authenticated_select"
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

-- 6. UPDATE/DELETE: Explicitly restricted to Admins/Moderators
-- This covers the scanner's concern about "unrestricted data" updates
CREATE POLICY "onboarding_events_admin_update"
ON public.onboarding_events
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'moderator')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'moderator')
);

CREATE POLICY "onboarding_events_admin_delete"
ON public.onboarding_events
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'moderator')
);
