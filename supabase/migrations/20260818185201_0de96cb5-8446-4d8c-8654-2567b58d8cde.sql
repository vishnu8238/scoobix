
-- 1. Create restaurant_kyc table if it truly doesn't exist
CREATE TABLE IF NOT EXISTS public.restaurant_kyc (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    subject_type text,
    subject_id text,
    doc_type text,
    doc_number text,
    file_url text,
    file_name text,
    status text DEFAULT 'pending',
    mandatory boolean DEFAULT false,
    remarks text,
    expires_at timestamptz,
    uploaded_by text,
    submitted_at timestamptz,
    reviewed_at timestamptz,
    reviewed_by text,
    created_at timestamptz DEFAULT now(),
    UNIQUE(subject_type, subject_id, doc_type)
);

-- 2. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.restaurant_kyc TO authenticated;
GRANT ALL ON public.restaurant_kyc TO service_role;

-- 3. Enable RLS
ALTER TABLE public.restaurant_kyc ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Managers can view KYC for restaurants they manage
DROP POLICY IF EXISTS "Managers can view KYC for their restaurants" ON public.restaurant_kyc;
CREATE POLICY "Managers can view KYC for their restaurants"
ON public.restaurant_kyc
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE public.restaurants.id = public.restaurant_kyc.restaurant_id
    AND (public.restaurants.manager_id::text = auth.uid()::text OR public.restaurants.onboarded_by::text = auth.uid()::text)
  )
  OR
  (subject_type = 'manager' AND subject_id::text = auth.uid()::text)
);

-- 5. Policy: Managers can manage KYC for restaurants they manage
DROP POLICY IF EXISTS "Managers can manage KYC for their restaurants" ON public.restaurant_kyc;
CREATE POLICY "Managers can manage KYC for their restaurants"
ON public.restaurant_kyc
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE public.restaurants.id = public.restaurant_kyc.restaurant_id
    AND (public.restaurants.manager_id::text = auth.uid()::text OR public.restaurants.onboarded_by::text = auth.uid()::text)
  )
  OR
  (subject_type = 'manager' AND subject_id::text = auth.uid()::text)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE public.restaurants.id = public.restaurant_kyc.restaurant_id
    AND (public.restaurants.manager_id::text = auth.uid()::text OR public.restaurants.onboarded_by::text = auth.uid()::text)
  )
  OR
  (subject_type = 'manager' AND subject_id::text = auth.uid()::text)
);

-- 6. Audit logs table (ensuring it exists)
CREATE TABLE IF NOT EXISTS public.kyc_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
    subject_type text,
    subject_id text,
    kyc_id uuid REFERENCES public.restaurant_kyc(id) ON DELETE CASCADE,
    doc_type text,
    action text,
    from_status text,
    to_status text,
    remarks text,
    actor_id text,
    actor_name text,
    actor_role text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.kyc_audit_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.kyc_audit_logs TO authenticated;
GRANT ALL ON public.kyc_audit_logs TO service_role;

DROP POLICY IF EXISTS "Managers can view audit logs for their restaurants" ON public.kyc_audit_logs;
CREATE POLICY "Managers can view audit logs for their restaurants"
ON public.kyc_audit_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE public.restaurants.id = public.kyc_audit_logs.restaurant_id
    AND (public.restaurants.manager_id::text = auth.uid()::text OR public.restaurants.onboarded_by::text = auth.uid()::text)
  )
);

DROP POLICY IF EXISTS "Managers can insert audit logs for their restaurants" ON public.kyc_audit_logs;
CREATE POLICY "Managers can insert audit logs for their restaurants"
ON public.kyc_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE public.restaurants.id = public.kyc_audit_logs.restaurant_id
    AND (public.restaurants.manager_id::text = auth.uid()::text OR public.restaurants.onboarded_by::text = auth.uid()::text)
  )
);
