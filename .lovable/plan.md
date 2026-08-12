# Plan: Master Admin Operations Control Center Upgrade

Upgrade the Scoobix Master Admin into a complete operational control center by integrating and enhancing existing modules for logistics, zones, support, and platform management.

## User Review Required

> [!IMPORTANT]
> This upgrade assumes the existing `logistics_staff` table and `portal_access` system are the authoritative sources for logistics permissions. Manual dispatch overrides will be logged to `loyalty_audit_logs` as per existing patterns.

- Does the proposed KPI set for the Dashboard cover all your priority metrics?
- Should any specific "Gig" or "Offer" features be restricted further beyond the Master Admin role?

## Technical Details

- **Navigation**: Update `src/routes/admin.tsx` to include new operational modules (Gigs, Reports, Dispatch, Audit).
- **Dashboard**: Refactor `src/routes/admin.index.tsx` to use `getZoneStats` and `computeSupportAnalytics` for a unified overview.
- **Live Operations**: Enhance `src/routes/admin.operations.tsx` with manual assignment/override capabilities from the Logistics portal.
- **Live Tracking**: Integrate `src/routes/admin.live.tsx` map layers (Zones, Riders, Orders) into a unified view.
- **Partner Management**: Refactor `src/routes/admin.drivers.tsx` to include KYC status and zone assignment.
- **Support**: Finalize `src/routes/admin.support.tsx` integration with order/customer context.
- **Gigs/Offers**: Create/integrate `src/routes/admin.gigs.tsx` and ensure `src/routes/admin.coupons.tsx` covers operational requirements.
- **Audit Logs**: Implement `src/routes/admin.audit.tsx` reading from `loyalty_audit_logs`.

## Proposed Changes

### 1. Navigation & IA
- Update `NAV` in `src/routes/admin.tsx` to group operational modules logically.
- Add routes: `/admin/gigs`, `/admin/dispatch`, `/admin/audit`.

### 2. Operational Dashboard
- Refactor `AdminDashboard` in `src/routes/admin.index.tsx`.
- Aggregated KPIs: Orders (Pending, Unassigned), Partners (Online, Available), Zones (Active), Tickets (Open).
- Deep-links from KPIs to filtered modules.

### 3. Unified Logistics & Map
- Enhance `src/routes/admin.live.tsx` to show live rider locations and active orders.
- Reuse `GoogleMap` component with layers for Zones, Subzones, and active shipments.

### 4. Partner & Performance
- Update `src/routes/admin.drivers.tsx` with detailed profile views and history.
- Integrate `src/routes/admin.performance.tsx` for infrastructure health monitoring.

### 5. Support & Dispatch
- Ensure `src/routes/admin.support.tsx` allows jumping to order/rider context.
- Integrate `logistics.dispatch` functionality directly into `admin.operations` or a new `admin.dispatch` route.

### 6. Security & Audit
- Ensure all sensitive writes use `logAudit` helper from `src/lib/audit-api.ts`.
- Restrict all modules behind the existing `AdminGuard`.
