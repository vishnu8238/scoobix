# SCOOBIX BRAIN

## SYSTEM OVERVIEW
Scoobix is a multi-portal logistics and delivery platform built on TanStack Start v1. The system is designed for high-concurrency delivery operations including Customer ordering, Partner (Merchant) management, Rider (Delivery) execution, and Logistics/Master Admin oversight.

**Authoritative Backend:** InsForge (SDK-driven).
**Mapping Service:** Centralized Google Maps (Places, Geocoding, Directions).
**Auth Model:** Google OAuth with `portal_access` table-based authorization.

---

## ARCHITECTURE MAP
- **Framework:** React 19 + TanStack Start (SSR/Function entry).
- **Client SDK:** `@insforge/sdk` (Singleton in `src/lib/insforge.ts`).
- **Authorization:** `src/lib/auth-store.tsx` + `src/lib/portal-authorization.ts`.
- **Data Layer:** `src/lib/insforge-crud.ts` (Generic CRUD with adaptive polling/realtime bus integration).
- **Realtime:** `src/lib/realtime-bus.ts` (WebSocket-driven with adaptive-polling fallback).
- **State Sync:** `src/lib/delivery-sync.ts` (Authoritative order/delivery state machine).
- **Mapping:** `src/lib/maps-service.ts` (Unified Google Maps wrapper).

---

## AUTHENTICATION & SECURITY

### Auth Lifecycle
1. **OAuth Initialization:** `loginWithGoogle` in `src/lib/insforge-auth.ts` persists `portal_intent` in `localStorage`.
2. **Callback:** `src/routes/auth.callback.tsx` handles code exchange, populates InsForge session, and verifies `portal_access`.
3. **Session Hydration:** `src/lib/auth-store.tsx` resolving user + roles with a 10s watchdog.
4. **Guards:** `RoleGuard.tsx` and `AdminGuard.tsx` enforce portal-specific admission.

### Known Auth Risks
- **Identity Resolution Fallbacks:** `src/lib/identity-utils.ts` recursively probes metadata/identities. Risk: Fallback to "User" if profile/metadata are empty.
- **Refresh Token Race (iOS):** iOS Safari/Chrome session hydration sometimes fails. Fix: `window.location.replace` and storage clearing on refresh errors (documented in `auth-store.tsx`).
- **Portal Intent Mismatch:** If a user logs in via one portal but `portal_access` only grants another, they are redirected with `?denied`.

---

## PORTAL MATRIX

| Portal | Entry Route | Purpose | Auth/Role | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | `/app` | Order food, track deliveries. | `customer` | `IMPLEMENTED` |
| **Partner** | `/partner` | Merchant menu & order mgmt. | `partner` | `IMPLEMENTED` |
| **Manager** | `/manager` | Restaurant ownership/onboarding. | `manager` | `PARTIAL` |
| **Rider** | `/rider` | Delivery execution (Mobile-Only). | `rider` | `IMPLEMENTED` |
| **Logistics** | `/logistics` | Fleet & Zone operations. | `logistics` | `IMPLEMENTED` |
| **Admin** | `/admin` | System-wide config & security. | `admin` | `IMPLEMENTED` |

---

## CORE MODULES

### Logistics & Zones
- **Tables:** `logistics_zones` (Polygon/City), `subzones` (Manager-linked).
- **Logic:** `src/lib/zones-api.ts` handles geometry and manager assignments.
- **Maps:** Uses `src/components/maps/GoogleMap.tsx`. Leaflet is strictly purged from source.

### Gigs & Enrollments
- **Authoritative Table:** `gigs` (Hardcoded in `src/lib/gigs-api.ts`).
- **Enrollments:** Managed via `rider_gig_enrollments`.
- **Field Mapping:** `title`, `capacity`, `target_deliveries` are stored in a `metadata` JSONB column for schema compatibility.

### Delivery State Machine
- **Table:** `orders`.
- **Statuses:** `PLACED` → `ACCEPTED` → `PREPARING` → `READY` → `AT_PICKUP` → `PICKED_UP` → `ON_THE_WAY` → `DELIVERED`.
- **Sync:** `src/lib/delivery-sync.ts` triggers `order_audit_logs` and broadcasts to `realtime-bus`.

---

## TECHNICAL DEBT & MOCKS
- **Petpooja Sync:** Stubs exist in `src/routes/logistics.settings.tsx` and `cms-store.tsx`.
- **Mock Data:** `src/lib/mock-data.ts` and `mock-extras.ts` are used for initial portal seeds where backend data is sparse.
- **Rider KYC:** `rider_profiles` vs `drivers` table duality. `drivers` is often used as a read-only lookup for legacy logic.

