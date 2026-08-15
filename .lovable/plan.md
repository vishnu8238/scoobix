# Plan - Fix Manager Restaurant Onboarding Submission

Fix the "user without ID" and "user already exists" defects in the Scoobix Manager onboarding flow by hardening identity resolution and ensuring idempotent submission logic.

## User Review Required

> [!IMPORTANT]
> The fix involves standardizing how the Manager's identity is resolved from the InsForge session. If the manager is not fully loaded, the submission will be blocked with a clear message.

## Proposed Changes

### Manager Data Layer (`src/lib/manager-api.ts`)

- Harden `provisionAccount` to be more robust against partial failures.
- Update `saveOnboardingDraft` to return errors instead of just `null`.
- Ensure `useManager` refresh logic is authoritative.

### Manager Onboarding Flow (`src/routes/manager.onboarding.tsx`)

- Implement a strict check for `manager.id` before allowing any submission.
- Wrap the final submission in a try-catch block with defensive logging.
- Ensure the `busy` state correctly prevents double-submission.
- Authoritatively resolve the manager ID from the session if the hook state is stale.

### Authentication & Identity (`src/lib/insforge.ts`)

- Ensure `insforge.auth.session` is the source of truth for all ID resolution.

## Technical Details

- **Identity Guard**: In `OnboardingFlow`, add a blocking check: `if (!manager?.id && !hydrationComplete) return <Loading />`.
- **Atomic Submission**: The `finalizeSubmit` function will be refactored to verify the `owner_id` (from `provisionAccount`) and `manager_id` (from session) are present before calling `persist`.
- **Idempotency**: Use the `owner_email` to check for existing accounts in `provisionAccount` (already partially there, but needs hardening to ensure the profile is linked).
- **Logging**: Add `console.info` for each major step of the submission (Account Provisioned -> Draft Persisted -> Event Logged) to aid production diagnostics.

## Constraints & Assumptions

- Uses InsForge only.
- Preserves existing Admin approval flow.
- No changes to branding or UI layout (except loading states).
