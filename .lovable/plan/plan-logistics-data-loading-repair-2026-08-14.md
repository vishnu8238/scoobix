# Plan: Logistics Data-Loading Repair

Repair confirmed production defects in Logistics data loading and Google Maps configuration while maintaining branding and InsForge-only architecture.

## Proposed Changes

### 1. Data Access Hardening
- **insforge-crud.ts**: Enhance `listTable` to handle specific InsForge table name aliases (e.g., mapping `logistics_zones` to `delivery_zones` if needed, though we will update the callers to be authoritative).
- **zones-api.ts**: Update table names to `delivery_zones` and `delivery_subzones` to match the real schema found in server functions.

### 2. Map & Zone Repair
- **logistics.map.tsx**: 
    - Fix data loading by using correct table names.
    - Add a fallback view when Google Maps fails to load or the API key is missing.
- **logistics.zones.tsx** & **logistics.subzones.tsx**:
    - Fix table names and handle empty states.
    - Ensure Google Maps config errors don't block the entire page.

### 3. Dashboard Panel Stabilization
- **logistics.disputes.tsx**, **logistics.cms.tsx**, **logistics.ads.tsx**, **logistics.audit.tsx**:
    - Add explicit empty states and "No data" messaging.
    - Normalize error handling to prevent "stuck loading" states.
- **logistics.reports.tsx**:
    - Ensure `useAnalytics` handles empty datasets gracefully with safe defaults.

### 4. Verification
- Create a Playwright smoke test script to verify:
    - Map renders or shows clear fallback.
    - Tables render either rows or "No data found".
    - No infinite loading spinners are present.

## Technical Details
- Table Mapping:
    - `logistics_zones` -> `delivery_zones`
    - `subzones` -> `delivery_subzones`
    - `operational_disputes` (correct)
    - `cms_stories` (correct)
    - `cms_ads` (correct)
    - `loyalty_audit_logs` (correct)
- Maps: Using `@vis.gl/react-google-maps` via `GoogleMapsProvider.tsx` which already handles key fetching. We will add a branded UI fallback in `GoogleMap.tsx` for `apiKey === null`.
