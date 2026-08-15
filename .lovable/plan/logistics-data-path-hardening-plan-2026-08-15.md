# Logistics Data Path Hardening Plan

Definitively fix the Logistics City/Zone/Gig data path by identifying the correct authoritative InsForge tables, establishing an idempotent server-side prerequisite seed, and hardening the query path with real-time diagnostics.

## User-facing changes
- **Working Gig Creation**: The "Create New Gig" modal will correctly load available Cities and Zones.
- **Verified Data Path**: A diagnostic panel in the modal will show the status of database connections and seeding.
- **Improved Reliability**: Automatic seeding of prerequisite records if tables are empty.

## Technical Details

### 1. Schema Discovery & Mapping
- Run a multi-schema database probe to identify the real table names for `cities`, `zones`, `logistics_zones`, and `gigs`.
- Update `src/lib/zones-api.ts` and `src/lib/gigs-api.ts` to use these authoritative table names.

### 2. Idempotent Server-Side Seeding
- Overhaul `seedLogisticsPrerequisites` in `src/lib/logistics-ops.functions.ts`.
- Implement a read-then-insert workflow using the authenticated SDK.
- Ensure City 1 and Zone 1 are created with all required fields (boundary, status, city_id).
- Return specific success/error counts and raw diagnostic logs to the client.

### 3. UI Hardening in `CreateGigModal`
- Await the `seedLogisticsPrerequisites` call before the first City/Zone load.
- Implement explicit error handling for 404 (missing table) and 401 (auth) errors.
- Display a "Seed Status" diagnostic panel only when data is missing or a seed is triggered.
- Fix City/Zone mapping to ensure the selected IDs are correctly used in gig creation.

### 4. Verification & Cleanup
- Verify end-to-end Gig creation in the production-like preview.
- Ensure no residual Supabase imports remain in the codebase.
- Final build and publish to https://scoobix.lovable.app.
