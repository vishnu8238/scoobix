## Scope — minimum-footprint extensions

All 13 items landed by extending existing stores/routes. No new tables required; state persists via localStorage with best-effort InsForge sync (existing pattern).

### 1. Restaurant Coupons (extend `app.coupons.tsx`)
- New store slice in `src/lib/scoobix-extras.tsx`: `coupons[]` with `{code, type: flat|percent, value, minOrder, maxDiscount, startAt, endAt, usageLimit, perUser, status: draft|pending|approved|rejected|disabled, restaurantId, usageCount}`.
- New `src/routes/partner.coupons.tsx`: create/edit/toggle/submit for approval, list with status chips. Wire into partner nav.
- Extend `src/routes/admin.cms.tsx` OR new `admin.coupons.tsx` (chosen: **new page** to avoid touching CMS editor) — approve/reject/edit/disable + usage counts.
- `app.coupons.tsx` filters to `status==='approved'` and active date window; existing checkout apply flow unchanged.

### 2. Delivery Charge Rule Engine (extend `cms-store.tsx`)
- Replace flat `deliveryFee` with `deliverySlabs: [{minSubtotal, maxSubtotal?, fee}]` (defaults: `<400→25`, `≥400→50`), plus `restaurantOverrides` and `cityOverrides` maps and `campaigns[]` (free-delivery windows).
- Helper `computeDeliveryFee(subtotal, restaurantId, city)` used by `stores.tsx` cart calc (replaces current flat lookup; keeps `freeDeliveryMin` as legacy fallback).
- Editor UI added to `admin.settings.tsx`.

### 3. Restaurant Delivery Subscription
- Store slice: `subscriptionPlans[]` and `restaurantSubscriptions{}` in `scoobix-extras.tsx`.
- New `src/routes/partner.subscription.tsx`: current plan, renewal date, mock payment history, upgrade/downgrade.
- New `src/routes/admin.plans.tsx`: CRUD plans, assign manually.
- Commission logic untouched.

### 4. Petpooja / POS Integration (architecture-ready)
- Extend `partner.profile.tsx` (or new `partner.integrations.tsx` — chosen: **new page**) with a POS Integrations card: connect/disconnect Petpooja, API key + secret fields, order-sync toggle, menu-sync toggle, status indicator (Not configured / Connected / Error).
- State in `scoobix-extras.tsx`: `posIntegrations{restaurantId: {provider, apiKey, secret, orderSync, menuSync, status}}`. No live API.

### 5–12. Driver End-to-End Flow (extend rider routes + `delivery-store.tsx`)
Existing: online toggle, DriverAssignDialog with countdown, rider.active. Additions:
- **60s timer** driven by admin setting `acceptanceTimerSec` (already exists, default lifted to 60).
- **Slide-to-accept** control component `src/components/cravio/SlideToConfirm.tsx` used across: accept order, reached pickup, order picked up, reached destination, complete delivery.
- Extend `rider.active.tsx` into a **phased flow**: `ASSIGNED → EN_ROUTE_PICKUP → AT_PICKUP → PICKED_UP → EN_ROUTE_DROP → AT_DROP → PAYMENT → COMPLETE`. Each phase renders the required cards (restaurant/customer info, map reuse `LeafletMap`, call/chat/navigate deep links).
- **Order card fields** (accept step): pickup dist, drop dist, earnings, per-km rate, bonus, COD/online, order value — computed from delivery settings.
- **Pickup confirmation**: OTP/order code (already in `orders`), items list, notes.
- **Restaurant feedback sheet** (post-pickup): 6 quick chips + optional note → stored on order in `delivery-store.tsx`.
- **Customer feedback sheet** (post-delivery): 6 quick chips + optional note.
- **Payment step**: COD shows amount; UPI generates QR via existing QR API pattern used in group orders.
- **Complete screen**: earnings breakdown (base + per-km + bonus), distance, time, today's total, "Find New Orders" resumes online search.

### 13. Admin Delivery Settings (extend `admin.settings.tsx`)
Single expanded section: base fee, slabs editor, per-km rate, long-distance multiplier + threshold, waiting charge, peak-hour incentive, rain incentive, COD fee, acceptance timer, auto-reassign toggle, max radius. Coupon-approval and subscription-plan links point to the new admin pages. All values stored in `cms-store.tsx` settings.

### Nav wiring
- Partner nav (`partner.tsx`): + Coupons, Subscription, Integrations.
- Admin nav (`admin.tsx`): + Coupons, Plans.
- Rider nav: unchanged (flow lives inside `rider.active.tsx`).

### Files
**New (8)**: `partner.coupons.tsx`, `partner.subscription.tsx`, `partner.integrations.tsx`, `admin.coupons.tsx`, `admin.plans.tsx`, `components/cravio/SlideToConfirm.tsx`, and helpers inside existing stores.
**Edited (8)**: `scoobix-extras.tsx`, `cms-store.tsx`, `stores.tsx` (cart fee calc), `delivery-store.tsx` (phases + feedback), `rider.active.tsx` (phased UI), `admin.settings.tsx`, `partner.tsx`, `admin.tsx`.

### Out of scope
- No UI redesign, no branding/animation changes, no new DB tables, no live Petpooja API, no changes to existing commission or wallet logic.

Approve to proceed, or tell me which items to drop to save credits (e.g. skip Petpooja stub, or ship driver flow only).