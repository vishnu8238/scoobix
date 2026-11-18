DROP POLICY IF EXISTS "Public restaurants are viewable by everyone" ON public.restaurants;
CREATE POLICY "Approved restaurants are publicly viewable" ON public.restaurants
  FOR SELECT TO anon, authenticated
  USING (lower(coalesce(status,'')) IN ('approved','active','live','open'));
REVOKE SELECT ON public.restaurants FROM anon;
GRANT SELECT (id, rst_code, code, name, cuisine, address, city, pincode, latitude, longitude, delivery_radius, opening_time, closing_time, logo, logo_url, cover_url, cover_image, status, is_branch, parent_restaurant_id, branch_name, branch_code, created_at, updated_at) ON public.restaurants TO anon;

DROP POLICY IF EXISTS "Anyone authenticated can view gigs" ON public.gigs;
CREATE POLICY "Riders view own or open gigs" ON public.gigs
  FOR SELECT TO authenticated
  USING (
    driver_id IS NULL
    OR EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = gigs.driver_id AND d.user_id = auth.uid())
  );