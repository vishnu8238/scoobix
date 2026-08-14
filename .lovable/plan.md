# Plan: Logistics Portal Defect Fixes & Expansions

Fix production defects in Gigs, Partners, Orders, and Zones while expanding functionality for better operational control.

## User Review Required

> [!IMPORTANT]
> - **Schema Evolution**: I will perform minimum compatible InsForge migrations to add missing fields for Gigs (city_id, completion_pct, capacity) and Partners (email, status).
> - **Demo Data**: "Seed Demo Orders" will create real InsForge rows tagged with `metadata->'is_demo' = true` to allow safe isolation.
> - **Google Maps**: I will ensure polygon drawing and place search correctly store GeoJSON boundaries in `logistics_zones`.

## Proposed Changes

### 1. Gig Management Fixes
- **Persistence**: Fix `CreateGigModal` to handle InsForge response shapes and properly close/reset.
- **Data Model**: Ensure `city_id`, `target_deliveries`, and `completion_pct` are persisted.
- **UX**: Close modal only on success, trigger `load()` refetch, and ensure date-based filtering uses consistent timezones (start/end of day).
- **Validation**: Add Zod-based validation to the create payload.

### 2. Delivery Partners Expansion
- **Add Partner Modal**: Implement a new `AddPartnerModal` component using existing InsForge CRUD.
- **Fields**: Include `name`, `email`, `phone`, `vehicle_type`, `vehicle_number`, and `status`.
- **Sync**: Refresh table and counters (`LOGIN`, `LOGOUT`, etc.) immediately after creation.
- **Identity Resolver**: Ensure the new partner is immediately visible in the list with their name resolved via the `users` table link.

### 3. Orders Demo & Management
- **Demo Seeding**: Add a `SeedDemoOrders` server function and a button in `/logistics/orders` (visible to staff).
- **Order Management**: Overhaul `/logistics/orders/$orderId` to support real status transitions via `patchOrder`.
- **Real-time**: Ensure status updates reflect in the list and counters via `realtime-bus`.

### 4. Zones & Map Geometry
- **Form Fix**: Fix the `undefined` object mismatch in `createNewZone`.
- **Geometry**: Enable polygon drawing/editing in `ZoneManager` and ensure it persists GeoJSON to `logistics_zones.boundary`.
- **Place Search**: Integrate Google Places for city/location selection.
- **Subzones**: Repair subzone creation to correctly reference the parent zone ID.

## Technical Details

- **InsForge CRUD**: Update `insforge-crud.ts` to better handle RLS `select()` failures.
- **API Consolidation**: Centralize all logistics logic in `src/lib/logistics-ops-api.ts` (new) to avoid logic duplication between server functions and client helpers.
- **Real-time**: Use `announce()` in `insforge-crud.ts` to broadcast changes to all active portal tabs.
- **Type Safety**: Strengthen `DeliveryZone` and `Gig` types to match the expanded schema.

## Acceptance Criteria

- [ ] Create a Gig for tomorrow and verify it appears when tomorrow is selected.
- [ ] Add a Partner and verify they appear in the list with "LOGOUT" status and updated "TOTAL" counter.
- [ ] Seed demo orders, open "Manage", change status to "IN PROGRESS", and verify the change in the main list.
- [ ] Draw a new Zone on the map, save it, refresh, and verify the polygon persists.
- [ ] Verify build passes with `bunx tsgo --noEmit` and no Supabase imports exist.
