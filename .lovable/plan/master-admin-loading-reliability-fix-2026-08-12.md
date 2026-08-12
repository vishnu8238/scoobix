# Master Admin Loading & Reliability Fix

Fix the "stuck on loading" issue in the Master Admin dashboard by isolating optional data requests and ensuring deterministic completion of loading states.

## User Review Required

> [!IMPORTANT]
> - I will be making the dashboard fault-tolerant: if the Support or Zone tables are missing or inaccessible, the dashboard will still render with "Unavailable" markers instead of spinning forever.
> - I will remove mock address and GPS data from the Driver Profile page as requested.

## Proposed Changes

### 1. Dashboard Loading Isolation (`src/routes/admin.index.tsx`)
- Replace the all-or-nothing `Promise.all` with isolated handling.
- Group requests into **Core** (Orders, Users, Restaurants, Drivers) and **Optional** (Zone Stats, Support Analytics).
- Use `try...finally` to guarantee `setLoading(false)` always fires.
- Ensure failure in `getZoneStats()` or `listAllTickets()` doesn't block `AdminDashboard` from rendering.

### 2. Admin Guard Safety (`src/components/cravio/AdminGuard.tsx`)
- Add a timeout or fallback to `checkAdminEmail` to prevent infinite "Security Verification" if the server function hangs.
- Ensure `authorized` is explicitly set even on failure (with an error message).

### 3. Data Integrity & Driver Profile (`src/components/admin/DriverProfileComponents.tsx`)
- Remove hardcoded "Shiv Villa Residency 401", "Vadodara", etc.
- Replace with "—" or "Not available" when backend data is missing.
- Remove hardcoded Google Maps static marker coordinates.

### 4. Code Cleanup & Coupling
- Verify `DriverProfileComponents.tsx` is only imported where needed (already seems correct in `$driverId.tsx`).

## Technical Details

- **Fault Tolerance**: Implementing a pattern where optional analytical queries are wrapped in `try/catch` and their results are treated as nullable.
- **Safety**: Adding a `try/finally` block to the `load` function in `admin.index.tsx` to ensure `loading` state is resolved regardless of network status.
- **Data Policy**: Strict adherence to "No Mock Data" rule, ensuring UI reflects real backend state only.

## Verification Plan

1. **Automated Reproduction**: Use Playwright to simulate a hanging backend request for `support_tickets` and verify the dashboard still renders.
2. **Manual Check**:
   - Open `/admin` and verify fast load.
   - Hard refresh `/admin` and verify it survives.
   - Open a Driver Profile and verify no mock addresses are visible.
3. **Audit**: Trace all imports to ensure no regressions in auth or other portals.
