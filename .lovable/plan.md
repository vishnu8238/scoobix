# Plan - Rider Phase-Aware Google Maps Navigation

Implement turn-by-turn navigation in the Rider portal and coordinate persistence in Customer checkout.

## User Review Required

> [!IMPORTANT]
> - Ensure your device allows location permissions for the Customer and Rider apps to take full advantage of coordinate-based navigation.
> - "Navigate" buttons will open your device's native mapping application (Google Maps on Android, Apple Maps/Google Maps on iOS).

## Proposed Changes

### Logistics & Rider
#### [Rider Portal]
- **Order Details UI**: Add a prominent "Navigate" button to the active delivery task (`src/routes/rider.active.tsx`).
- **Phase-Aware Logic**:
  - `HEADING_TO_RESTAURANT` / `ACCEPTED` -> "Navigate to Restaurant" (using restaurant coordinates or address).
  - `OUT_FOR_DELIVERY` / `PICKED_UP` -> "Navigate to Customer" (using order coordinates or address).
- **Navigation Utilities**: Update `src/lib/navigation.ts` to ensure consistent Google Maps URL generation as requested.

#### [Backend Integration]
- **Persistence**: Update `src/lib/orders-api.ts` to include `delivery_latitude` and `delivery_longitude` in the `PlaceOrderInput` and database insert payload.
- **Authoritative Data**: Ensure `pickup_latitude` and `pickup_longitude` are reliably fetched from the `restaurants` table during order creation.

### Customer
#### [Checkout Flow]
- **Geolocation Persistence**: Modify `src/routes/app.checkout.tsx` to attempt to capture device coordinates during the checkout process and save them to the `orders` table.
- **Graceful Fallback**: If location is denied, the flow continues using only the textual address.

## Technical Details

- **Database Fields**: `orders.delivery_latitude`, `orders.delivery_longitude` (Double Precision).
- **Google Maps URLs**: 
  - Coordinates: `https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>&travelmode=driving`
  - Address fallback: `https://www.google.com/maps/dir/?api=1&destination=<encoded_address>&travelmode=driving`
- **Component Updates**:
  - `src/routes/rider.active.tsx`: Add navigation buttons and conditional labels.
  - `src/routes/app.checkout.tsx`: Add `useEffect` to poll `navigator.geolocation` and store coordinates in component state for `placeOrder` payload.
  - `src/lib/orders-api.ts`: Extend `PlaceOrderInput` and `createOrder` body.
