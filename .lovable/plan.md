# Plan: Logistics Batch Repair (Orders Seed & Zones)

Repairing two production blockers in the Logistics portal: Orders seed authentication and Zone creation payload mismatch.

## User Review Required

> [!IMPORTANT]
> This fix restores authoritative InsForge session propagation for server functions and hardens Zone creation validation.

- **Orders Seed Fix**: Restores authentication for `seedDemoOrders` by extracting the Bearer token from the request context and injecting it into the InsForge client.
- **Zones Payload Fix**: Corrects the `createNewZone` server function to handle the incoming `data` wrapper correctly, preventing `undefined` payload errors.
- **Map-Independent Fallback**: Ensures zones can be created with a deterministic fallback boundary if map interaction is skipped or the Google Maps API is unavailable.

## Proposed Changes

### Logistics Orders & Auth
- **src/lib/logistics-ops.functions.ts**: Update `seedDemoOrders` to use the authenticated `insforge` instance from middleware context.
- **src/integrations/insforge/auth-middleware.ts**: Ensure the middleware correctly hydrates the `insforge` SDK client with the caller's session.

### Logistics Zones
- **src/lib/zones.functions.ts**: Refactor `createNewZone` and `createNewSubzone` to correctly destructure the `data` input and handle Zod validation objects.
- **src/components/ZoneFormModal.tsx**: Ensure the form always sends a valid, non-null boundary object.

## Technical Details

### Orders Auth Propagation
The server function currently fails with `Unauthorized` because the internal `insforge` client lacks the token. We will ensure the `requireInsForgeAuth` middleware (which already extracts the token) provides a fully authenticated client in the `context`.

### Zone Payload Logic
The Zod input validator in `zones.functions.ts` expects an object, but if the component sends `{ data: submission }`, and the handler expects `({ data }) => ...`, it might be double-wrapping or mismatched. I will normalize this to use the validated `data` directly.

### Boundary Verification
Adding a schema-agnostic boundary check to ensure `boundary` is never `undefined` when hitting the InsForge API, providing a default 500m square around the city center if missing.
