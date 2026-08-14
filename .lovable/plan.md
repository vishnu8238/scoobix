# Logistics Dashboard Expansion Plan

Implement a complete operational feature set for the Logistics portal, reproducing the functional behavior and information architecture from reference screenshots while maintaining Scoobix's design system and InsForge-only runtime.

## User Impact
Logistics administrators will gain full control over gigs, fleet capacity, driver onboarding/KYC, operational disputes, and driver communication through a unified, high-fidelity dashboard.

## Technical Details
- **Architecture**: TanStack Start v1 with InsForge-backed server functions and CRUD.
- **Real-time**: Leverages `useTableVersion` and `useChannelVersion` for live state updates without manual refreshing.
- **Security**: Hardened RLS policies and portal access guards (Logistics/Admin only).

## Proposed Changes

### 1. Navigation & Shell Expansion (`src/routes/logistics.tsx`)
- Enhance the sidebar with collapsible navigation and global search.
- Add notification count badges and active-state indicators for all new routes.

### 2. Gigs & Capacity Management (`src/routes/logistics.gigs.tsx`)
- **Gig/Slot Details**: A new detail view showing allocation, assigned riders, and audit history.
- **Capacity Workflow**: Implementation of the "Capacity Change" modal with reason tracking and validation.
- **Rider Slot View**: Search and view specific rider slot memberships.

### 3. Verification & QC Center (`src/routes/logistics.verification.tsx`)
- **QC Details**: Expanded document checklist with "Approve/Reject/Correction" actions.
- **Document Previews**: High-fidelity previews for DL/RC documents using InsForge Storage.
- **Audit Integration**: Direct links to `kyc_audit_logs`.

### 4. Fleet Operations & Support (`src/routes/logistics.support.tsx`, `src/routes/logistics.disputes.tsx`)
- **Disputes Queue**: Status-driven workflow (Pending → Investigating → Resolved) with evidence attachments.
- **Grooming Selfies**: A dedicated review gallery for rider selfies with bulk approval options.
- **Support Detail**: Enhanced ticket conversation view with internal notes and escalation paths.

### 5. Delivery Partner Profiles (`src/routes/logistics.drivers.$driverId.tsx`)
- **Tabbed Interface**: Overview, Performance, Documents, Vehicle, and Audit History.
- **Performance Metrics**: Real-time delivery success rates and rating trends.

### 6. Communication & CMS (`src/routes/logistics.cms.tsx`)
- **Stories Hub**: A tool for publishing updates/stories to riders and partners.
- **Targeting**: Ability to scope communications by city or partner role.

## Verification Plan
1. **Build Check**: Run `bun run build` to ensure no TypeScript or pathing errors.
2. **Smoke Tests**: Verify navigation and loading states for every new route.
3. **Identity Check**: Ensure `getDisplayName` correctly resolves administrator names in headers.
4. **Publish**: Deploy to scoobix.lovable.app.
