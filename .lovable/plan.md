# Scoobix Read-Only Audit (limited scope, current source)

This audit is scoped to what can be shown from current source with a small budget. No files were changed. Areas not listed were not checked in depth this session, so they count as UNVERIFIED, not healthy.

## CONFIRMED issues

1. P1 — `src/routes/auth.callback.tsx`, `AuthCallback` (line 76)
   - What: the sign-in loading heading shows a leaked instruction prompt ("Do not make any visual modifications... fix the selected issues.") instead of a real title.
   - Impact: every Google sign-in shows this text to users while their session loads.
   - Fix: change the string back to "Signing you in..." (a one-line edit).

2. P1 — `src/lib/insforge.ts`, stub exports (lines 78–84, 93, 120–121)
   - `addonsForDish` always returns `[]`. `setRestaurantApprovalStatus`, `setRestaurantCommission`, `scheduleOrder`, `pingDriverLocation` and `setDriverOnline` do nothing.
   - Impact: dish add-ons never load. Admin restaurant approval and commission changes, scheduled orders, rider online/offline and rider GPS pings look like they succeed but nothing is saved. Live tracking gets no location updates from these paths.
   - Fix: point each one at `patchRecord`/`createRecord` on the real InsForge tables (one function per task).

3. P2 — `src/lib/insforge.ts`, `acceptDeliveryRequest`
   - It writes `delivery_requests.status` directly. That conflicts with the core rule that all delivery transitions go through `delivery-sync.ts` only.
   - Fix: send it through delivery-sync.

4. P2 — `src/lib/insforge.ts`, `upsertMenuItem` / `upsertAddon`
   - They decide between "new" and "existing" with `id.startsWith('n')` / `'a'`. A real record id that starts with those letters gets created as a duplicate instead of updated.
   - Fix: check for a dedicated "is new" flag instead of the id's first letter.

5. P2 — Silent failures that look like empty data
   - Files: `src/lib/fraud-detection.ts` (about 12 calls), `security-api.ts`, `rider-api.ts`, `rider-kyc.ts`, `geo-resolution.ts`, `driver-management-api.ts`.
   - These use `.catch(() => [])`, so a failed InsForge request (for example, permission denied) looks the same as "no data".
   - Impact: Admin security/fraud pages, rider KYC and driver profiles can show "nothing found" while the backend is actually failing.
   - Fix: return an error state the page can show, starting with the security and fraud pages.

6. P2 — `src/lib/insforge.ts`, `getAccessToken`
   - It reads only the in-memory session, with no refresh. After a page reload, until hydration finishes, server calls go out without a token and can fail.
   - Fix: wait for `ensureAuthHydrated()` before reading the token.

7. P3 — `src/lib/insforge.ts`, line 22
   - The client is exposed as `window.insforge`. This doesn't bypass the backend's access rules, but it makes tampering from the browser easier.
   - Fix: remove it, or only expose it in development.

## POSSIBLE / UNVERIFIED (needs a separate check)
- Signed-out visitors get "permission denied for table restaurants/users". This is an InsForge backend access setting, not app code.
- A hydration mismatch warning appears on first load.
- `MapLibreMap.tsx`: the click and polygon handlers are registered once with an empty dependency list, so they can hold stale callbacks. Also, `fitBounds` runs on every change to the markers, which can cause the map to jump around.
- Not tested live as a signed-in user: placing an order, applying a coupon, removing an item with the minus button, rider gig enrollment.

## A. Top 10 by risk
1. Rider online/GPS functions do nothing (#2)
2. Restaurant approval/commission does nothing (#2)
3. Add-ons always empty (#2)
4. Leaked text on the sign-in screen (#1)
5. Delivery accept bypasses delivery-sync (#3)
6. Silent failures on security/fraud data (#5)
7. Token missing right after reload (#6)
8. Menu save creates duplicates (#4)
9. Signed-out access to restaurants (unverified)
10. Map callbacks going stale (unverified)

## B. FIX NOW (cheap)
- #1: one string.
- #7: one line.
- #4: small logic change.

## C. DO NOT TOUCH YET
- Making the #2 stubs real: each needs the table and columns confirmed first.
- Reworking the #5 error handling across many files.
- The auth/portal admission files.
- delivery-sync.

## D. Healthy, leave alone
- Build: the latest build log shows no errors.
- The user_roles mutation guard in `insforge-crud.ts`.
- Lazy loading of the map in `MapView.tsx`.
- Supabase removal.

## E. Fix order
#1 → #7 → #4 → #6 → `setDriverOnline`/`pingDriverLocation` → approval/commission → `addonsForDish` → #3 → #5.

## F. Crash before feature work?
No confirmed crash in the current preview. The functional "nothing happens" stubs (#2) should be fixed before new features.
