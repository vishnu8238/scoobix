# Plan - Definitively Fix Logistics Zones Relation Error

The goal is to resolve the `relation "public.logistics_zones" does not exist` error in production by ensuring the data layer is resilient, uses verified table names, and provides a clear path for schema initialization if missing.

## User Review Required

> [!IMPORTANT]
> The error `relation "public.logistics_zones" does not exist` indicates the table is missing from your InsForge production database. This plan fixes the application to handle this gracefully and provides a "Seed" button to create the data structure if you have the necessary permissions.

## Proposed Changes

### Data Layer Hardening
- **Standardize Table Names**: Lock `logistics_zones` and `subzones` as the authoritative names across all API files (`zones-api.ts`, `zones.functions.ts`).
- **Resilient Querying**: Update `listTable` in `insforge-crud.ts` to explicitly catch `42P01` (Relation does not exist) errors and return an empty array `[]` instead of throwing an error that breaks the UI.
- **Explicit Columns**: Ensure all queries use a subset of verified columns (`id`, `name`, `status`) to avoid "Undefined Column" errors if the schema is partially implemented.

### Logistics Portal Repair
- **Zones & Subzones Routes**: Update `/logistics/zones` and `/logistics/subzones` to handle empty states gracefully.
- **Seed Mechanism**: Verify the "Seed Vadodara" function in `zones.functions.ts` uses the correct InsForge SDK patterns to attempt table creation/data insertion.
- **Role Guard Stability**: Ensure the `RoleGuard` does not trigger redirect loops while auth is hydrating.

### Verification Plan
- **Production Build**: Run `bun run build` to ensure no regression in type safety.
- **Smoke Test**: Simulate an unauthenticated and authenticated state to verify that the UI shows "No zones found" instead of a crash when the table is missing.

## Technical Details

### Updated Table Mapping
```typescript
// src/lib/zones-api.ts
export const TABLE_ZONES = "logistics_zones";
export const TABLE_SUBZONES = "subzones";
```

### Error Normalization Hunk
```typescript
// src/lib/insforge-crud.ts
if (err.message?.includes("42P01") || err.message?.includes("does not exist")) {
  console.warn(`[DB_SCHEMA] Table ${table} missing in production.`);
  return [] as T[];
}
```
