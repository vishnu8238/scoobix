
-- (1) Harden 'orders' policies
DROP POLICY IF EXISTS "Customers can read own orders" ON public.orders;
DROP POLICY IF EXISTS "Staff and Admins can manage orders" ON public.orders;

CREATE POLICY "orders_customer_access" ON public.orders
FOR SELECT 
TO authenticated 
USING (customer_id = auth.uid());

CREATE POLICY "orders_staff_access" ON public.orders
FOR ALL
TO authenticated
USING (
    (auth.jwt() ->> 'email' = 'scoobix.info@gmail.com') OR 
    EXISTS (
        SELECT 1 FROM public.portal_access 
        WHERE email = (auth.jwt() ->> 'email') 
        AND status = 'active' 
        AND portal = ANY(ARRAY['admin', 'manager', 'logistics'])
    )
);

-- (2) Harden 'drivers' and 'live_tracking'
DROP POLICY IF EXISTS "Riders can read/update own profile" ON public.drivers;
DROP POLICY IF EXISTS "Ops can manage drivers" ON public.drivers;

CREATE POLICY "drivers_rider_access" ON public.drivers
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "drivers_ops_access" ON public.drivers
FOR ALL
TO authenticated
USING (
    (auth.jwt() ->> 'email' = 'scoobix.info@gmail.com') OR 
    EXISTS (
        SELECT 1 FROM public.portal_access 
        WHERE email = (auth.jwt() ->> 'email') 
        AND status = 'active' 
        AND portal = ANY(ARRAY['admin', 'logistics'])
    )
);

DROP POLICY IF EXISTS "Riders can manage own tracking" ON public.live_tracking;
DROP POLICY IF EXISTS "Ops can view tracking" ON public.live_tracking;

CREATE POLICY "live_tracking_rider_access" ON public.live_tracking
FOR ALL
TO authenticated
USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))
WITH CHECK (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

CREATE POLICY "live_tracking_ops_access" ON public.live_tracking
FOR SELECT
TO authenticated
USING (
    (auth.jwt() ->> 'email' = 'scoobix.info@gmail.com') OR 
    EXISTS (
        SELECT 1 FROM public.portal_access 
        WHERE email = (auth.jwt() ->> 'email') 
        AND status = 'active' 
        AND portal = ANY(ARRAY['admin', 'logistics'])
    )
);

-- (3) Harden 'merchant_managers'
DROP POLICY IF EXISTS "Managers can manage own details" ON public.merchant_managers;
DROP POLICY IF EXISTS "Admin can manage managers" ON public.merchant_managers;

CREATE POLICY "merchant_managers_owner_access" ON public.merchant_managers
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "merchant_managers_admin_access" ON public.merchant_managers
FOR ALL
TO authenticated
USING (auth.jwt() ->> 'email' = 'scoobix.info@gmail.com');

-- (4) Harden 'restaurants'
DROP POLICY IF EXISTS "Owners can manage own restaurant" ON public.restaurants;
DROP POLICY IF EXISTS "Managers and Admin can manage restaurants" ON public.restaurants;

CREATE POLICY "restaurants_owner_access" ON public.restaurants
FOR ALL
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "restaurants_ops_access" ON public.restaurants
FOR ALL
TO authenticated
USING (
    (auth.jwt() ->> 'email' = 'scoobix.info@gmail.com') OR 
    EXISTS (
        SELECT 1 FROM public.portal_access 
        WHERE email = (auth.jwt() ->> 'email') 
        AND status = 'active' 
        AND portal = ANY(ARRAY['admin', 'manager'])
    )
);

-- Explicitly revoke any broad access and ensure RLS is on
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- Reset and ensure precise grants
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.drivers FROM anon;
REVOKE ALL ON public.live_tracking FROM anon;
REVOKE ALL ON public.merchant_managers FROM anon;
REVOKE ALL ON public.restaurants FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_tracking TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_managers TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated, service_role;
