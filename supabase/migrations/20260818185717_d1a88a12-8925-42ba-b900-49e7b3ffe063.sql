-- Fix RLS policy for restaurant_kyc to ensure authenticated managers can manage records
-- for restaurants they own, manage, or onboarded.

-- 1. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Managers can manage KYC for their restaurants" ON public.restaurant_kyc;
DROP POLICY IF EXISTS "Managers can view KYC for their restaurants" ON public.restaurant_kyc;

-- 2. Create the SELECT policy (USING)
CREATE POLICY "Managers can view KYC for their restaurants"
ON public.restaurant_kyc
FOR SELECT
TO authenticated
USING (
  (restaurant_id IN (
    SELECT id FROM public.restaurants 
    WHERE manager_id = auth.uid() 
       OR onboarded_by = auth.uid()
  ))
  OR 
  (subject_type = 'manager' AND (subject_id = auth.uid()::text))
);

-- 3. Create the ALL policy (INSERT/UPDATE/DELETE)
CREATE POLICY "Managers can manage KYC for their restaurants"
ON public.restaurant_kyc
FOR ALL
TO authenticated
USING (
  (restaurant_id IN (
    SELECT id FROM public.restaurants 
    WHERE manager_id = auth.uid() 
       OR onboarded_by = auth.uid()
  ))
  OR 
  (subject_type = 'manager' AND (subject_id = auth.uid()::text))
)
WITH CHECK (
  (restaurant_id IN (
    SELECT id FROM public.restaurants 
    WHERE manager_id = auth.uid() 
       OR onboarded_by = auth.uid()
  ))
  OR 
  (subject_type = 'manager' AND (subject_id = auth.uid()::text))
);

-- Ensure grants are correct
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_kyc TO authenticated;
GRANT ALL ON public.restaurant_kyc TO service_role;
