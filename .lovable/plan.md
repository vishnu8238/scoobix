# Logistics Gigs Repair Plan

Implement a comprehensive repair of the Logistics Gigs management interface, enabling editing, deletion, bulk actions, and data import while maintaining authoritative persistence on the `gigs` table.

## User Review Required

> [!IMPORTANT]
> - **Edit Details**: Payout edits for enrolled gigs are allowed only if the new payout is non-negative.
> - **Bulk Actions**: Cancellation of gigs whose start time has already passed is prohibited.
> - **Import**: Validates city/zone IDs and capacity against existing enrollments before committing.

## Proposed Changes

### 1. Gig Editing & Deletion
- **Edit Modal**: Implement `EditGigModal.tsx` prefilled with current gig data.
  - Permitted fields: `title`, `description`, `start_time`, `end_time`, `reward_amount` (payout), `capacity`, `target_deliveries`.
  - Validation: title required, times valid sequence, payout >= 0, deliveries > 0, capacity >= current enrollment.
- **Delete Logic**: 
  - If 0 enrollments: Permanent delete from `gigs` table.
  - If > 0 enrollments: Update status to `CANCELLED` (soft delete for riders).

### 2. Bulk Operations
- **Row Selection**: Add checkboxes to `GigCard` and a "Select All" header in `LogisticsGigs.tsx`.
- **Bulk Cancel**: "Cancel Selected" button appears when rows are selected.
  - Shows aggregate confirmation: "Cancel X gigs? (Y riders will be notified)".
  - Skips gigs that have already started.

### 3. Data Import (Excel/CSV)
- **Import Button**: New "Import Gigs" action next to Export.
- **Workflow**:
  1. Upload file.
  2. Parse CSV/Excel columns (matching Scoobix export format).
  3. **Validation Stage**: Check `city_id` and `zone_id` exist; check `capacity` vs `enrollment` for existing gigs (matched by ID).
  4. **Preview Table**: Show results: [New], [Update], [Invalid].
  5. Commit Upsert.

### 4. Technical Hardening
- **API Extension**: Update `src/lib/gigs-api.ts` to include `deleteGig` and `bulkUpdateStatus`.
- **Metadata Sync**: Ensure `updateGig` correctly patches both root columns and the `metadata` JSONB blob used for UI compatibility.

## Technical Details

- **Table**: `gigs` (Authoritative).
- **Secondary Table**: `rider_gig_enrollments` (Used to block hard deletes and validate capacity).
- **Validation**: Zod-based schemas for form and import validation.
- **Real-time**: Leverages `useTableVersion` for immediate UI refresh after batch operations.
