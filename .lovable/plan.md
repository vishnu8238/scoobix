# Manager Portal & Security Fixes

Fix three key security findings (InsForge-only, server-side checks, least-privilege) and repair the Manager onboarding/profile flow.

## User-facing changes
- **Manager Profile**: New section to update name, phone, and avatar. Displays real name and initials in the header.
- **Improved Onboarding**: Resume drafts automatically, idempotent submissions, and better file upload handling.
- **Reliable Identity**: Derives names from authenticated profiles instead of generic "User" placeholders.

## Technical details
- **Identity Hardening**: Upsert a `users` profile on first login if missing; link all data to the authenticated `user.id`.
- **Security remediation**:
    - Enforce `owner_id = auth.uid()` in `insforge-crud.ts` (simulated via authenticated session principal).
    - Resolve open fraud reports and security alerts via `security-fix.functions.ts`.
    - Sanitise all sensitive writes in `api-guard.ts`.
- **Onboarding repairs**:
    - Update `ManagedRestaurant` interface to include `logo_url`, `cover_url`, and structured `documents`.
    - Modify `saveOnboardingDraft` to be idempotent based on `owner_id`.
    - Enhance `manager.onboarding.tsx` to wait for file uploads and persist URLs correctly.
    - Implement toggle-based validation for optional images (Cover/Gallery).
- **Profile Management**:
    - Implement `updateUserProfile` in `manager-api.ts`.
    - Enhance `manager.profile.tsx` with a full editing UI.
- **Auth stability**: Ensure `RoleGuard` waits for full membership resolution before gating.

## Validation plan
- Run `bunx tsgo` for type checks.
- Build the app to verify production readiness.
- Check identity resolution logic via `getDisplayName` tests or manual verification in preview.
