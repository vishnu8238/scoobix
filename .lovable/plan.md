# Plan: Fix Logistics Zones Relation Error

The `/logistics/zones` route and its siblings continue to fail in production with a "relation does not exist" error because the application is attempting to query columns that do not exist in the production InsForge database. Probes have confirmed that while `logistics_zones` and `subzones` tables exist, they only contain a limited set of columns (`id`, `name`, `city`, `status`, `created_at`, `updated_at`). All geometry (`boundary`), radius, and configuration columns from the local schema are missing in production.

## User Review Required

> [!IMPORTANT]
> **Production Schema Discrepancy:** The live InsForge database for project `9d873abd...` is missing the `boundary` (GeoJSON) and logistics configuration columns (radius, distance limits) that the application expects. This prevents drawing zones on the map and configuring operational limits.
>
> **Action taken:** I have modified the application to query only the confirmed existing columns. This will resolve the "relation does not exist" error and allow the list of zones to load, but map drawing and radius settings will be disabled until the database schema is updated or columns are added.

## Proposed Changes

### Data Access Layer
- Update `src/lib/zones-api.ts` to use explicit column selection (`id,name,city,status,created_at,updated_at`) instead of `*` for both `logistics_zones` and `subzones`.
- Update `src/lib/zones.functions.ts` to use the same explicit column selection in server functions.
- Update `logAudit` in `src/lib/zones-api.ts` to map fields to the verified `audit_logs` schema (`action`, `actor_id`, `created_at`).

### UI and Components
- Modify `src/components/ZoneFormModal.tsx` to remove inputs for missing columns (radius, distance, boundary) to prevent 400 errors on save.
- Update `src/components/admin/ZoneManager.tsx` and `src/components/admin/ZoneDirectoryItem.tsx` to handle the absence of `boundary` data gracefully.
- The map will still render but will not show polygons until the `boundary` column is added to the backend.

### Logistics Ops
- Update `src/lib/dispatch-engine.functions.ts` and `src/lib/geo-resolution.ts` to be resilient to missing zone metadata.

## Technical Details
- **Tables:** `logistics_zones`, `subzones`, `audit_logs`, `portal_access`.
- **Query Strategy:** Restricted `SELECT` to bypass schema cache misses on undefined columns.
- **Error Handling:** Enhanced error normalization in `insforge-crud.ts` to differentiate between "Table Missing" and "Column Missing".

## Verification Plan
- [ ] Run production build (`bun run build`) to ensure no TypeScript regressions.
- [ ] Automated smoke test of `/logistics/zones` to confirm the relation error is gone.
- [ ] Verify that creating/listing zones works with the reduced field set.
