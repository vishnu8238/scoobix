# Master Admin Order Details Upgrade

This plan upgrades the Master Admin Order Details view to a comprehensive operational control center. It integrates real-time tracking, rider assignment, financial breakdowns, and a detailed audit timeline using existing Scoobix infrastructure.

## User Review Required

> [!IMPORTANT]
> - **Rider Assignment**: I will use the existing `dispatch-engine.ts` logic for eligibility but provide a manual override for Admins.
> - **Real-time**: The page will use `useLiveOrder` to stay updated without refreshes.
> - **Permissions**: Operations like status overrides and rider reassignment will be gated by admin role checks.

## Proposed Changes

### Data & Logic
#### [NEW] `src/lib/order-details-api.ts`
- Create a specialized fetcher that joins Order, Restaurant, Customer, and Rider data.
- Include logic for calculating financial breakdowns (commissions, taxes, fees) based on existing rules.
- Add methods for fetching order history/audit logs scoped to an order.

#### [MODIFY] `src/lib/orders-api.ts`
- Add status transition validation logic to ensure only valid state changes are allowed via UI.
- Export a list of valid status transitions for the Admin UI.

### Components
#### [NEW] `src/components/admin/OrderHeader.tsx`
- Real-time status badges (Order, Rider, Payment).
- Action buttons: Refresh, History, Assign Rider, Update Status, Track.

#### [NEW] `src/components/admin/OrderKpiCards.tsx`
- KPI grid for Total Amount, Payment Method, Date/Time, and Kitchen Status.

#### [NEW] `src/components/admin/OrderEntityCards.tsx`
- `RestaurantCard`: Contact info, location, status, and subzone.
- `CustomerCard`: Normalized address, contact details, and order history link.
- `RiderCard`: Profile, current location, active order count, and assignment status.

#### [NEW] `src/components/admin/OrderItemsList.tsx`
- Tabular display of items, quantities, and prices.
- Supports customizations and instructions.

#### [NEW] `src/components/admin/OrderFinancials.tsx`
- Detailed breakdown of subtotal, commissions, fees, taxes, and grand total.

#### [NEW] `src/components/admin/OrderLifecycleTimeline.tsx`
- Visual step-through of the order journey (Created -> Preparing -> Picked Up -> Delivered).
- Separate section for Rider-specific events.

#### [NEW] `src/components/admin/OrderDeliveryProof.tsx`
- Display pickup/delivery photos and OTPs if available in the storage/schema.

#### [NEW] `src/components/admin/OrderTrackingMap.tsx`
- Google Maps view showing Restaurant, Customer, and live Rider location.
- Uses `src/lib/maps-service.ts`.

### Routes
#### [NEW] `src/routes/admin.orders.$orderId.tsx`
- The main container route.
- Orchestrates data loading via `useSuspenseQuery` (with `useLiveOrder` for updates).
- Implements the responsive layout: 2-column on desktop, stacked on mobile.

## Technical Details

- **Database**: Uses `orders`, `order_items`, `payments`, `drivers`, `restaurants`, `users`, and `audit_logs` tables.
- **Real-time**: `subscribeChannel('order:<id>')` for granular updates.
- **Maps**: Centralized `GoogleMap` component with custom markers for different entity types.
- **Audit**: Every admin action (status change, rider override) calls `logAudit` with `subjectType: 'order'`.
- **Responsive**: Tailwind grid (`lg:grid-cols-3`) with sidebar-like operational panel on larger screens.

## Verification Plan

### Automated Tests
- Run `vitest` on `orders-api.ts` status transition logic.
- Playwright script to verify:
    1. Navigation to `/admin/orders/[id]`.
    2. Visibility of all KPI cards and entity cards.
    3. Interaction with "Update Status" dropdown (ensuring invalid transitions are disabled).
    4. "Assign Rider" modal opening and showing eligible riders.

### Manual Verification
- Open an existing order and check if all data matches the list view.
- Perform a status update and verify the audit log record is created in `/admin/audit`.
- Verify the Google Maps tracking shows markers correctly.
