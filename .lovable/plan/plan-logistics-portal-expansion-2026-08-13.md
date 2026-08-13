# Plan: Logistics Portal Expansion

Duplicate the Master Admin portal features for the Logistics portal, providing logistics managers with identical operational tools while ensuring strict role-based data isolation.

## User Review Required

> [!IMPORTANT]
> The data isolation logic assumes standard table relationships (e.g., `logistics_zone_id` on drivers/orders). If your database schema uses different field names, please specify them.

- **Role Verification**: Confirm if "logistics" managers should only see data for their assigned zones, or if they have global logistics access.
- **RLS Implementation**: I will add RLS policies to the database. Ensure no existing policies conflict with these new additions.

## Proposed Changes

### Logistics Portal Infrastructure
- **Refactor `src/routes/logistics.tsx`**: Replace the diagnostic layout with a full sidebar navigation layout identical to `src/routes/admin.tsx`, but scoped to the `logistics` portal.
- **Update `RoleGuard`**: Ensure `RoleGuard` correctly handles the "logistics" role and redirects to the unified login page if needed.

### Core Portal Features (Duplication)
- **Dashboard (`/logistics/dashboard`)**: Duplicate `admin.index.tsx` to `logistics.index.tsx`.
- **Drivers (`/logistics/drivers`)**: Duplicate `admin.drivers.tsx` to `logistics.drivers.tsx`.
- **Live Operations (`/logistics/live`)**: Duplicate `admin.live.tsx` to `logistics.live.tsx`.
- **Logistics Map (`/logistics/map`)**: Create `logistics.map.tsx` based on the map view in `admin.live.tsx`.
- **Manual Dispatch (`/logistics/dispatch`)**: Duplicate `admin.dispatch.tsx` to `logistics.dispatch.tsx`.
- **Gig Management (`/logistics/gigs`)**: Duplicate `admin.gigs.tsx` to `logistics.gigs.tsx`.
- **Orders (`/logistics/orders`)**: Duplicate `admin.orders.tsx` to `logistics.orders.tsx`.
- **Zones & Delivery (`/logistics/zones`)**: Duplicate `admin.zones.tsx` to `logistics.zones.tsx`.
- **Subzones (`/logistics/subzones`)**: Duplicate `admin.subzones.tsx` to `logistics.subzones.tsx`.

### Data Isolation & Filtering
- For every new Logistics route, implement server-side filtering (if possible via `listTable` params) or client-side filtering based on the manager's assigned zones/territory.
- Update `listTable` calls to include filters like `logistics_zone_id=eq.${userZoneId}` where applicable.

### Database & Security
- **RLS Policies**: Create a migration to add RLS policies for the `logistics` role on tables: `drivers`, `orders`, `gigs`, `delivery_zones`, `delivery_subzones`.
- **Grants**: Ensure the `authenticated` role has necessary `SELECT/INSERT/UPDATE` permissions on these tables.

## Technical Details
- **Unified Components**: Continue using `DataTable`, `StatusBadge`, and `GoogleMap` components to maintain UI consistency.
- **Navigation Structure**: The logistics sidebar will include the 9 requested features, using the same Lucide icons as the Admin portal.
- **Auth Store Integration**: Use `useAuth()` to retrieve the current manager's ID and assigned zones for filtering.

## Verification Plan

### Manual Verification
1. Sign in as a Logistics Manager.
2. Verify access to `/logistics/dashboard` and check KPI accuracy.
3. Navigate through all 9 menu items to ensure pages load without "Illegal constructor" or other runtime errors.
4. Verify that the Drivers and Orders lists only show records within the manager's jurisdiction.
5. Test a Manual Dispatch operation (assigning a driver to an order).

### Automated/Code Checks
- Build the project to ensure no routing or type errors.
- Verify RLS policies via `supabase--read_query` to ensure they are active.
