# Auth System Hardening and Production Fixes

Fix critical infinite loop in the authentication layer and ensure deterministic UI states across all portals.

## User Review Required

> [!IMPORTANT]
> The fixes include removing legacy Supabase integration files. Confirming that no external systems currently rely on the `@/integrations/supabase/*` paths.

## Proposed Changes

### 1. Authentication Layer (`src/lib/auth-store.tsx`)
- **Fix infinite loop**: Remove `authState` from `resolveUser` dependencies to prevent re-mount loops.
- **Harden Session Hydration**: Ensure `getAccessToken` and `getCurrentUser` are called defensively.
- **Add Auth Watchdog**: Ensure `loading` is always set to `false` even on unexpected failures.
- **Normalize Identity**: Use both `email_normalized` and `user_id` where applicable for portal admission checks.

### 2. Portal Authorization (`src/lib/portal-authorization.ts`)
- **Normalize portal types**: Ensure case-insensitive matching for all portal roles.
- **Graceful Failures**: Return specific error types for database lookup failures to distinguish from "Access Denied".
- **Super Admin Bypass**: Retain hardcoded bypass for `scoobix.info@gmail.com`.

### 3. Login UI (`src/routes/login.tsx`)
- **Auth Error Handling**: Display `authError` and `denied` reasons prominently.
- **Finite UI**: Ensure the spinner eventually disappears, showing either the login form or an error message with a "Retry" button.
- **Portal Intent**: Strictly preserve the `portal` parameter through the entire flow.

### 4. Guards and Callbacks
- **RoleGuard & AdminGuard**: Add 15s timeouts with visible "Retry" UI if auth hangs.
- **Auth Callback**: Harder checks for portal intent before final redirection.

### 5. Legacy Cleanup
- Remove `src/integrations/lovable/supabase-bridge.ts`.
- Remove `src/integrations/supabase/` directory (redundant after InsForge migration).

## Technical Details
- `useAuth` hook will now expose `authState` and `authError` to components.
- `resolveUser` will use a `useRef` or just closure-scoped variables to check current status without triggering re-renders of the effect.
- Standardized normalization: `email.toLowerCase().trim()`.

## Verification Plan

### Automated Tests
- Playwright simulation of:
    - Unauthenticated visit to `/login?portal=manager` (Verify controls visible).
    - Unauthenticated visit to `/admin` (Verify redirect to `/login?portal=admin`).
    - Forced `authState === "denied"` (Verify Access Restricted UI).
    - Forced `authState === "auth_error"` (Verify Error UI with Retry).

### Manual Verification Steps
- Open all 6 portals in the preview.
- Confirm Google button initiates correctly.
- Verify logout preserves portal intent.
