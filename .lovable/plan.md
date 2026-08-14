# Plan - Fix Manager Portal Authentication (iOS Safari/Chrome)

Fixing the "no refresh token provided" loop and portal intent preservation issues reported on iPhone 14.

## Proposed Changes

### 1. Auth State Machine & iOS Recovery
- **File:** `src/lib/auth-store.tsx`
- **Action:** Hardened the `resolveUser` watchdog to detect definitive refresh token failures.
- **Goal:** Trigger a clean re-authentication flow instead of an infinite loading state. Implement aggressive `localStorage` cleanup of stale PKCE verifiers (`sb-*-code-verifier`) which are the primary cause of iOS Safari auth loops.

### 2. Optimized SDK Hydration
- **File:** `src/lib/insforge.ts`
- **Action:** Refactor `ensureAuthHydrated` to use a singleton promise and prioritize light-weight session checks.
- **Goal:** Prevent hydration races during the rapid page transitions common on mobile devices.

### 3. OAuth Callback Reliability
- **File:** `src/routes/auth.callback.tsx`
- **Action:** 
    - Immediately clean `code` and `insforge_code` from the URL using `window.history.replaceState`.
    - Hardened the `exchangeCodeForSession` logic to handle concurrent exchange attempts (common when browser pre-fetching or reloads occur).
- **Goal:** Prevent "code already used" errors and ensure the user is redirected to the correct portal.

### 4. Portal Intent Preservation
- **File:** `src/lib/insforge-auth.ts` and `src/routes/login.tsx`
- **Action:** Standardize the persistence of the `portal` parameter in `localStorage` before initiating the Google OAuth flow.
- **Goal:** Ensure authorized Managers land on `/manager`, Riders on `/rider`, etc., instead of being dumped to a default `/app` route.

## Technical Details

- **iOS Compatibility:** Uses `localStorage` for session persistence with specialized cleanup logic for iOS-specific "incognito" or "restricted storage" edge cases.
- **Watchdog Timers:** 15s-20s timeout in `resolveUser` to prevent the UI from being stuck in "RESOLVING ACCESS" forever.
- **Code Cleanup:** Permanently removed the obsolete `src/integrations/supabase` directory to prevent build pathing issues.

## Verification Plan

- **Automated Tests:** Run `/tmp/browser/auth_audit/audit_v2.py` simulating iPhone 14 user agents.
- **Build Check:** Ensure `bun run build` passes without TypeScript errors.
- **Manual Verification:** Confirm `scoobix_oauth_portal_intent` is correctly set and cleared during the login flow.
