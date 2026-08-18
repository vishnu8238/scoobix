-- Explicitly disable UPDATE and DELETE for non-admins on onboarding_events
DROP POLICY IF EXISTS "Managers cannot update events" ON public.onboarding_events;
DROP POLICY IF EXISTS "Managers cannot delete events" ON public.onboarding_events;

CREATE POLICY "Managers cannot update events"
ON public.onboarding_events
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers cannot delete events"
ON public.onboarding_events
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
