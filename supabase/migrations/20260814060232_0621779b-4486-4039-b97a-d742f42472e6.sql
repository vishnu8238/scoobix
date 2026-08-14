-- Step 1: Grant essential privileges to ensure Data API access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_tracking TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_managers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;

GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.portal_access TO authenticated;

GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.drivers TO service_role;
GRANT ALL ON public.live_tracking TO service_role;
GRANT ALL ON public.merchant_managers TO service_role;
GRANT ALL ON public.restaurants TO service_role;
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.portal_access TO service_role;

-- Step 2: Clean up previous policies to ensure a fresh, consistent state
DROP POLICY IF EXISTS "Logistics can manage drivers" ON public.drivers;
DROP POLICY IF EXISTS "Logistics can view drivers" ON public.drivers;
DROP POLICY IF EXISTS "Logistics can manage tracking" ON public.live_tracking;
DROP POLICY IF EXISTS "Logistics can view tracking" ON public.live_tracking;
DROP POLICY IF EXISTS "Logistics can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Logistics can view orders" ON public.orders;
DROP POLICY IF EXISTS "Admins full access to restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Managers can create restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Managers can see their restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Managers can update their restaurants" ON public.restaurants;
DROP POLICY IF EXISTS "Customers can read own orders" ON public.orders;
DROP POLICY IF EXISTS "Staff and Admins can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Riders can read/update own profile" ON public.drivers;
DROP POLICY IF EXISTS "Ops can manage drivers" ON public.drivers;
DROP POLICY IF EXISTS "Riders can manage own tracking" ON public.live_tracking;
DROP POLICY IF EXISTS "Ops can view tracking" ON public.live_tracking;
DROP POLICY IF EXISTS "Managers can manage own details" ON public.merchant_managers;
DROP POLICY IF EXISTS "Admin can manage managers" ON public.merchant_managers;
DROP POLICY IF EXISTS "Owners can manage own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Managers and Admin can manage restaurants" ON public.restaurants;

-- Step 3: Implement new hardened RLS policies using email-based lookup from portal_access

-- ORDERS: Customers read own, Staff/Admin read based on portal roles
CREATE POLICY "Customers can read own orders" ON public.orders
FOR SELECT TO authenticated
USING (customer_id = auth.uid());

CREATE POLICY "Staff and Admins can manage orders" ON public.orders
FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'scoobix.info@gmail.com') OR
  EXISTS (
    SELECT 1 FROM public.portal_access
    WHERE email = auth.jwt() ->> 'email'
    AND status = 'active'
    AND portal IN ('admin', 'manager', 'logistics')
  )
);

-- DRIVERS & TRACKING: Riders read/update own, Admin/Logistics operational access
CREATE POLICY "Riders can read/update own profile" ON public.drivers
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Ops can manage drivers" ON public.drivers
FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'scoobix.info@gmail.com') OR
  EXISTS (
    SELECT 1 FROM public.portal_access
    WHERE email = auth.jwt() ->> 'email'
    AND status = 'active'
    AND portal IN ('admin', 'logistics')
  )
);

CREATE POLICY "Riders can manage own tracking" ON public.live_tracking
FOR ALL TO authenticated
USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))
WITH CHECK (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

CREATE POLICY "Ops can view tracking" ON public.live_tracking
FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'scoobix.info@gmail.com') OR
  EXISTS (
    SELECT 1 FROM public.portal_access
    WHERE email = auth.jwt() ->> 'email'
    AND status = 'active'
    AND portal IN ('admin', 'logistics')
  )
);

-- MERCHANT MANAGERS: Restricted to owner/admin
CREATE POLICY "Managers can manage own details" ON public.merchant_managers
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can manage managers" ON public.merchant_managers
FOR ALL TO authenticated
USING (auth.jwt() ->> 'email' = 'scoobix.info@gmail.com');

-- RESTAURANTS: Owners manage own, Admin/Manager oversight
CREATE POLICY "Owners can manage own restaurant" ON public.restaurants
FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Managers and Admin can manage restaurants" ON public.restaurants
FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'scoobix.info@gmail.com') OR
  EXISTS (
    SELECT 1 FROM public.portal_access
    WHERE email = auth.jwt() ->> 'email'
    AND status = 'active'
    AND portal IN ('admin', 'manager')
  )
);
