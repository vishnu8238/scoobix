# Driver Payout Workspace Reconciliation

Implement a tightly scoped reconciliation of the Driver Payout Workspace using the authoritative InsForge project `9d873abd-530b-47a7-8a36-b38cc54dbdf5`.

## User-facing changes
- **Authoritative Ledger:** Payout data now derives exclusively from `public.driver_payout_periods`, `public.driver_payout_line_items`, and `public.driver_payout_settlements`.
- **Truthful Empty States:** Payout history and logistics dashboards show a clear "No eligible earnings" message instead of mocked amounts when no delivered orders exist.
- **Improved Lifecycle:** Payouts follow a strict status flow: `DRAFT`, `READY_FOR_REVIEW`, `APPROVED`, `SETTLED`, `VOID`.
- **Manual Adjustments:** Logistics managers must provide a reason for any manual debit adjustments.
- **Logistics Integration:** Driver profile payout tabs now pull from the authoritative ledger tables.

## Technical details
- **Identity Resolution:** Align all payout queries to use `drivers.id` as the primary identifier (referencing `orders.driver_id`). Rider ownership is verified via `rider_profiles.driver_id = payout_periods.driver_id` where `rider_profiles.user_id = auth.uid()`.
- **Earnings Logic:** `calculateDraftPayout` in `src/lib/payouts-api.ts` derives credits only from `orders` where `status = 'DELIVERED'` and `driver_earnings` is a valid numeric value. `delivery_fee` is ignored as source for driver earnings.
- **Schema Alignment:** Align code with live table columns:
    - `payout_periods`: `id`, `driver_id`, `period_start`, `period_end`, `gross_earnings`, `total_credits`, `total_deductions`, `net_payable`, `status`.
    - `payout_line_items`: `id`, `payout_period_id`, `direction`, `amount`, `business_date`, `category`, `description`, `source_table`, `source_id`, `is_manual`, `reason`.
    - `payout_settlements`: `id`, `payout_period_id`, `amount`, `method`, `reference`, `status`.
- **No Automatic Record Creation:** Payout periods and line items are only created through explicit authorized operations, never on page view.
- **Settlement Hardening:** Settlements are record-only (method/reference/status) and do not trigger financial transfers.

## Affected Files
- `src/lib/payouts-api.ts`: Core logic reconciliation.
- `src/routes/logistics.payouts.tsx`: Dashboard alignment.
- `src/routes/logistics.drivers.$driverId.tsx`: Profile ledger integration.
- `src/lib/driver-management-api.ts`: Clean up legacy payout fetches.
- `src/routes/rider.earnings.tsx`: Align rider view to authoritative source.
- `src/lib/rider-api.ts`: Update `fetchRiderEarnings`.
