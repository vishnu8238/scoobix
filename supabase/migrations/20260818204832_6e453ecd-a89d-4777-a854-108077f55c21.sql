-- 1. Enable RLS (table should exist from previous partial run or be created if not)
CREATE TABLE IF NOT EXISTS public.onboarding_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid NOT NULL,
    manager_id uuid,
    status text,
    notes text,
    created_at timestamptz DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.onboarding_events ENABLE ROW LEVEL SECURITY;

-- 2. Grants
GRANT SELECT, INSERT ON public.onboarding_events TO authenticated;
GRANT ALL ON public.onboarding_events TO service_role;

-- 3. Policies with explicit casts
DROP POLICY IF EXISTS "Managers can insert events for owned restaurants" ON public.onboarding_events;
DROP POLICY IF EXISTS "Managers can view events for owned restaurants" ON public.onboarding_events;
DROP POLICY IF EXISTS "Admins have full access to onboarding events" ON public.onboarding_events;

CREATE POLICY "Managers can insert events for owned restaurants"
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

CREATE POLICY "Managers can view events for owned restaurants"
ON public.onboarding_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = onboarding_events.restaurant_id
    AND r.owner_id::text = auth.uid()::text
  )
);

CREATE POLICY "Admins have full access to onboarding events"
ON public.onboarding_events
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
