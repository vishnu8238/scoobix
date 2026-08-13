# Plan: Fix Scoobix Production OAuth Failure

The project is experiencing an `AUTHENTICATION ERROR` during Google sign-in because `https://preview--scoobix.lovable.app/auth/callback` is missing from the InsForge redirect allowlist.

## User Review Required

> [!IMPORTANT]
> I have enabled **Google Social Auth** via the Lovable Cloud management tools. For production stability and branding, please ensure your own Google OAuth Client ID and Secret are configured in the Backend settings if you haven't already.

## Proposed Changes

### 1. OAuth Configuration
- Add the exact deployed callback URL to the backend allowlist: `https://preview--scoobix.lovable.app/auth/callback`.
- Ensure the frontend dynamically produces the correct absolute callback URL using `window.location.origin`.

### 2. Frontend Auth Hardening
- **src/routes/login.tsx**: Reset error states before login attempts and ensure the UI doesn't stay in a loading state on failure.
- **src/lib/insforge-auth.ts**: Verify callback URL generation logic remains robust and correctly preserves portal intent through the round trip.
- **src/routes/auth.callback.tsx**: Add descriptive loading/error states to help diagnose issues if the SDK fails to establish a session.

### 3. Verification
- Use Playwright to simulate the unauthenticated access to all portals (`/admin`, `/logistics`, etc.) and verify they correctly point to the login page with the appropriate `?portal=` parameter.
- Verify the Google sign-in button initiates the flow toward the expected provider URL.

## Technical Details
- Using `supabase--configure_social_auth` to manage the backend provider state.
- Authoritative portal admission remains in `portal_access` table via `src/lib/portal-authorization.ts`.
- `AuthStore` preserves `membershipsResolved` logic to prevent flash/redirect loops.
