# Plan: Logistics Zones Manual Boundary Repair

Implement a keyboard-accessible manual boundary entry system for Logistics Zones to ensure usability when the map overlay is obstructive. Additionally, harden the Google Map implementation to prevent unwanted re-centering during vertex editing.

## Technical Details

### 1. Manual Boundary Entry (ZoneFormModal)
- Add a new "Manual boundary" section in `src/components/ZoneFormModal.tsx`.
- Permanently visible in the modal body.
- Inputs for Latitude and Longitude (defaulted to Vadodara 22.3072 / 73.1812).
- "Add point" button to append to the boundary.
- List of current points with "Remove" controls.
- Status indicator for the "3 points minimum" requirement.
- Update GeoJSON serialization to ensure a closed ring `[lng, lat]` for persistence.

### 2. Map Viewport Stability (GoogleMap)
- Ensure the `Polygon` component in `src/components/maps/GoogleMap.tsx` continues to use stable refs to avoid remounts.
- Modify `GoogleMapInner` to prevent `fitBounds` calls during active vertex editing (`set_at`, `insert_at`, `remove_at`).
- Only allow `fitBounds` on initial data load or explicit recenter actions.

### 3. Validation & Persistence
- Verify at least 3 distinct points are provided.
- Persist data to the `boundary` column (GeoJSON Polygon).
- Maintain computed `center_lat`, `center_lng`, `latitude`, and `longitude`.

### 4. Regression Testing
- Add a temporary regression test script to verify manual boundary closure logic.

## Files to Modify
- `src/components/ZoneFormModal.tsx`
- `src/components/maps/GoogleMap.tsx`
