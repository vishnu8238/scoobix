# Master Admin Portal Access Management

## 1. Database Schema
Create the `portal_access` table to store authoritative portal permissions.

```sql
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

-- audit_logs table (if not exists)
-- Assuming existing infrastructure as per src/lib/audit-api.ts
```

## 2. Authorization Logic
Update the centralized auth store and logistics authorization to use the new table.

- `src/lib/portal-authorization.ts`: New helper for checking any portal access.
- `src/lib/auth-store.tsx`: Update `resolveUser` to query `portal_access` for the current portal.
- `src/lib/logistics-authorization.ts`: Refactor to use the shared `portal_access` table instead of `logistics_staff`.

## 3. Master Admin UI
Add the "Access Management" section to the Master Admin portal.

- `src/routes/admin.access.tsx`: Main management view with table and filters.
- `src/components/admin/AccessForm.tsx`: Modal for adding/editing access records.

## 4. Audit Logging
Every change to portal access must be logged via `logAudit`.

- Actions: `ACCESS_CREATED`, `ACCESS_ENABLED`, `ACCESS_DISABLED`, `ACCESS_REMOVED`, `ACCESS_UPDATED`.

## 5. Security & Verification
- Google OAuth remains open to all.
- Authorization happens after authentication.
- No customer fallback on denial.
- Normalized email matching.
- Backend-driven (cross-device).
