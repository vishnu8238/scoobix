# SCOOBIX BRAIN

## SYSTEM OVERVIEW
Scoobix is a multi-portal logistics and delivery platform built on TanStack Start v1. The system is designed for high-concurrency delivery operations including Customer ordering, Partner (Merchant) management, Rider (Delivery) execution, and Logistics/Master Admin oversight.

**Authoritative Backend:** InsForge-only (SDK-driven). All historical Supabase integration is purged.
**Mapping Service:** Centralized Google Maps (Places, Geocoding, Directions).
**Auth Model:** Google OAuth with event-driven InsForge session hydration and `portal_access` table-based authorization.

---

## ARCHITECTURE MAP
- **Framework:** React 19 + TanStack Start (SSR/Function entry).
- **Client SDK:** `@insforge/sdk` (Singleton in `src/lib/insforge.ts`).
- **Authorization:** `src/lib/auth-store.tsx` + `src/lib/portal-authorization.ts`.
- **Data Layer:** `src/lib/insforge-crud.ts` (Generic CRUD with realtime invalidation and manual force-fresh fallback).
- **Realtime:** `src/lib/realtime.ts` (InsForge Socket.IO transport) + `src/lib/realtime-hooks-sync.ts` (Bus invalidation).
- **State Sync:** `src/lib/delivery-sync.ts` (Authoritative order/delivery state machine).
- **Request Cache:** `src/lib/request-cache.ts` (User-scoped via `pub:` or `uid:${uuid}` segments; public fallback).
- **Mapping:** `src/lib/maps-service.ts` (Unified Google Maps wrapper).

---

## AUTHENTICATION & PORTAL ADMISSION
- **InsForge Only:** The app uses InsForge for all auth, data, and storage. Supabase is historical and 0% reachable.
- **Admission Policy:** Strict database-driven admission via `portal_access` table. Admission requires `status = 'active'` and a normalized email match.
- **Portal Keys:** `customer` (Public), `partner`, `rider`, `manager`, `logistics`, `admin` (Master Admin).
- **Ownership Exception:** Designated owner accounts (e.g., `scoobix.info@gmail.com`) are granted full-portal access via `portal_access` rows; no hardcoded bypasses.
- **Hydration Guards:** Auth initialization uses a 10s watchdog and deterministic `insforge.getCurrentUser()` resolution to prevent SSR/hydration hangs.
- **OAuth Callback:** `src/routes/auth.callback.tsx` resolves sessions and preserves `portal_intent` for deterministic routing.

---

## PORTAL & SHELL BOUNDARIES
- **Desktop Portals:** `/admin` and `/logistics` (including all sub-routes) use the full-width desktop shell.
- **Mobile Portals:** Customer (`/app`) and Rider (`/rider`) use the `PhoneShell` layout for mobile-first delivery execution.
- **Master Admin Logistics Control:** A unified command center at `/admin/logistics` providing oversight for fleet, dispatch, supply, and support workflows.

---

## LOGISTICS, GIGS & DRIVERS
- **Gigs Production Rules:** Authoritative table is `gigs`. Metadata fields (`title`, `capacity`) are mapped to the `metadata` JSONB column.
- **Enrollment Identity:** Gigs enrollments (`rider_gig_enrollments`) use `users.id` (authenticated user UUID) as the canonical enrollment key.
- **Driver Profile:** Client-only hydration (`hydrationComplete` + `user` guards) to prevent SSR table-read permission errors.
- **Zones:** `logistics_zones` is the authoritative source for boundary geometry. `drivers.zone_id` does not exist; driver-to-zone assignment is currently unsupported.
- **Google Maps:** All spatial operations use the Google Maps JS API. Geometry is stored as GeoJSON.

---

## REALTIME & CACHE FLOW
- **Canonical Flow:** InsForge Realtime Event → Central Bus → `invalidateTable(table)` → `useTableVersion(table)` → UI Refetch.
- **Manual Refresh:** Operator-facing "Refresh" controls call `invalidateTable` to trigger the canonical reactive flow.
- **Cache Scoping:** `request-cache.ts` scopes all keys by `currentAuthUserId` (or `pub:` for anonymous reads) to prevent cross-user data leakage.
- **No Polling:** The system is event-driven; manual refresh and Socket.IO transport are the primary sync mechanisms.

---

## CURRENT UNSUPPORTED OR EMPTY DOMAINS
The following domains currently render explicit "unavailable" states or empty states due to missing canonical data/schema:
- **Attendance:** No authoritative log exists.
- **COD (Cash on Delivery):** Driver-side collections are not implemented.
- **Driver-Zone Assignments:** `drivers.zone_id` is missing; no active mapping.
- **Live Tracking:** Only `driver_tracking` coordinates are used; history is not implemented.
- **Subzones:** Placeholders only; no operational sub-division logic.
- **Support Tickets / Campaigns / Referrals:** Authoritative tables are empty; UI shows honest empty states.
- **Rider Karma:** `loyalty_accounts` provides basic balances; specific karma events are not implemented.
- **Payout Settlements:** Period/Line-item schema exists, but historical settlements are empty.

---

## ARCHITECTURAL RULES
1. **NO SUPABASE:** Never import `@supabase/*`. All backend operations are InsForge-only.
2. **NO MOCK/SEED:** Hard prohibition on fabricated operational, financial, or compliance data. If the DB is empty, the UI must show an honest empty state.
3. **NO AUTH BYPASS:** Do not use `has_role` or `user_roles` logic; use `portal_access` admission.
4. **CLIENT-ONLY PROTECTED READS:** Guard all sensitive `useQuery` calls with `hydrationComplete` to prevent SSR permission errors.
5. **USER-SCOPED CACHE:** Ensure `setCacheAuthScope(userId)` is called during the login lifecycle.
6. **GOOGLE MAPS ONLY:** Leaflet and other mapping libraries are forbidden.
7. **PRESERVE PORTAL INTENT:** All auth redirects must preserve the intended destination portal.
8. **SINGLETON SDK:** Use only the `insforge` instance from `@/lib/insforge`.

---

## VERIFIED PROJECT STATE
- **Date:** 2026-08-23
- **Backend:** InsForge (Verified: `sptyyknokybhrlxbgtox`)
- **Shells:** /admin and /logistics verified as Desktop; /app and /rider verified as Mobile.
- **Realtime:** Event-driven invalidation verified as canonical.
- **Cleanup:** All Supabase remnants (files, aliases, env keys) verified as deleted.
- **Auth:** `portal_access` verified as sole admission source.
