# Logistics Portal Hardening Plan

Definitive fix for production defects in Gig Management, Partner Enrollment, Order Management, and Zone/Map geometry.

## User Review Required

> [!IMPORTANT]
> - **Schema Alignment**: I will derive `center_lat`/`center_lng` from the GeoJSON boundary for zones to ensure map markers work.
> - **Demo Data**: "Seed Demo Orders" will be protected by a role check and tagged with `is_demo: true` to avoid polluting production data.
> - **Build Fix**: I have already removed residual Supabase files and expanded the `Role` enum to support granular logistics levels.

- Which specific cities/zones should be seeded for the initial Gig Management test?
- Do you have specific contact phone formats required for the Add Partner form?

## Proposed Changes

### 1. Gig Management Fixes
- **Modal Logic**: Update `CreateGigModal` to only reset/close on a 201 Created response.
- **Timezone Safety**: Force `start_time` and `end_time` to UTC ISO strings to prevent date selection mismatches.
- **State Update**: Call `invalidateQueries` or local `load()` after success to ensure the new gig appears immediately.

### 2. Delivery Partners (Enrollment)
- **New Component**: Create `AddPartnerModal` with fields for Name, Email, Phone, Vehicle Type, and Status.
- **CRUD Logic**: Use `createRecord` in `src/lib/insforge-crud.ts` to persist the new partner.
- **Counters**: Update the LOGIN/LOGOUT/IDLE chips by refetching the partner list.

### 3. Orders Demo & Management
- **Seeding Service**: Implement a `seedDemoOrders` server function that generates 5-10 orders across all statuses.
- **Management UI**: Overhaul `/logistics/orders/$orderId` to use `patchOrder` for status transitions.
- **Audit Logging**: Add a basic audit log entry for every status change to track dispatcher actions.

### 4. Zones & Map Geometry
- **Payload Alignment**: Fix the `undefined` object error in `createNewZone` by strictly typing the Zod schema.
- **Interactive Drawing**: Enhance `ZoneFormModal` to allow polygon creation via map clicks, deriving the center point automatically.
- **Hierarchy**: Ensure Subzones correctly link to `zone_id` and render within their parent's boundary.

## Technical Details
- **InsForge SDK**: Using `insforge.auth` for session management and `insforge.database` for CRUD.
- **Types**: Expanding `src/lib/types.ts` to include `dispatcher`, `zone_manager`, and `logistics_admin`.
- **API**: Standardizing all Logistics API calls in `src/lib/zones.functions.ts` and `src/lib/gigs-api.ts`.
