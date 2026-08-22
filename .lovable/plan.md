# P0.1 Authentication & Authorization Stabilization Plan

This plan implements a hardening pass for the Scoobix authentication and authorization system, focusing on reliability, security isolation, and single-source-of-truth session management.

## User Impact
- **Reliability**: Faster and more stable login/session restoration.
- **Security**: Strict portal access control and user data isolation in the cache.
- **UX**: Clearer error messaging and smoother portal transitions without unnecessary redirects.

## Technical Details

### A. Authoritative Client & Session Management
- **Singleton Consolidation**: Set `detectOAuthCallback: false` in `src/lib/insforge.ts` to prevent the SDK from competing with the authoritative callback route.
- **Lifecycle Centralization**: Move the auth listener from module scope in `src/lib/insforge.ts` to `AuthProvider` in `src/lib/auth-store.tsx`. 
- **SDK-First Session**: Remove `getAccessToken` broad storage scanning. Use the verified SDK session as the only source of truth for tokens.
- **Header Security**: All Authorization headers will be derived from the active SDK session.

### B. OAuth & Redirect Logic
- **Idempotent Callback**: Hardenable `src/routes/auth.callback.tsx` to handle code exchange exclusively and prevent race conditions.
- **Intent Protection**: Portal intent (e.g., "partner", "rider") will be used for routing only, never for granting privileges.
- **State Machine**: Replace the 10s watchdog with explicit `session_resolving` and `authorization_resolving` states.

### C. Strict Portal Authorization
- **Exclusive Admission**: `public.portal_access` becomes the **only** way to enter privileged portals (Admin, Logistics, Partner, Rider, Manager).
- **Identity Hardening**: Normalize emails (lowercase/trim) and remove the `scoobix.info@gmail.com` hardcoded bypass.
- **No Fallbacks**: Role granting based on legacy table checks (restaurants, drivers) is removed.

### D. Cache & Logout Isolation
- **Scoped Cache**: Update `sx:cache` keys to include the `userId`, preventing data leakage on shared devices.
- **Atomic Cleanup**: Clear all memory and persistent cache entries on logout, session switch, or auth errors.

### E. Quality Assurance
- Implement pure helper functions for email normalization and access check logic.
- Verify the build with 0 TypeScript errors.

## Implementation Steps

1. **Client Hardening**: Modify `src/lib/insforge.ts` and `src/integrations/supabase/client.ts` to stabilize the singleton.
2. **AuthStore Refactor**: Major update to `src/lib/auth-store.tsx` for the new lifecycle and portal checks.
3. **Callback stabilization**: Update `src/routes/auth.callback.tsx` for authoritative exchange.
4. **Cache isolation**: Update `src/lib/request-cache.ts` for user-scoped persistence.
5. **Guard alignment**: Update `src/components/cravio/RoleGuard.tsx` to reflect new states.
6. **Cleanup**: Remove local client constructions in server functions and redundant middleware.
