# Plan: Upgrade Logistics Admin Portal to Full Platform

Expand the existing Logistics portal at `/logistics` to include all missing administrative modules, achieving 100% operational parity with the Master Admin portal.

## User Review Required

> [!IMPORTANT]
> The Logistics portal will share the same backend data as the Master Admin but will be filtered by the `logistics` role access. Are there any specific modules from the Master Admin that should *not* be visible to Logistics staff?

## Proposed Changes

### Navigation & Layout
- Update `src/routes/logistics.tsx` to include all missing navigation items matching the Master Admin.
- Group items logically (Operations, Management, Financials, Support, Infrastructure).

### Route Cloning (Admin -> Logistics)
Duplicate the following routes to the `/logistics` namespace, updating route definitions and role checks:
- **Operations**: Dispatch, Gigs, Real-time
- **Management**: Users, Partners, Riders, Customers, Campaigns, Referrals, Ads, Leads, KYC
- **Financials**: Payments, Payouts, COD, Transfers
- **Support**: Support Center, Contact, Help
- **Infrastructure**: Security, Access, Audit, Reports, Performance, Settings

### Data Isolation & Parity
- Ensure all logistics routes use the same robust API logic as admin routes (e.g., `listTable`, `patchRecord`).
- Maintain existing logistics role checks in `RoleGuard` and route loaders.
- Update map components to use Google Maps as already established in the Maps migration turn.

## Technical Details

### Route Structure Expansion
New files to be created (partial list):
- `src/routes/logistics.referrals.tsx`
- `src/routes/logistics.support.tsx`
- `src/routes/logistics.performance.tsx`
- `src/routes/logistics.security.tsx`
- `src/routes/logistics.payments.tsx`
- `src/routes/logistics.reports.tsx`
- `src/routes/logistics.settings.tsx`
- ... (rest of the admin modules)

### Navigation Groups
```text
OPERATIONS
- Dashboard
- Dispatch
- Gigs
- Real-time

MANAGEMENT
- Users
- Partners
- Riders
- Customers
- Campaigns
- Referrals
- Ads
- Leads
- KYC

FINANCIALS
- Payments
- Payouts
- COD
- Transfers

SUPPORT
- Support Center
- Contact
- Help

INFRASTRUCTURE
- Security Console
- Access Mgmt
- Audit Logs
- Business Reports
- Performance & Cost
- Platform Settings
```
