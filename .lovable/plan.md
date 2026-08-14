# Logistics Portal Expansion Plan

Expand the Logistics Admin Portal with missing reference-feature gaps for Gigs, Operations, Drivers, Rider Profiles, and CMS Stories.

## User Review Required

> [!IMPORTANT]
> - This expansion uses existing InsForge storage and database tables.
> - Data will be loaded from `gigs`, `audit_logs`, `drivers`, `users`, and `restaurant_kyc` tables.
> - No fake business records will be seeded; the UI will handle empty states gracefully.

## Proposed Changes

### 1. Gig Management Expansion (/logistics/gigs)
- Add subview/tabs for **Slots Details** and **Capacity Change**.
- **Slots Details**: Filters for City, Entity Type, Zone, Carrier, Date. Scrollable table with Capacity ID, times, capacity metrics, and earnings.
- **Capacity Change**: View/Create modes with validation and editable percentage inputs per row.

### 2. Live Operations Expansion (/logistics/operations)
- Add **Grooming Selfies** review view with filters and active-count badge.
- Add/Repair **Disputes** view with the reference filter panel (Dispute ID, Priority, Date Range).
- Ensure no indefinite spinners with robust loading/empty states.

### 3. Delivery Partners Expansion (/logistics/drivers)
- Expand to **Delivery Partners** with status summary chips (LOGIN, LOGOUT, OFFLINE, IDLE).
- Add multi-identifier search (FE ID, Driver ID, Phone, License, PAN).
- Add filters: City, Locality, Status, State, Carrier, Service.

### 4. Rider Profile Deep Link (/logistics/drivers/$driverId)
- Add tabs: Details, Assets, Services, Localities, Stores, Reservations, Logs, Documents, Migration.
- **Details**: Display photo and identifiers.
- **Documents**: Show required/optional markers, file links from InsForge storage, and safe download behavior.

### 5. CMS Studio Expansion (/logistics/cms)
- Expand into **Driver Communication Stories**.
- Add working content list/table with Content Type, Status, Uploaded By, and Actions.
- Implement pagination and "View All Brands" functionality.

## Technical Details

- **Routing**: Utilize TanStack Start file-based routing.
- **Data Layer**: Use `listTable`, `createRecord`, and `patchRecord` from `src/lib/insforge-crud.ts`.
- **UI Components**: Reuse `DataTable`, `StatusBadge`, and Lucide icons for consistency with Scoobix branding.
- **Validation**: Implement Zod validation for capacity changes and CMS creation.
- **Persistence**: All uploads backed by existing InsForge storage.

## Verification Plan

### Automated Tests
- Run `bunx tsgo --noEmit` to verify type safety.
- Execute Playwright smoke tests for:
  - `/logistics/gigs` (Tab switching and filter application).
  - `/logistics/operations` (Selfie and Dispute view rendering).
  - `/logistics/drivers` (Search and filter functionality).
  - `/logistics/drivers/$driverId` (Tab navigation and document links).

### Manual Verification
- Verify visibility of new controls in the live preview.
- Confirm empty states are descriptive and not stuck loading.
- Check responsive behavior of new complex tables.
