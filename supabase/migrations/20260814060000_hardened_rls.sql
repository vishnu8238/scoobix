-- 1. Orders Table: Customer/Merchant/Staff Isolation
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_customer_select" ON public.orders;
CREATE POLICY "orders_customer_select" ON public.orders
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid()::text);

DROP POLICY IF EXISTS "orders_staff_select" ON public.orders;
CREATE POLICY "orders_staff_select" ON public.orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.portal_access 
            WHERE email_normalized = (SELECT email FROM auth.users WHERE id = auth.uid())
            AND portal IN ('admin', 'manager', 'logistics') AND status = 'active')
    OR driver_id = auth.uid()::text
  );

GRANT SELECT ON public.orders TO authenticated;

-- 2. Drivers Table: Rider Self-Service + Ops Access
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drivers_self_manage" ON public.drivers;
CREATE POLICY "drivers_self_manage" ON public.drivers
  FOR ALL TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "drivers_ops_select" ON public.drivers;
CREATE POLICY "drivers_ops_select" ON public.drivers
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.portal_access 
            WHERE email_normalized = (SELECT email FROM auth.users WHERE id = auth.uid())
            AND portal IN ('admin', 'logistics') AND status = 'active')
  );

GRANT SELECT, UPDATE ON public.drivers TO authenticated;

-- 3. Driver Tracking Table: Rider Write-Only + Ops Select
ALTER TABLE public.driver_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "driver_tracking_self_insert" ON public.driver_tracking;
CREATE POLICY "driver_tracking_self_insert" ON public.driver_tracking
  FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid()::text);

DROP POLICY IF EXISTS "driver_tracking_ops_select" ON public.driver_tracking;
CREATE POLICY "driver_tracking_ops_select" ON public.driver_tracking
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.portal_access 
            WHERE email_normalized = (SELECT email FROM auth.users WHERE id = auth.uid())
            AND portal IN ('admin', 'logistics') AND status = 'active')
  );

GRANT INSERT, SELECT ON public.driver_tracking TO authenticated;

-- 4. Merchant Managers Table: Owner + Admin Access
ALTER TABLE public.merchant_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant_managers_self_read" ON public.merchant_managers;
CREATE POLICY "merchant_managers_self_read" ON public.merchant_managers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()::text);

DROP POLICY IF EXISTS "merchant_managers_admin_all" ON public.merchant_managers;
CREATE POLICY "merchant_managers_admin_all" ON public.merchant_managers
  FOR ALL TO authenticated
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'scoobix.info@gmail.com'
  );

GRANT SELECT, UPDATE ON public.merchant_managers TO authenticated;

-- 5. Restaurants Table: Partner Isolation + Manager/Admin Ops
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurants_owner_all" ON public.restaurants;
CREATE POLICY "restaurants_owner_all" ON public.restaurants
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()::text);

DROP POLICY IF EXISTS "restaurants_manager_ops" ON public.restaurants;
CREATE POLICY "restaurants_manager_ops" ON public.restaurants
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.merchant_managers mm
            JOIN public.portal_access pa ON mm.email = pa.email
            WHERE mm.user_id = auth.uid()::text AND pa.status = 'active')
    OR (SELECT email FROM auth.users WHERE id = auth.uid()) = 'scoobix.info@gmail.com'
  );

GRANT SELECT, INSERT, UPDATE ON public.restaurants TO authenticated;

-- Ensure all tables have service_role bypass
GRANT ALL ON public.orders TO service_role;
GRANT ALL ON public.drivers TO service_role;
GRANT ALL ON public.driver_tracking TO service_role;
GRANT ALL ON public.merchant_managers TO service_role;
GRANT ALL ON public.restaurants TO service_role;
