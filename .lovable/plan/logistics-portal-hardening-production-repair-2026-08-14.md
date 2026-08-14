# Logistics Portal Hardening & Production Repair

Implement critical fixes for Gig Management scrolling, idempotent Order seeding, and Order Detail route navigation.

## User Review Required

> [!IMPORTANT]
> The fixes include making the Gig modal scrollable and hardening the demo order seeding engine. No Supabase code will be added.

## Proposed Changes

### 1. Gig Management Modal (`src/components/admin/CreateGigModal.tsx`)
- Refactor the `DialogContent` to ensure the footer is always reachable.
- Add `overflow-y-auto` to the form container and set a fixed height or max-height for the scrollable area.
- Ensure the "Create Gig" and "Cancel" buttons are either sticky at the bottom or properly flow at the end of the scrollable content.

### 2. Orders Seeding Engine (`src/lib/logistics-ops.functions.ts`)
- Overhaul `seedDemoOrders` to be more robust.
- Ensure it checks for existing restaurants and customers with specific demo tags.
- If missing, create them with all required fields (address, status, etc.).
- Ensure order insertion handles all foreign key constraints and required fields for the InsForge `orders` schema.
- Improve reporting to accurately reflect seeded vs. existing counts.

### 3. Orders Navigation (`src/routes/logistics.orders.tsx`)
- Verify the `<Link>` component usage for `/logistics/orders/$orderId`.
- Ensure `params={{ orderId: o.id }}` is correctly passed.
- If navigation still fails to render the detail page, investigate potential route collisions or rendering logic in `src/routes/logistics.orders.$orderId.tsx`.

### 4. Regression & Verification
- Verify "Add Partner" flow on `/logistics/drivers`.
- Verify "Zone Creation" on `/logistics/zones`.
- Run `bun run build` and `bunx tsgo --noEmit` to ensure no type errors or residual Supabase references.

## Technical Details

- **Modal Fix**: Will use Tailwind's `max-h-[80vh]` and `overflow-y-auto` on the form body within the Dialog.
- **Seeding Fix**: Uses `fetch` with `INSFORGE_URL` and `apikey` headers to interact with the database directly in the server function.
- **Navigation Fix**: Relies on TanStack Router's standard `$orderId` parameter matching.
