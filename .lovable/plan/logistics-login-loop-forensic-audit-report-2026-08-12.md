# Logistics Login Loop — Forensic Audit Report

## Verdict

This is an **authentication failure, not an authorization failure**. There is no InsForge session in the browser at all after the Google return, on every portal. Logistics is simply the only portal that hard-blocks without a session, so it is the one that visibly loops.

Root cause: `src/lib/insforge.ts` was replaced with a 24–42 line stub file during an earlier build-error fix. The real 527-line backend module (git `5dc7b80`, Aug 10 09:43) was truncated at commit `0ce0d5b` (Aug 11 07:27). No amount of guard/callback/role logic can work while this file is a stub.

## Runtime evidence (captured this turn, live app)

Loading `/logistics/login` in a real browser produces:

```text
REQ POST http://localhost:7130/api/auth/refresh   (x15, net::ERR_CONNECTION_REFUSED)
REQ GET  /api/database/records/app_settings?limit=1   → 404
REQ GET  /api/database/records/restaurants?limit=200  → 404
[AUTH_DEBUG] AUTH_STORE_SESSION_RESTORED  Session ID: undefined
```

Two independent breakages, both from the stub file:

1. `createClient(INSFORGE_PROJECT_ID || INSFORGE_URL)` passes a **string**, but the SDK signature is `createClient(config?: InsForgeConfig)`. `config.baseUrl` is therefore `undefined` and the SDK falls back to its default `http://localhost:7130` (`node_modules/@insforge/sdk/dist/index.mjs:429`). Every auth call — including the OAuth code exchange and `auth/refresh` — is sent to a host that does not exist in the browser. This is the source of the earlier "No refresh token provided" noise.
2. `INSFORGE_URL` / `INSFORGE_ANON_KEY` read `VITE_INSFORGE_URL` / `VITE_INSFORGE_ANON_KEY`, which are not defined in this project, so they are `""`. Every `listTable` call in `src/lib/insforge-crud.ts` hits the app's own origin (`/api/database/records/...`) and returns 404. The restored file hardcodes the real values (`https://awvs3seh.us-east.insforge.app` + anon key).

The stub also no-ops real business functions (`updateOrderStatus`, `upsertMenuItem`, `subscribeCatalog`, `addonsForDish`, `bootstrapInsForge`, `acceptDeliveryRequest`, `pingDriverLocation`, and ~30 more), so orders/menu/dispatch writes are silently dropped platform-wide.

## Exact redirect chain

```text
/logistics/login
  -> login('google','logistics')      intent stored (works)
  -> Google consent                    (works)
  -> /auth/callback
       insforge.auth.getCurrentUser()  -> POST localhost:7130 -> CONNECTION REFUSED
       polls 30x / 15s, user stays null
       -> "Login timed out" OR (on a stale in-memory token) continues
  -> /logistics  (full page load, window.location.assign)
       AuthProvider.resolveUser -> getSession() -> null
       RoleGuard: !user -> navigate("/logistics/login")
```

First failing operation: the SDK's OAuth/session call to `http://localhost:7130`.
Exact redirect that closes the loop: `src/components/cravio/RoleGuard.tsx` line 42 (`navigate({ to: loginPath })`) in the `if (!user)` branch — correct behaviour given a null session; it is a symptom, not the bug.

## Auth client instances

One client only, and it is a proper singleton (`globalThis.__INSFORGE_CLIENT__` in `src/lib/insforge.ts`). Logistics uses the same client and the same config as every other portal. Multiple-client theories are ruled out.

## Session lifecycle

The SDK's `TokenManager` is documented **memory-only** ("Memory-only token storage"), so any full page load (`window.location.assign` in `auth.callback.tsx` and `RoleGuard`) drops the access token and depends on `POST /api/auth/refresh` against the correct backend to rehydrate. With `baseUrl` broken, rehydration can never succeed — which is exactly the earlier "session lost on hard refresh" symptom, and why every previous guard-level fix failed.

## logistics_staff lookup / schema findings

The query shape is fine (`email=eq.<addr>` against `logistics_staff` via PostgREST), but it currently cannot return anything: the request URL has no host and 404s, and the thrown error is swallowed — in `auth.callback.tsx` (empty `catch`) and in `auth-store.tsx` (falls into the outer `catch`, producing `roles:["customer"], membershipsResolved:false`). So a real-world unauthorized message and a total backend outage look identical today. Two secondary risks to confirm once the backend is reachable:

- Case sensitivity: `eq.` is exact, so a staff row stored with different casing than the Google email will not match.
- `src/lib/permissions.ts:172` looks up the same table by `user_id`, while admission uses `email`; rows seeded with only one of the two columns will pass one check and fail the other.
- `listTable(..., { ttl: 0 })` does **not** mean "fresh": `fresh()` in `src/lib/request-cache.ts` treats `ttl <= 0` as *never expires*, so the first result for a query is frozen for the page session. The intended semantics are `{ fresh: true }`.

## Smallest safe fix plan

1. Restore `src/lib/insforge.ts` from git `5dc7b80` (the last complete version): real `baseUrl`/`anonKey` passed as a config **object**, real `getAccessToken`, and all data/catalog/order/driver functions. Keep the `globalThis` singleton wrapper on top of the restored `createClient({ baseUrl, anonKey })`.
2. Reconcile the handful of call-site signatures that were changed while the stub was in place (e.g. `addonsForDish` awaited as a promise in `CustomizationSheet.tsx`, `deleteRestaurantComplete`, `upsertMenuItem`) so the restore does not reintroduce build errors. No behaviour changes beyond matching the restored real signatures.
3. Replace the misleading `{ ttl: 0 }` on the three `logistics_staff` admission reads with `{ fresh: true }` so admission is always an authoritative read.
4. Make admission failures distinguishable from outages: on a thrown/HTTP error in the logistics email check, do **not** treat it as "unauthorized" — surface a retryable backend-error state instead of bouncing to login. No security relaxation: an empty result still means no access.
5. Remove the temporary forensic diagnostic panel in `src/routes/logistics.tsx` once verified.
6. Verify with browser evidence before any PASS claim: network shows auth calls going to `https://awvs3seh.us-east.insforge.app`, `getCurrentUser` returns a user id, `/logistics` renders for an authorized staff email, hard refresh keeps the session, and an unauthorized email stays on the login page with the restricted message.

No test bypasses, no weakened guards, no schema changes are part of this plan.
