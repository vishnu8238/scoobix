# Rider Feature Parity - Part 1

Implement the Rider portal shell, onboarding, feed, and global actions using InsForge architecture.

## User Review Required

> [!IMPORTANT]
> The implementation will use existing InsForge tables. If `emergency_events` or `rider_preferences` tables do not exist in the production database, they will be created optimistically via the SDK's schema-less capabilities if permitted, or handled gracefully with errors.

## Proposed Changes

### Rider Shell & Navigation
- Create a mobile-first layout in `src/routes/rider.tsx` with a bottom navigation bar.
- Navigation items: Feed/Home, Pocket/Earnings, Gigs/Scheduling, Offers/Referrals, and Bazaar/Marketplace.
- Add active-state styling and guarded routes.

### Launch Permissions & Availability
- Implement location permission handling with explainer and error toasts.
- Add an Online/Offline toggle in the feed header.
- Persist rider availability in the `drivers` table with read-back verification.

### Global Header Actions
- Add SOS/Emergency, Notifications, Help, and Profile buttons to the header.
- Implement a dismissible app-update-required banner.

### Feed/Home Page
- Redesign `src/routes/rider.index.tsx` to include incentive cards, time slots, and progress tracking.
- Add a promotional carousel for rider-specific resources.

### Notifications & SOS
- Implement a Notification Center with read/unread persistence in the `notifications` table.
- Create an SOS modal for emergency calls and log events to the `emergency_events` table.

### Profile & Settings
- Build a comprehensive profile view with real identity resolution (no "User" fallbacks).
- Add settings for theme, language, and notification sounds.

### Maps & Zone Visibility
- Implement a work area screen showing the assigned delivery zone.
- Sync rider location and availability between Rider and Logistics portals.

## Technical Details

- **Identity**: Resolved via `identity-utils.ts` and `driver-store.ts`.
- **Data Path**: Mandatory `insforge-crud.ts` usage with read-back verification.
- **Realtime**: Use `useTableVersion` and `realtime-bus.ts` for instant updates.
- **Maps**: Centralized Google Maps integration via `maps-service.ts`.
- **Auth**: Gated by `RoleGuard.tsx` for `rider` role.

## Verification Plan

### Automated Tests
- Static code-path verification for all new components and hooks.
- Validate InsForge CRUD operations for availability and SOS logging.
- Check route accessibility and auth guards.

### Manual Verification
- Verify mobile responsiveness in preview.
- Test Online/Offline toggle persistence.
- Confirm SOS event logging in diagnostics.
