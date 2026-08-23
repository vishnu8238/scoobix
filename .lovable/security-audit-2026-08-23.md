# Source-Only Security Trace: Scoobix P0.1 Hardening (2026-08-23)

## (1) Restaurant Bank Details & Owner PII Exposure
**Claim:** Restaurant bank details and owner PII exposed to anyone on the internet.
**Trace:**
- `src/routes/partner.onboarding.tsx`: Collects `bank_account`, `bank_ifsc`, `owner_name`, `phone` (lines 37-52, 145-147).
- `src/lib/insforge-crud.ts`: Enforces client-side RLS by attaching `owner_id = authId` for all non-restricted tables (lines 374-381).
- `src/lib/auth-store.tsx`: Syncs profile from the `users` table via `id = eq.${authId}` (lines 137-138).
**Verification:** **PARTIALLY VERIFIED (Design Intended, Implementation Proof Needed)**. While the code attempts client-side injection, true exposure is governed by InsForge RLS policies which are not visible in the frontend source. The `listTable` helper allows a `public: true` flag, but it is not used for sensitive restaurant/bank reads.
**Remediation:** Apply a secondary backend-enforced RLS check in `insforge-crud.ts` for all reads by strictly prefixing query parameters with `owner_id=eq.${userId}` inside the `listTable` handler for sensitive tables, even if the caller omits it.

## (2) Hardcoded Admin Email Escalation
**Claim:** Hardcoded admin email used for privileged access across many tables.
**Trace:**
- `src/lib/admin.functions.ts`: Defines `ADMIN_EMAIL = "scoobix.info@gmail.com"` (line 4) and checks it in a `handler` (line 11).
- `src/lib/portal-authorization.ts`: Provides the authoritative check via `portal_access` table (line 42).
**Verification:** **UNSUPPORTED (Stale Claim)**. The hardcoded email exists in a server function but is NOT the source of truth for platform-wide RLS or table access. Admission is strictly database-driven via the `portal_access` and `platform_admins` tables. The `ADMIN_EMAIL` constant is a legacy UI-level check that does not grant DB-level permissions.
**Remediation:** None required for source logic; access is already authoritative via `portal_access`. Recommendation is to delete the `checkAdminEmail` function to avoid developer confusion.

## (3) Unrestricted Gig/Delivery Record Access
**Claim:** Any authenticated user can view all gig/delivery records.
**Trace:**
- `src/routes/rider.gigs.tsx`: Calls `fetchGigs({ status: "in.(ACTIVE,SCHEDULED,COMPLETED)" })` (line 47).
- `src/lib/gigs-api.ts`: Queries the `gigs` table directly (line 52).
- `src/routes/admin.logistics.tsx`: Admins query `rider_gig_enrollments` without explicit rider filters (line 54).
**Verification:** **VERIFIED (Operational Policy)**. By design, any rider can view "Available" gigs to book them. However, viewing *enrolled* gigs of other riders is not explicitly blocked in the `fetchGigParticipants` helper (line 192).
**Remediation:** Update `rider_gig_enrollments` read paths to strictly filter by the authenticated `user.id` unless the caller has `logistics.view` or `admin.manage` permissions.

## (4) Privilege Escalation via `user_roles`
**Claim:** Potential privilege escalation via user_roles.
**Trace:**
- `src/lib/permissions.ts`: Maps roles to permissions (lines 78-100).
- `src/lib/auth-store.tsx`: Resolves roles via `checkPortalAccess` (line 157).
- `src/lib/insforge-crud.ts`: Contains a `authRestrictedTables` list including `user_roles` (line 377).
**Verification:** **PARTIALLY VERIFIED (Hardened)**. The system has already been hardened to use `portal_access` (active normalized email) as the sole admission source, bypassing legacy `user_roles` checks. Escalation via `user_roles` table writes is blocked client-side in `insforge-crud.ts`.
**Remediation:** Permanently disable the `user_roles` table from all client-side CRUD helpers and remove it from `authRestrictedTables` to treat it as an inaccessible legacy artifact.

## Minimally Sufficient Fix Plan
1. **InsForge CRUD**: Update `authRestrictedTables` to include `ownership_transfers` and `portal_access`.
2. **Gigs API**: Add a check to `fetchGigParticipants` that restricts data to the `rider_id` of the caller unless they are an admin.
3. **Admin Functions**: Deprecate `checkAdminEmail`.

Build Exits: `bunx tsgo` (Expected 0), `npm run build` (Expected 0).
Regression Check: Verify `/rider/gigs` correctly filters available slots and `/admin/approvals` remains accessible to authorized platform managers.
