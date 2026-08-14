# Logistics Portal Hardening Plan

Implement production-ready fixes for the Scoobix Logistics portal, focusing on reliability, data persistence, and UI responsiveness.

## User-Facing Changes
- **Gig Management**: Fixed "Create New Gig" to reliably persist to the database and update the list immediately.
- **Delivery Partners**: Enabled "Add Partner" form to create valid rider records with proper user association.
- **Orders Ledger**: Idempotent demo seeding with real feedback on created vs. existing records.
- **Order Details**: Guaranteed navigation from "Manage" action to the order detail workflow.
- **Zone Creation**: Robust fallback for zone creation when Google Maps is unavailable, ensuring valid GeoJSON geometry.

## Technical Details

### 1. Gig Management Reliability
- **Component**: `src/components/admin/CreateGigModal.tsx` & `src/lib/gigs-api.ts`
- **Fix**: Wrap `createGig` in a try-catch to throw actionable errors. Ensure `onSuccess` is called after successful insertion. Standardize UTC ISO date/time normalization to prevent timezone shifts in the UI.

### 2. Delivery Partner Form
- **Component**: `src/components/admin/AddPartnerModal.tsx`
- **Fix**: Enhance the form to ensure `users` and `drivers` records are linked correctly. Add explicit field validation and better error feedback for duplicate records.

### 3. Idempotent Order Seeding
- **Function**: `src/lib/logistics-ops.functions.ts`
- **Fix**: Update `seedDemoOrders` to count and report "Created" vs "Existing" orders. Ensure prerequisites (customers/restaurants) are verified before order insertion.

### 4. Order Management Navigation
- **Routes**: `src/routes/logistics.orders.tsx` & `src/routes/logistics.orders.$orderId.tsx`
- **Fix**: Verify the `Link` component in the ledger table correctly targets the `$orderId` route. Ensure the detail route loader handles not-found states gracefully.

### 5. Zone Creation Fallback
- **Component**: `src/components/ZoneFormModal.tsx` & `src/lib/zones.functions.ts`
- **Fix**: Implement a coordinate-based fallback in the form. If a user cannot draw a boundary, allow entering center coordinates or generating a default circular polygon. Validate GeoJSON structure before submission to prevent database type errors.

## Verification Plan
1. **Automated Check**: Run `bun run build` and `bunx tsgo --noEmit` to ensure type safety.
2. **Runtime Verification**:
   - Create a new gig and verify it appears in the list.
   - Seed demo orders and verify the count report.
   - Navigate to an order detail page.
   - Create a zone with/without map interaction.
