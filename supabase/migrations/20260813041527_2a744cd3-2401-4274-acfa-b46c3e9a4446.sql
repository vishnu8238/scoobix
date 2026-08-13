-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admins can manage all portal access" ON public.portal_access;

-- Create SELECT policy for admins and self
CREATE POLICY "Admins and self can select portal access"
  ON public.portal_access
  FOR SELECT
  TO authenticated
  USING (
    TRIM(BOTH FROM lower(auth.jwt() ->> 'email')) = 'scoobix.info@gmail.com'
    OR 
    email_normalized = TRIM(BOTH FROM lower(auth.jwt() ->> 'email'))
  );

-- Create INSERT policy for admins
CREATE POLICY "Admins can insert portal access"
  ON public.portal_access
  FOR INSERT
  TO authenticated
  WITH CHECK (
    TRIM(BOTH FROM lower(auth.jwt() ->> 'email')) = 'scoobix.info@gmail.com'
  );

-- Create UPDATE policy for admins
CREATE POLICY "Admins can update portal access"
  ON public.portal_access
  FOR UPDATE
  TO authenticated
  USING (
    TRIM(BOTH FROM lower(auth.jwt() ->> 'email')) = 'scoobix.info@gmail.com'
  )
  WITH CHECK (
    TRIM(BOTH FROM lower(auth.jwt() ->> 'email')) = 'scoobix.info@gmail.com'
  );

-- Create DELETE policy for admins
CREATE POLICY "Admins can delete portal access"
  ON public.portal_access
  FOR DELETE
  TO authenticated
  USING (
    TRIM(BOTH FROM lower(auth.jwt() ->> 'email')) = 'scoobix.info@gmail.com'
  );