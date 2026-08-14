---
title: Logistics Dashboard Expansion
description: Implementing feature parity for the Logistics portal with focus on Gigs, Operations, Disputes, and CMS.
---

# Logistics Dashboard Expansion Plan

The goal is to implement the full operational feature set for the Scoobix Logistics portal, resolving current 404s and achieving parity with the reference UI specifications.

## Proposed Changes

### 1. Routes and Navigation
- **Repair Gig Details**: Fix the accidentally created `src/routes/logistics.gigs..tsx` (already moved to `src/routes/logistics.gigs.$gigId.tsx`) and implement the full detail view including slot capacity management.
- **Implement Operations**: Build `src/routes/logistics.operations.tsx` with live status counters and filtering logic.
- **Implement Disputes**: Build `src/routes/logistics.disputes.tsx` with a queue managed by ID and Ref Type.
- **Implement CMS Studio**: Build `src/routes/logistics.cms.tsx` for story publishing and driver communication.

### 2. Components and UI
- **Gigs Detail View**:
  - Capacity Change modal: Allow logistics staff to adjust slot limits in real-time.
  - Rider list for specific slots: Re-use/adapt `GigParticipant` types from `gigs-api.ts`.
- **Rider Profiles (Logistics Edition)**:
  - Tabbed interface: Profile, KYC Docs, Live Stats, Wallet/Earnings, and Performance history.
  - Verification integration: Surface KYC status and allow direct review from the profile.
- **Support & Audit**:
  - Refine `src/components/cravio/SupportTickets.tsx` property mappings.
  - Ensure all logistics action buttons (Suspend, Reject, Verify) are correctly hooked to the backend via `portal-authorization.ts` and `insforge-crud.ts`.

### 3. Data layer
- **Sync Overrides**: Ensure `src/routes/logistics.drivers.tsx` status overrides sync with the `drivers` table verification state, rather than just local KV storage, to ensure multi-session consistency.

## Technical Details

- **Framework**: TanStack Start v1 / React 19.
- **Data**: InsForge SDK via `insforge-crud.ts`.
- **Realtime**: Use `useTableVersion` and `useLiveTable` for the operations and gig feeds.
- **Security**: All views gated by `RoleGuard` (logistics/admin).

## Verification Plan

- **Route Check**: Verify `/logistics/operations`, `/logistics/disputes`, and `/logistics/cms` resolve to their respective components.
- **Functional Check**: Verify the "Capacity Change" workflow updates the `rider_gigs` record and reflects in the UI.
- **Auth Check**: Verify that a non-logistics staff user is correctly blocked from these routes.
