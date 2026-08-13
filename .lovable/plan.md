# Plan: Scoobix Production Auth & Portal Session Fix

Fix the production bug where authenticated sessions are lost during portal navigation and resolve infinite "AUTHENTICATING..." hangs.

## Proposed Changes

### 1. Auth Store Hardening (`src/lib/auth-store.tsx`)
- Implement a timeout for `resolveUser` (15s limit).
- Fix the portal-change effect: ensure it doesn't trigger unauthorized redirects while memberships are still resolving.
- Replace `window.location.assign("/")` on logout with a portal-aware redirect to prevent falling back to the customer app.
- Ensure `lastRequestedPortal` is always updated to prevent stale portal checks.
- Add `AUTH_TRACE` logging to identify the exact point of failure in the production state machine.

### 2. RoleGuard & AdminGuard Stabilization (`src/components/cravio/RoleGuard.tsx`, `src/components/cravio/AdminGuard.tsx`)
- Add a 15s timeout to the loading states; if exceeded, show a "Connection Timeout" error with a retry button.
- Ensure `RoleGuard` never clears a valid session just because access is denied.
- Standardize the "Access Restricted" UI across all portals to include the current user's email and a "Switch Account" option.
- Fix `AdminGuard` to use the same initialization logic as `RoleGuard` to prevent race conditions during hydration.

### 3. Callback & Portal Admission (`src/routes/auth.callback.tsx`, `src/lib/portal-authorization.ts`)
- Harden the `waitForUser` loop in `auth.callback.tsx` with explicit logging.
- Ensure `portal-authorization.ts` handles transient network failures by retrying once before failing.
- Ensure `auth.callback.tsx` only removes the portal intent *after* a successful redirect.

### 4. Admin Layout Fix (`src/routes/admin.tsx`)
- Remove the redundant `useEffect` that redirects to `/login` if `authState === "unauthenticated"`, as this is already handled by `AdminGuard`. This prevents double-redirects and potential loops.

## Technical Details
- **InsForge SDK**: Use `insforge.auth.getCurrentUser()` to ensure the session is active.
- **State Machine**: `initializing` -> `session_resolving` -> `authorization_resolving` -> `authenticated` / `unauthenticated`.
- **Timeouts**: All async auth operations will be wrapped in a 15s timeout to prevent infinite spinners.

## User Review Required
- Does the "Access Restricted" screen meet your visual expectations, or should it match a specific portal's theme? (Default: Dark Scoobix style).
