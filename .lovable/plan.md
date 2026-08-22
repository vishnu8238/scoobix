# Plan - Logistics Zones Dialog Layout and Manual Boundary Refinement

Relocate the manual boundary editor in the Logistics Zones dialog to ensure it is always accessible, even at smaller screen heights or when Google Maps is unavailable.

## User Review Required

> [!IMPORTANT]
> - The map will now collapse to a small notice if the Google Maps API key is missing or the component fails to load, prioritizing the manual entry form.
> - "Create Zone" will remain disabled until at least 3 valid points are added.

## Proposed Changes

### Logistics Portal

#### [src/components/ZoneFormModal.tsx]
- Refactor the `ZoneFormModal` layout:
  - Move the manual boundary list and input to a dedicated section that remains above the fold.
  - Implement a responsive two-column or stacked layout where the Manual Boundary editor is prominent.
  - Wrap the map in a conditional container that collapses when not available.
  - Ensure the "Add Point" and "Points List" are clearly visible and interactive.
  - Add a validation message to the "Create Zone" button when fewer than 3 points exist.
  - Explicitly use only the `boundary` GeoJSON field for persistence.

#### [src/components/maps/GoogleMap.tsx]
- Update the `GoogleMap` component's fallback state:
  - Ensure the fallback UI is compact and non-blocking.
  - Remove redundant coordinate inputs from the map fallback to avoid duplication with the main form's manual editor.

### Regression Tests
- Verify that adding 3 points manually enables the "Create Zone" button.
- Confirm that existing map drawing logic (stable refs, no fitBounds on edit) is preserved.
- Verify the GeoJSON structure is correct (`Polygon` with closed ring).

## Technical Details
- **UI Architecture**: Using Tailwind's flexbox and overflow-y-auto to manage long forms.
- **Validation**: `points.length >= 3` logic in `ZoneFormModal`.
- **Schema Persistence**: Ensuring `polygon_coords` is never referenced.
