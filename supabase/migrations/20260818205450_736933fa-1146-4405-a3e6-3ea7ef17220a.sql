-- 1. Ensure RLS is active
ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

-- 2. Drop vulnerable policies
DROP POLICY IF EXISTS "Managers can insert events for owned restaurants" ON public.onboarding_events;
DROP POLICY IF EXISTS "Managers can view events for owned restaurants" ON public.onboarding_events;
DROP POLICY IF EXISTS "Admins have full access to onboarding events" ON public.onboarding_events;
DROP POLICY IF EXISTS "Managers cannot update events" ON public.onboarding_events;
DROP POLICY IF EXISTS "Managers cannot delete events" ON public.onboarding_events;

-- 3. Grants: Authenticated can SELECT and INSERT, only service_role/admin can UPDATE/DELETE
GRANT SELECT, INSERT ON public.onboarding_events TO authenticated;
GRANT ALL ON public.onboarding_events TO service_role;

-- 4. INSERT Policy: Only the owner of the restaurant can create an event
CREATE POLICY "onboarding_events_insert"
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

-- 5. SELECT Policy: Only the owner of the restaurant or an admin can view events
CREATE POLICY "onboarding_events_select"
ON public.onboarding_events
FOR SELECT
TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = onboarding_events.restaurant_id
    AND r.owner_id::text = auth.uid()::text
  )) OR
  (public.has_role(auth.uid(), 'admin'))
);

-- 6. UPDATE/DELETE Policies: Strictly restricted to admins (moderator also permitted for logistics operations)
CREATE POLICY "onboarding_events_admin_all"
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
