# Plan - Rider Identity & Onboarding Fix

Fix production "insert or update on table \"drivers\" violates foreign key constraint \"drivers_user_id_fkey\"" error by hardening identity resolution and removing speculative `drivers` table writes.

## User Review Required

> [!IMPORTANT]
> This fix removes the automatic creation of `drivers` records during onboarding if the user UUID isn't already mapped. It treats `drivers` as a strict, pre-existing identity table.

## Proposed Changes

### Rider Identity & Profile
- **src/lib/rider-kyc.ts**:
    - Remove the `createRecord("drivers", ...)` logic.
    - Treat `drivers` strictly as a read-only identity lookup by `user_id`.
    - Persist profile data to `rider_profiles` using only `user_id` and authoritative fields.
    - Only include `driver_id` in `rider_profiles` if an existing mapping is found.
- **src/lib/driver-store.ts**:
    - Harden `getDriverForUser` to use `select: "id,user_id"` and strictly validate the result.
    - Remove `patchRecord("drivers", ...)` in the `update` method to prevent schema/FK errors.
- **src/lib/rider-api.ts**:
    - Ensure `setRiderAvailability` remains a no-op or only affects volatile state, avoiding `drivers` table writes.

### UI & Admin Center
- **src/routes/rider.index.tsx**:
    - Update `handleProfileSubmit` to handle cases where `drivers` mapping doesn't exist yet (KYC can proceed based on `user.id`).
    - Use `user.id` as the primary key for profile lookup if `driver.id` is missing.
- **src/routes/admin.verification.tsx**:
    - Audit `tab === "rider"` logic to ensure it can display riders even if they only have a `rider_profiles` record but no `drivers` entry (identity resolution via `user_id`).

### Database & Security
- **src/lib/insforge-crud.ts**:
    - No changes needed (already handles sanitized inserts).
- **Verification**:
    - Run `tsgo` to ensure no stale field references remain.

## Technical Details
- Table: `drivers` (Identity anchor, minimal columns: `id`, `user_id`).
- Table: `rider_profiles` (Authoritative store: `id`, `user_id`, `driver_id`, `name`, `phone`, `vehicle_type`, `vehicle_number`, `license_number`, `verification_status`, `docs_verified`).
- Identity Resolution: Always prefer `auth.uid()` from the active InsForge session.
