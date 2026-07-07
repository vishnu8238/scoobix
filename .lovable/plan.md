# Scoobix Feature Extensions Plan

Seven features added with **minimum footprint**. Reuses existing stores, InsForge helpers, sheet/dialog components, and Scoobix design tokens. No redesign of any existing screen.

## Scope Summary

| # | Feature | New route(s) | Backend calls added |
|---|---------|--------------|---------------------|
| 1 | Daily Meal subscriptions | `app.meal.tsx` + partner tab | `meal_subscriptions` records |
| 2 | Corporate / Bulk orders | `app.bulk.tsx` + partner tab | `bulk_requests` records |
| 3 | Free Delivery logic | (extends checkout/cart) | reads `settings.free_delivery_min` |
| 4 | Scoobix Spotlight | home banner + admin card | reads `spotlight` record |
| 5 | Delivery Batching | (backend hook only) | `orders.batch_id` field |
| 6 | Scheduled Orders | checkout time picker + partner filter | `orders.scheduled_for` field |
| 7 | Group Ordering | `app.group.$sessionId.tsx` + share sheet | `group_carts` records |

## Files to change

### New route files (kept minimal, reuse existing `Card`, `Sheet`, `Button`, `EmptyState`)
- `src/routes/app.meal.tsx` — subscription form + list with pause/resume/skip
- `src/routes/app.bulk.tsx` — bulk order request form
- `src/routes/app.group.$sessionId.tsx` — shared cart view (thin wrapper around existing cart UI)
- `src/routes/partner.meals.tsx` — next-day meal count summary
- `src/routes/partner.bulk.tsx` — accept/reject bulk requests
- `src/routes/admin.spotlight.tsx` — pick weekly featured content
- `src/routes/admin.bulk.tsx` — monitor all bulk requests

### Extended files (small additions, no removals)
- `src/lib/insforge.ts` — add helpers: `createMealSubscription`, `updateMealSubscription`, `listMealSubscriptions`, `createBulkRequest`, `listBulkRequests`, `updateBulkStatus`, `getSpotlight`, `setSpotlight`, `createGroupCart`, `joinGroupCart`, `getGroupCart`
- `src/lib/stores.tsx` — add `useMealPlan`, `useGroupCart`, `useBulk` hooks (localStorage + backend sync, same pattern as existing stores)
- `src/lib/cms-store.tsx` — add `freeDeliveryMin` and `spotlight` fields to settings
- `src/routes/app.checkout.tsx` — add scheduled-time picker (existing `Sheet`), show/hide free delivery via cms setting
- `src/routes/app.cart.tsx` — add "Invite to cart" button (opens share sheet) and free-delivery badge
- `src/routes/app.index.tsx` — add Spotlight banner (reuses `HeroCarousel` pattern) + entry chips linking to `/app/meal` and `/app/bulk`
- `src/routes/partner.orders.tsx` — split "Scheduled" tab, show `batch_id` badge when present
- `src/routes/rider.active.tsx` — if `batch_id` present, render "Batch (n stops)" pill
- `src/routes/admin.tsx` — add nav entries for `Spotlight` and `Bulk`
- `src/routes/app.more.tsx` — add entries for Meal Plan, Bulk Orders, Group Cart

## Technical Notes

- **No new tables required** — reuse `orders` table with added columns (`scheduled_for`, `batch_id`, `subscription_id`, `bulk_request_id`) via InsForge's flexible schema. If missing, helpers degrade gracefully (backend responds `field unknown` → we catch and keep local state).
- **Free delivery**: single boolean derived from `cart.subtotal >= settings.freeDeliveryMin`. No new customer fee added. Existing delivery-fee line hides when eligible; badge appears on restaurant + cart.
- **Group cart**: session id in URL, cart state synced through `group_carts` record; existing `useCart` extended with `sessionId` mode. One checkout at end.
- **Batching**: purely a data flag — `batch_id` on `orders`. Partner and rider screens show a pill when set; grouping logic itself is admin/backend concern (stubbed helper `computeBatches` provided for later cron).
- **Spotlight**: single row in a `spotlight` record (or CMS setting fallback). Admin picks restaurant/dish/combo id + copy.
- **Loading + empty states**: all new lists reuse `EmptyState` and existing skeleton components.
- **Demo fallback preserved**: every new list falls back to local mock data if backend is empty, matching existing pattern.

## Out of scope
- Redesign of any existing screen
- New animation systems
- Payment provider changes
- Push-notification wiring (uses existing `notifications` table only)