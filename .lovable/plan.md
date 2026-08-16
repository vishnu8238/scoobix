# Plan: Authoritative Gig Migration and Rider Booking

Migrate Logistics and Rider portals to use a single authoritative `gigs` table in InsForge, enabling real booking, capacity enforcement, and cross-portal real-time updates.

## User Review Required

> [!IMPORTANT]
> - The authoritative table will be `gigs`.
> - Demo data will be seeded into the real `gigs` table with `is_demo: true` to ensure they are genuinely bookable.
> - Capacity will be backend-derived based on the count of `gig_participants`.

## Proposed Changes

### 1. Authoritative API Centralization
- Update `src/lib/gigs-api.ts` to use `gigs` as the primary table.
- Normalize all gig and participant operations through this file.
- Implement capacity-checked enrollment.

### 2. Logistics Dashboard Repair
- Remove demo data fallbacks that use local objects.
- Implement idempotent seeding of demo gigs into the `gigs` table on page load/mount.
- Ensure the "Create Gig" flow uses the authoritative table and triggers realtime updates.
- Refactor `src/routes/logistics.gigs.$gigId.tsx` to use `gigs` (currently using `rider_gigs`).

### 3. Rider Portal Integration
- Update `src/routes/rider.requests.tsx` to use `fetchGigs` from `gigs-api.ts`.
- Replace fabricated capacity display with real counts derived from `gig_participants`.
- Implement slot booking with validation (duplicate check, capacity check, status check).
- Ensure "Booked" and "History" tabs use authoritative data.

### 4. Real-time Synchronization
- Leverage `realtime-bus.ts` and `useTableVersion` to ensure Logistics updates immediately reflect in the Rider app.

## Technical Details

### Authoritative Schema
- **Table**: `gigs`
- **Columns**: `id`, `title`, `description`, `reward_amount`, `target_deliveries`, `start_time`, `end_time`, `status`, `zone_id`, `city_id`, `capacity`, `created_at`.
- **Participants**: `gig_participants` table (columns: `id`, `gig_id`, `rider_id`, `status`, `joined_at`).

### Data Migration Logic
- On Logistics Gig page mount:
  - Check if demo gigs ("Morning Shift", etc.) exist in `gigs`.
  - If not, insert them with `metadata.is_demo: true`.
- Rider `fetchGigs` will filter for `ACTIVE` or `SCHEDULED` status and match rider's zone/city where applicable.

### Booking Flow
- `enrollInGig` will:
  1. Fetch current participant count for the gig.
  2. Verify count < `capacity`.
  3. Verify gig status is `ACTIVE`.
  4. Perform `INSERT` into `gig_participants`.
  5. Announce change via `realtime-bus`.
