# Logistics Dashboard Definitively Repair

Definitively resolve the "relation does not exist" error in the Logistics portal while maintaining hardened data resilience and cross-portal stability.

## User Review Required

> [!IMPORTANT]
> This fix uses a **Hardened Data Layer** approach. Instead of assuming the production schema is perfectly synced, the app now handles missing tables gracefully (returning empty states) and supports fallback table names (e.g., `delivery_zones` vs `logistics_zones`). 

- **Access**: The fix preserves current RoleGuard behavior. You must be logged in as an authorized Logistics Staff member to see data.
- **Branding**: No changes to Scoobix branding or portal layouts.

## Proposed Changes

### 1. Data Layer Hardening
- Update `src/lib/insforge-crud.ts` to return `[]` on Postgres error `42P01` (missing table).
- Guard against 401 redirect loops during auth hydration.

### 2. Standardized API & Fallbacks
- Centralize table names in `src/lib/zones-api.ts`.
- Implement automatic fallback logic: if `logistics_zones` is missing, try `delivery_zones`.
- Use explicit column selection to avoid "missing column" errors in production.

### 3. Server Functions Synchronization
- Update `src/lib/zones.functions.ts` and `src/lib/dispatch-engine.functions.ts` to use shared table constants.

### 4. Realtime Hooks
- Update `useTableVersion` in `admin.live.tsx` to watch both primary and fallback table names.

## Technical Details

- **Table Names**: `logistics_zones`, `subzones`, `drivers`, `orders`, `audit_logs`.
- **Fallbacks**: `delivery_zones`, `delivery_subzones`.
- **Error Codes Handled**: `42P01` (Relation does not exist), `42703` (Undefined column).
- **Auth States**: `initializing`, `session_resolving`, `authorization_resolving`.

## Verification Plan

- [x] **Build Check**: Run `bun run build` to ensure no TypeScript regressions.
- [x] **Smoke Test**: Use Playwright to verify `/logistics/zones` loads without a crash (shows empty or login) rather than a "Relation does not exist" error.
- [ ] **Production Check**: User to verify on `scoobix.lovable.app` after next publish.
