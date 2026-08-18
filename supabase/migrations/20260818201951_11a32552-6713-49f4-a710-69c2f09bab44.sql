-- 1. Drop the vulnerable policies on gigs
DROP POLICY IF EXISTS "Logistics can manage gigs" ON public.gigs;
DROP POLICY IF EXISTS "Logistics can view gigs" ON public.gigs;

-- 2. Create secure replacements using the has_role function
CREATE POLICY "Admins and Logistics can manage gigs"
ON public.gigs
FOR ALL
TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'scoobix.info@gmail.com') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'moderator') -- Mapping 'logistics' role to moderator or admin
)
WITH CHECK (
  (auth.jwt() ->> 'email' = 'scoobix.info@gmail.com') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'moderator')
);

CREATE POLICY "Anyone authenticated can view gigs"
ON public.gigs
FOR SELECT
TO authenticated
USING (true);
