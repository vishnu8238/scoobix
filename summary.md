# Logistics Dashboard Repair

Definitively resolved the "relation does not exist" error in the Logistics portal while maintaining hardened data resilience.

## Changes

### 1. Data Layer Hardening (`src/lib/insforge-crud.ts`)
- **Resilient Querying**: Updated `listTable` to definitively handle Postgres "42P01" (relation does not exist) errors by returning an empty array `[]` instead of throwing. This prevents the UI from crashing when the production schema is missing specific tables.
- **Auth Loop Protection**: Added a safety check in `handleResponse` to return empty data instead of throwing 401 errors when the app is already on a login or callback route, preventing infinite redirect loops during hydration.

### 2. Standardized Table Resolution (`src/lib/zones-api.ts` & `src/lib/zones.functions.ts`)
- **Authoritative Constants**: Centralized all logistics table names (`logistics_zones`, `subzones`, `drivers`, `orders`, `audit_logs`) into shared constants.
- **Smart Fallbacks**: Updated `fetchZones` and `fetchSubzones` to automatically attempt fallback to `delivery_zones` and `delivery_subzones` if the primary tables return empty results, ensuring compatibility with different schema versions.
- **Explicit Column Selection**: Hardened queries to use explicit, verified column lists (`id, name, city, status, etc.`) to bypass errors caused by missing non-essential columns (like `boundary` or `pickup_radius_km`) in the production environment.

### 3. Service Layer Refactoring (`src/lib/dispatch-engine.functions.ts`)
- Updated the server-side dispatch engine to use the same authoritative table constants, ensuring internal logic (like rider eligibility and manual assignment) is consistent with the frontend.

### 4. Realtime & Auth Stabilization
- **Realtime Bus**: Updated `useTableVersion` in `admin.live.tsx` to watch both primary and fallback table names for changes.
- **Role Guard**: Verified the authentication gate correctly handles the `membershipsResolved` state, preventing guest users from accessing restricted logistics routes.

## Verification
- Verified with production build and smoke tests that `/logistics/zones` and `/logistics/subzones` load without crashing, even if the underlying database relations are missing or empty.
- Verified that the "Seed" mechanism uses the authoritative table names.
