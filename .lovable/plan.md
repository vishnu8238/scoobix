# Logistics Gigs Repair Plan

Implement authoritative Gig management actions, bulk operations, and Excel import for the Logistics portal while maintaining current data integrity and mobile visibility.

## User Review Required

> [!IMPORTANT]
> The "Import Gigs" feature will support the current Excel-exported format (.xls HTML table) and CSV. It will update existing gigs if a matching ID is found.

- Should we allow updating the Payout of a Gig that already has active enrollments? (Current plan allows it if >= 0).
- For bulk actions, should we allow cancelling gigs that have already started?

## Proposed Changes

### 1. Gig Management Hardening
- **Edit Details**: Wire `GigCard`'s `onEdit` to a new `EditGigModal`.
- **Delete/Cancel**: Implement single and bulk delete (zero enrollments) or status update to `CANCELLED` (with enrollments).
- **Validation**: Enforce non-empty title, valid time ranges, non-negative payout, and capacity >= enrollment count.

### 2. Bulk Operations
- **Selection**: Add row checkboxes and a "Select all" indeterminate checkbox.
- **Actions**: Add a "Cancel Selected" button with aggregate confirmation.

### 3. Gig Import
- **Parser**: Implement an Excel/CSV parser that recognizes Gig ID, Date, Times, City, Zone, Payout, Capacity, and Status.
- **Workflow**: Validation preview -> Confirmation -> Batch Upsert.
- **Safeguards**: Validate city/zone existence, prevent capacity being set lower than current enrollments, and handle row-level errors gracefully.

### 4. Technical Details
- **Tables**: Primary operations on `gigs` table; status updates to sync with `rider_gig_enrollments` visibility.
- **API**: Extend `src/lib/gigs-api.ts` with `deleteGig`, `bulkUpdateGigs`, and `importGigs` logic.
- **UI**: Update `src/routes/logistics.gigs.tsx` with selection state and new action buttons.

## Verification Plan

### Automated Tests
- `tsgo` for type checking across all modified files.
- Verify `createRecord` and `patchRecord` calls match the authoritative `gigs` schema.

### Manual Verification
- Create a gig -> Edit it -> Verify changes persist.
- Delete a gig with 0 enrollments -> Verify it's gone.
- Cancel a gig with >0 enrollments -> Verify status is `CANCELLED` and it's hidden from Riders.
- Import a CSV with one new gig and one update -> Verify results.
