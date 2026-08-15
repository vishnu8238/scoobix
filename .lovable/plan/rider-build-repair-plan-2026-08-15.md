---
name: Rider Build Repair
description: Fixes TypeScript errors in rider.requests.tsx and rider.active.tsx related to undefined variables and missing logic.
type: feature
---

# Rider Build Repair Plan

Repair the current failed Rider build by fixing TypeScript errors in `src/routes/rider.requests.tsx` and `src/routes/rider.active.tsx`.

## Proposed Changes

### Rider Portal
#### [rider.requests.tsx]
- Ensure `error` local state is used correctly.
- Restore `filtered` calculation or ensure the render logic uses the correct filtered arrays.
- Fix any missing `loadGigs` or `loadData` references.

#### [rider.active.tsx]
- Replace `driverError` with local `error` state.
- Fix `load()` vs `loadData()` call.
- Replace `setShowFailedModal` with `toast.info`.

## Verification Plan

### Automated Tests
- Run `bun run build` to ensure no regression in build.
- Run `scripts/prebuild.js` to verify no Supabase imports.
- Run `tsc --noEmit` to verify type safety.

### Manual Verification
- Verify deterministic empty/error states in Rider Gigs and Active Delivery.
