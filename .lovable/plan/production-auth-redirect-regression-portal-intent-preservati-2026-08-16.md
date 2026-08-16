# Production Auth Redirect Regression — Portal Intent Preservation

Fix the issue where users are redirected to the Customer home (`/app`) instead of their intended portal (e.g., `/logistics`) after Google/InsForge authentication.

## Proposed Changes

### Core Logic
- **`src/lib/insforge-auth.ts`**:
  - Update `setPortalIntent` to also save to `sessionStorage` as a safer fallback for mobile browsers.
  - Update `popPortalIntent` to check both `localStorage` and `sessionStorage`.
  
- **`src/routes/auth.callback.tsx`**:
  - Hardened the `popPortalIntent` call to ensure it captures the intent early.
  - Added a deterministic mapping for redirects:
    - `admin` -> `/admin`
    - `logistics` -> `/logistics`
    - `manager` -> `/manager`
    - `partner` -> `/partner`
    - `rider` -> `/rider`
    - `customer` (or default) -> `/app`
  - Ensure the redirect uses `window.location.replace` with the full origin-prefixed URL to bypass client-side routing hitches during hydration.

- **`src/lib/auth-store.tsx`**:
  - Ensure `resolveUser` doesn't overwrite the `role` property in a way that forces a redirect to `/app` if a `pendingPortal` is already set.
  
- **`src/routes/login.tsx`**:
  - Ensure the `portal` parameter is passed correctly to the `login` function.

### Regression Guard
- Add a deterministic check in the `AuthCallback` to log and verify the redirect mapping before execution.

## Verification Plan

### Automated Tests
- Run `bunx tsgo` to ensure no type regressions.
- Run `lovable-exec build:dev` to verify the build remains healthy.

### Manual Verification
1. Navigate to `https://scoobix.lovable.app/logistics/gigs`.
2. Observe redirect to `/login?portal=logistics`.
3. Complete authentication.
4. **PASS**: Land at `/logistics`.
5. **FAIL**: Land at `/app`.
