# Plan - Production Rider Mobile UI Repair

Implement a shared mobile-first shell for the Rider portal, replacing the desktop sidebar with a bottom navigation bar and responsive header.

## User Review Required

> [!IMPORTANT]
> This refactor centralizes the Rider layout into a mobile-app experience. It will affect all `/rider/*` routes.

- **Mobile First**: Optimized for 320px to 430px widths, with a centered preview on desktop.
- **Bottom Navigation**: Fixed bar with Home, History, Gigs, Pocket, and More.
- **Support Vertical Flow**: Refactoring the Support page to prevent desktop-style cramped layouts.
- **Safe Area Support**: Ensuring no content is hidden behind notch or home indicator.

## Proposed Changes

### Rider Shell & Layout
#### [FIX] `src/routes/rider.tsx`
- Remove the 250-350px desktop sidebar.
- Implement a fixed bottom navigation bar with large touch targets.
- Implement a responsive header with back button, title, and quick actions (SOS, Notifications, Profile).
- Add safe-area padding (`env(safe-area-inset-bottom)`).
- Center the content at `max-width: 430px` on all devices.

### Page Containers
#### [MOD] `src/routes/rider.index.tsx`, `src/routes/rider.history.tsx`, etc.
- Standardize page containers to `width: 100%`, `max-width: 430px`, `margin: auto`.
- Ensure consistent horizontal padding (16px).
- Remove fixed widths and desktop grid columns that cause horizontal overflow.

### Support Portal
#### [FIX] `src/routes/rider.support.tsx`
- Refactor to a strictly vertical mobile flow.
- Ensure tabs and ticket lists occupy full width without absolute positioning overlaps.

### Active Delivery UI
#### [MOD] `src/routes/rider.active.tsx`
- Stack pickup/delivery details vertically for mobile.
- Adjust map height and control placement for small viewports.
- Ensure action buttons (Start Trip, Arrived, etc.) are large and easily tappable.

## Technical Details
- Use Tailwind CSS `max-w-[430px] mx-auto` for the root container.
- Use `pb-[calc(80px+env(safe-area-inset-bottom))]` to prevent content overlapping the bottom nav.
- Ensure `viewport-fit=cover` is handled via CSS env variables.
- Preserve all existing business logic, auth guards, and API integrations.

## Verification Plan
### Automated Tests
- `bunx tsgo` for type safety.
- `lovable-exec build:dev` for production build verification.

### Manual Verification (Playwright)
- Inspect at 320x568 (iPhone SE), 390x844 (iPhone 13), 430x932 (iPhone 14 Pro Max).
- Check navigation between Home, History, Gigs, and Support.
- Verify SOS modal and Notifications accessibility.
- Verify no horizontal scrollbars exist on any Rider route.
