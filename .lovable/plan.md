# Centralized Zones & Map Management Migration

Consolidate Zone management across Master Admin and Logistics portals into a unified high-fidelity map-centric interface as per user reference.

## User-Facing Changes
- **Map-Centric Interface**: Large interactive Google Map with a floating zone directory/sidebar.
- **Unified Portal Experience**: Identical high-fidelity zone management at both `/admin/zones` and `/logistics/zones`.
- **Advanced Directory**: Floating list showing point counts, city labels, and direct View/Edit actions.
- **Improved Workflow**: "Hide List" toggle and quick "Create" button integrated into the map header.

## Technical Details
- **Shared Components**:
  - Create `src/components/admin/ZoneManager.tsx`: A reusable, full-screen map-centric layout for zone management.
  - Create `src/components/admin/ZoneDirectoryItem.tsx`: High-fidelity card for the zones sidebar.
- **State Management**: Consolidate zone and subzone fetching into the shared manager component.
- **Routing**: Update `src/routes/admin.zones.tsx` and `src/routes/logistics.zones.tsx` to serve the new `ZoneManager` component.
- **Map Enhancements**: Ensure `GoogleMap` polygons support the "View" (fitBounds) and "Edit" (open modal/editor) flow correctly.

## Verification Plan
- **UI Parity Check**: Verify the layout matches the uploaded screenshot (sidebar, header, map overlays).
- **Navigation Test**: Ensure "View" pans/zooms to the zone and "Edit" opens the existing modal.
- **Cross-Portal Verification**: Confirm the new UI is live at both `/admin/zones` and `/logistics/zones`.
