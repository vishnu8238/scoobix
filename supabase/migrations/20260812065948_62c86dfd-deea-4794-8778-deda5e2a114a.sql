-- portal_access table
CREATE TABLE public.portal_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    email_normalized TEXT NOT NULL GENERATED ALWAYS AS (trim(lower(email))) STORED,
    portal TEXT NOT NULL CHECK (portal IN ('partner', 'rider', 'manager', 'logistics')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_login_at TIMESTAMPTZ,
    UNIQUE (email_normalized, portal)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_access TO authenticated;
GRANT ALL ON public.portal_access TO service_role;

ALTER TABLE public.portal_access ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read their own portal access (by email)
CREATE POLICY "Users can read their own portal access"
ON public.portal_access
FOR SELECT
TO authenticated
USING (email_normalized = trim(lower(auth.jwt() ->> 'email')));

-- Policy: Master Admin can manage all records
CREATE POLICY "Admins can manage all portal access"
ON public.portal_access
FOR ALL
TO authenticated
USING (trim(lower(auth.jwt() ->> 'email')) = 'scoobix.info@gmail.com');

-- Initial seeding for the owner
INSERT INTO public.portal_access (email, portal, status)
VALUES ('scoobix.info@gmail.com', 'logistics', 'active')
ON CONFLICT DO NOTHING;
