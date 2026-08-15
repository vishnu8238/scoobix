# Manager Portal Regression Fix Plan

Repairing onboarding state persistence, UUID resolution, and identity display.

## Proposed Changes

### 1. Manager Onboarding Persistence
- Update `src/routes/manager.onboarding.tsx` to ensure file uploads (Logo, Cover, Gallery, Documents) are correctly initialized from the record.
- Hardened payload generation to include `logo_url`, `cover_url`, and all `documents`.
- Ensure optional toggles (`has_cover`, `has_gallery`) are correctly derived from existing URLs.

### 2. UUID Resolution & Submission
- Standardize `saveOnboardingDraft` in `src/lib/manager-api.ts` to strictly return the database-assigned UUID and prevent duplicate creation by using the existing ID if available.
- Update `finalizeSubmit` in `src/routes/manager.onboarding.tsx` to use the authoritative ID returned by the backend for final navigation.
- Add regression guards to check for valid UUID format before proceeding.

### 3. Identity Display
- Refactor `ManagerShell` in `src/routes/manager.tsx` to use `getDisplayName(user)` for the primary name and display the normalized email as subtext.
- Update `src/lib/identity-utils.ts` to ensure it prioritizes `full_name` and `display_name` from the InsForge profile/metadata.

## Technical Details
- Using `insforge.database.from('restaurants').insert().select()` to get the canonical record back.
- `getDisplayName` already exists in `identity-utils.ts`, will ensure `ManagerShell` utilizes it correctly.
- No changes to Logistics, Rider, or Customer portals.
