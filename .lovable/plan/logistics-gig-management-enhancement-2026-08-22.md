# Logistics Gig Management Enhancement

Implement date filtering and multi-slot gig creation for the Logistics portal, using InsForge as the authoritative backend.

## User Review Required

> [!IMPORTANT]
> The enhancement will allow creating multiple gigs in a single submission by specifying multiple time slots. Each slot will result in a separate record in the `gigs` table.

- **Date Filtering**: Add "All Gigs" and "Last 2 Months" filters to the Fleet Gigs list.
- **Multi-slot Creation**: Update the Create Gig modal to support repeatable time slots.
- **TypeScript Safety**: Ensure all new logic is fully typed and build-safe.

## Proposed Changes

### Logistics Portal

#### [src/routes/logistics.gigs.tsx]
- Add `dateFilterMode` state: `"selected"` (day calendar), `"all"`, or `"last2months"`.
- Implement a new filter UI above the list with buttons for "All Gigs" and "Last 2 Months".
- Add a "Clear date / Show all" action that resets the filter to "All Gigs".
- Update the `load` function and `useMemo` for filtering to respect the new modes.
- Ensure `GigStats` and Excel export use the filtered dataset.

#### [src/components/admin/CreateGigModal.tsx]
- Replace `start_time` and `end_time` in `formData` with a `slots` array: `[{ id: uuid, start: '09:00', end: '18:00' }]`.
- Implement "Add another time slot" and "Remove" actions.
- Update `handleSubmit` to iterate over `slots`, creating one InsForge record per slot.
- Add validation to ensure slots are complete, end > start, and non-overlapping/unique.
- Update the submit button text to reflect the count (e.g., "Create 3 Gigs").
- Handle partial failures by showing a clear summary and refreshing on any success.

### Backend & API

#### [src/lib/gigs-api.ts]
- No schema changes required as metadata already supports additional fields.
- Multi-slot creation will use existing `createGig` in a loop (or batch if possible via `createRecord` array support).

## Technical Details

- **Date Logic**: Use `date-fns` for rolling "Last 2 Months" calculation (e.g., `subMonths(new Date(), 2)`).
- **Filtering**: Local filtering in the component after fetching a larger set (up to 1000 rows as currently done) to maintain responsiveness.
- **Atomic Operations**: Since `createRecord` is the primary interface, we will perform sequential creations and handle errors gracefully, ensuring the UI stays in sync.

## Verification Plan

### Automated Tests
- `bunx tsgo` to verify zero TypeScript errors.

### Manual Verification
1. Open Logistics Gigs.
2. Select "All Gigs" and verify the list shows more than the current day.
3. Select "Last 2 Months" and verify dates are within range.
4. Open "Create New Gig".
5. Add two time slots (e.g., 09:00-11:00 and 12:00-14:00).
6. Verify "Create 2 Gigs" button appears.
7. Submit and verify two separate cards appear in the list.
