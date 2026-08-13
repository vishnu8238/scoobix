-- Standardize RLS policies for shared visibility between Admin and Logistics
-- Using public.users.id::text for comparison with auth.uid()::text
-- Table names: drivers, orders, gigs, logistics_zones, subzones, live_tracking, dispatch_history

-- DRIVERS
DROP POLICY IF EXISTS "Logistics can view drivers" ON public.drivers;
CREATE POLICY "Logistics can view drivers"
  ON public.drivers FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  );

DROP POLICY IF EXISTS "Logistics can manage drivers" ON public.drivers;
CREATE POLICY "Logistics can manage drivers"
  ON public.drivers FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  );

-- ORDERS
DROP POLICY IF EXISTS "Logistics can view orders" ON public.orders;
CREATE POLICY "Logistics can view orders"
  ON public.orders FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  );

DROP POLICY IF EXISTS "Logistics can manage orders" ON public.orders;
CREATE POLICY "Logistics can manage orders"
  ON public.orders FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  );

-- GIGS
DROP POLICY IF EXISTS "Logistics can view gigs" ON public.gigs;
CREATE POLICY "Logistics can view gigs"
  ON public.gigs FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  );

DROP POLICY IF EXISTS "Logistics can manage gigs" ON public.gigs;
CREATE POLICY "Logistics can manage gigs"
  ON public.gigs FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  );

-- ZONES (logistics_zones)
DROP POLICY IF EXISTS "Logistics can view zones" ON public.logistics_zones;
CREATE POLICY "Logistics can view zones"
  ON public.logistics_zones FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  );

DROP POLICY IF EXISTS "Logistics can manage zones" ON public.logistics_zones;
CREATE POLICY "Logistics can manage zones"
  ON public.logistics_zones FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  );

-- SUBZONES
DROP POLICY IF EXISTS "Logistics can view subzones" ON public.subzones;
CREATE POLICY "Logistics can view subzones"
  ON public.subzones FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  );

DROP POLICY IF EXISTS "Logistics can manage subzones" ON public.subzones;
CREATE POLICY "Logistics can manage subzones"
  ON public.subzones FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  );

-- LIVE TRACKING
DROP POLICY IF EXISTS "Logistics can view tracking" ON public.live_tracking;
CREATE POLICY "Logistics can view tracking"
  ON public.live_tracking FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  );

DROP POLICY IF EXISTS "Logistics can manage tracking" ON public.live_tracking;
CREATE POLICY "Logistics can manage tracking"
  ON public.live_tracking FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  );

-- DISPATCH HISTORY
DROP POLICY IF EXISTS "Logistics can view dispatch" ON public.dispatch_history;
CREATE POLICY "Logistics can view dispatch"
  ON public.dispatch_history FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  );

DROP POLICY IF EXISTS "Logistics can manage dispatch" ON public.dispatch_history;
CREATE POLICY "Logistics can manage dispatch"
  ON public.dispatch_history FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'scoobix.info@gmail.com'
    OR
    EXISTS (SELECT 1 FROM public.users WHERE users.id::text = auth.uid()::text AND (users.role = 'logistics' OR users.role = 'admin'))
  );
