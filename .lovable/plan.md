# Plan: Rider Portal Regression Repairs

Repair verified Rider portal defects while preserving Scoobix branding, mobile-first navigation, and InsForge backend architecture.

## Proposed Changes

### 1. Active Delivery Navigation Fix
- Update the empty-state "VIEW REQUESTS" button in `src/routes/rider.active.tsx`.
- Change `navigate({ to: "/rider" })` to `navigate({ to: "/rider/requests" })`.

### 2. Profile Preferences Implementation
- **App Language Selection**:
  - Add a lightweight in-place language picker modal/overlay in `src/routes/rider.profile.tsx`.
  - Options: English, Hindi, Arabic, Spanish (consistent with regional food delivery apps).
  - Update `prefs.app_language` state and persist via `updateRiderPreferences`.
- **Alert Sound Selection**:
  - Add a lightweight in-place sound picker modal/overlay in `src/routes/rider.profile.tsx`.
  - Options: Standard, Loud, Subtle, None.
  - Update `prefs.alert_sound` state and persist via `updateRiderPreferences`.

### 3. Verification & Safety
- Run production TypeScript build (`npm run build`).
- Verify all Rider routes are reachable and mobile-responsive.
- Ensure InsForge-only data access is maintained.

## Technical Details
- Use `framer-motion` for smooth, lightweight in-place selectors (bottom sheet style).
- Maintain existing `RiderProfile` component structure and styling tokens.
- No database schema changes; uses existing `driver` metadata/preferences field via `rider-api.ts`.