---

## CRITICAL FILE INDEX
- `src/lib/insforge.ts`: Client singleton and token resolution.
- `src/lib/insforge-auth.ts`: OAuth flow and intent preservation.
- `src/lib/insforge-crud.ts`: Authoritative DB access and adaptive cache.
- `src/lib/auth-store.tsx`: Global auth context and role resolution.
- `src/lib/portal-authorization.ts`: Permission checks against `portal_access`.
- `src/lib/request-cache.ts`: De-duplication and TTL management.
- `src/lib/realtime-bus.ts`: WebSocket event distribution.
- `src/routes/auth.callback.tsx`: OAuth completion and portal routing.
- `src/components/cravio/RoleGuard.tsx`: Portal-level admission enforcement.

---

# RULES FOR FUTURE AI AGENTS
1. **READ BRAIN.MD FIRST:** Always consult this file before proposing changes.
2. **INSPECT SOURCE:** Trace actual imports; do not assume based on filenames.
3. **NO SUPABASE:** Supabase is historical. Never import `@supabase/supabase-js`.
4. **INSFORGE ONLY:** All backend operations must use the InsForge SDK or `insforge-crud.ts`.
5. **SINGLETON CLIENT:** Reuse `insforge` from `src/lib/insforge.ts`.
6. **AUTHORITATIVE GIGS:** Use `gigs` table only; never `delivery_gigs`.
7. **METADATA MAPPING:** Map gig fields to `metadata` JSONB as required by `gigs-api.ts`.
8. **GOOGLE MAPS ONLY:** Leaflet/Nominatim/OSRM are forbidden.
9. **RIDER MOBILE-FIRST:** The Rider portal (`/rider`) is mobile-only; maintain the PhoneShell layout.
10. **ADMIN DESKTOP:** Admin/Logistics portals are desktop-optimized.
11. **NO SECRETS:** Never echo or store API keys/tokens in code or logs.
12. **AUTH BEFORE CHANGE:** Trace `RoleGuard` and `auth-store` before touching routing.
13. **PORTAL INTENT:** Preserve `portal` search param during auth flows.
14. **REALTIME OVER POLLING:** Prefer `onTableChange` for UI updates.
15. **SHARED APIS:** Reuse `src/lib/*-api.ts` instead of writing inline fetch calls.
16. **NO MOCK FALLBACKS:** Never replace a broken backend call with `localStorage` mocks.
17. **STRICT REDIRECTS:** Use `window.location.replace` for auth callbacks to avoid loops.
18. **WATCHDOG AWARE:** Respect the 10s auth watchdog in `auth-store.tsx`.
19. **IDENTITY PRIORITY:** Use `getDisplayName` from `src/lib/identity-utils.ts`.
20. **PRESERVE DESIGN:** Maintain Apple-minimal dark theme and custom components.
21. **CHECK DEBT:** Consult `TECHNICAL DEBT` section before "fixing" stubs.
22. **SYNC AUDIT:** Every status change must log to `order_audit_logs`.
23. **CACHE SCOPING:** Ensure `setCacheAuthScope` is called on user change.
24. **NO TABLE DUPLICATION:** Confirm table existence via `information_schema` before creating.
25. **VERIFY BEFORE CLAIM:** Never report "Fixed" without actual preview/build verification.
26. **RIDER ONBOARDING:** Use `rider_profiles` for KYC data.
27. **MANAGER ONBOARDING:** Maintain idempotent restaurant creation logic.
28. **PWA INTEGRITY:** Keep `sw.js` and manifests updated for all portals.
29. **LOGISTICS ZONES:** Always use `polygon_coords` for zone boundaries.
30. **MAINTENANCE RULE:** Record significant architecture changes in BRAIN.md with date and impact.

---

# VERIFIED PROJECT STATE
- **Date:** 2026-08-18
- **Backend:** InsForge (Verified: `sptyyknokybhrlxbgtox`)
- **Auth:** Google OAuth (Verified: `insforge-auth.ts`, `auth.callback.tsx`)
- **Maps:** Google Maps JS API (Verified: `maps-service.ts`)
- **Gigs:** `gigs` table authoritative with metadata mapping.
- **Zones:** `logistics_zones` with polygon geometry.
- **Portals:** Customer, Partner, Manager, Rider, Logistics, Admin all have verified routes.
- **Known Issue:** Rider KYC uses `rider_profiles` while legacy code still probes `drivers`.
- **Known Issue:** Partner portal uses legacy `restaurants` table schema; `owner_id` is primary link.
