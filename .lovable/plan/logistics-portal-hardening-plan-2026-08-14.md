# Logistics Portal Hardening Plan

Fix confirmed production blockers in Orders and Zones workflows while maintaining InsForge-only runtime.

## User Review Required
- **Maps Fallback**: If Google Maps is unavailable, I will use a list-based creation flow with address search (via searchPlaces) and fallback coordinate entry to ensure zones can always be created.
- **Demo Data**: The "Seed Demo Orders" will create idempotent demo records tagged with `logistics_test_v2`.

## Proposed Changes

### 1. Orders & Manage Route
- **Demo Seeding**: Update `seedDemoOrders` in `src/lib/logistics-ops.functions.ts` to be fully idempotent by checking for existing `logistics_test_v2` tags before creation. Ensure real InsForge errors are logged and surfaced.
- **Order Details**: Verify `src/routes/logistics.orders.$orderId.tsx` is correctly registered in the route tree and renders the comprehensive management UI (Timeline, Status updates, Rider assignment).
- **Navigation**: Fix navigation in `src/routes/logistics.orders.tsx` to ensure the "Manage" link correctly transitions to the detail view.

### 2. Zones & Map Workflow
- **Map Resiliency**: Update `GoogleMap` component in `src/components/maps/GoogleMap.tsx` and `GoogleMapsProvider.tsx` to handle missing API keys gracefully without showing "Page can't load Google Maps correctly".
- **Boundary Validation**: Harden `ZoneFormModal.tsx` to ensure `boundary` (GeoJSON Polygon) is never undefined. Compute `center_lat`/`center_lng` from the first polygon vertex if not provided.
- **Subzones**: Ensure `SubzoneFormModal.tsx` correctly inherits properties from the parent zone and uses the same boundary management logic.
- **Real-time Refresh**: Trigger authoritative list refreshes after zone/order creation using existing realtime bus hooks.

### 3. Verification & Cleanup
- **Build Integrity**: Ensure `src/integrations/supabase` is completely removed to pass the `prebuild.js` scan.
- **Regression Tests**: Run `bunx tsgo --noEmit` and execute Playwright tests for Orders and Zones flows.
