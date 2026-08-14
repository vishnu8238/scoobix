# Authentication and Session Lifecycle Repair Plan

Fix Manager portal authentication failures on iOS (Chrome/Safari) caused by session hydration races, incomplete OAuth callback handling, and inadequate session persistence.

## User Review Required

> [!IMPORTANT]
> This plan modifies the core authentication flow and storage mechanisms. Ensure you have backups of any local environment variables.

- **Storage Changes**: Switching from default memory/localStorage to explicit `localStorage` persistence in the InsForge SDK for iOS compatibility.
- **Auth Flow**: The `auth.callback.tsx` will now explicitly exchange the code to ensure the session is established before redirecting.

## Proposed Changes

### Core Library Updates (`src/lib/`)

#### [insforge.ts](src/lib/insforge.ts)
- Explicitly configure `persistSession: true` and `storage: window.localStorage` in the `createClient` call.
- Hardened `ensureAuthHydrated` to retry on transient network errors.
- Ensure the singleton instance is truly stable and shared.

#### [auth-store.tsx](src/lib/auth-store.tsx)
- Add a `hydrationComplete` flag to the context to allow components to wait for auth state.
- Hardened the `onAuthStateChange` listener to handle `TOKEN_REFRESHED` events.
- Added a watchdog to `resolveUser` that detects "no refresh token" errors and triggers a clean re-auth instead of a loop.

#### [insforge-auth.ts](src/lib/insforge-auth.ts)
- Standardized `getSession` to always attempt a fresh `getCurrentUser` check.
- Added a `clearPortalIntent` helper to ensure clean states.

### Route and Component Updates (`src/routes/`)

#### [auth.callback.tsx](src/routes/auth.callback.tsx)
- Explicitly call `insforge.auth.exchangeCodeForSession(code)` instead of waiting for passive SDK detection.
- Preserve portal intent even if the page reloads during the exchange.
- Added a "Finalizing authorization" step that waits for `AuthStore` to sync roles before redirecting.

#### [login.tsx](src/routes/login.tsx)
- Standardized the error display for "denied" and "disabled" portal access.
- Added a fallback "Retry" button that clears all local auth state if stuck.

### Security and Reliability

#### [portal-authorization.ts](src/lib/portal-authorization.ts)
- Standardized email normalization to prevent case-sensitivity issues on iOS keyboards.
- Added explicit logging for authorization failures to aid remote debugging.

## Verification Plan

### Automated Tests
- `Successful Manager Login`: Verify redirection to `/manager` after valid OAuth.
- `Missing Refresh Token`: Simulate "no refresh token" and verify redirect to `/login?portal=manager` with error.
- `Callback Reload`: Simulate page reload during `/auth/callback` and verify success.
- `Portal Intent Preservation`: Ensure `/login?portal=rider` -> OAuth -> `/rider`.

### Manual Verification
- Test on Safari (iOS) to ensure cookies/localStorage work in private mode.
- Test on Chrome (iOS) to verify the Google OAuth redirect loop is broken.
- Verify `scoobix.lovable.app` production deployment.
