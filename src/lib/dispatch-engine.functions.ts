import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";

/** 
 * Backend Order Engine - Server side logic for dispatch and rules.
 * In a real production environment, these would be managed by pg_cron or edge workers,
 * here we expose them as server functions for the Admin override and system simulation.
 */

const HEADERS = {
  apikey: INSFORGE_ANON_KEY,
  Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
  "Content-Type": "application/json",
};

export const findEligibleRiders = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    restaurantId: z.string(),
    zoneId: z.string(),
    subzoneId: z.string().optional(),
    pickupLat: z.number(),
    pickupLng: z.number(),
  }))
  .handler(async ({ data }) => {
    // 1. Fetch zone configuration
    const zoneRes = await fetch(`${INSFORGE_URL}/api/database/records/delivery_zones?id=eq.${data.zoneId}`, { headers: HEADERS });
    const [zone] = await zoneRes.json();
    if (!zone || zone.status !== "ACTIVE") return [];

    // 2. Fetch Subzone status if provided
    if (data.subzoneId) {
      const szRes = await fetch(`${INSFORGE_URL}/api/database/records/delivery_subzones?id=eq.${data.subzoneId}`, { headers: HEADERS });
      const [subzone] = await szRes.json();
      if (!subzone || subzone.status !== "ACTIVE") return [];
    }

    // 3. Fetch ONLINE drivers assigned to this zone/subzone
    // Filter by authorized zone/subzone assignment
    let driverQuery = `online_status=eq.true&zone_id=eq.${data.zoneId}`;
    if (data.subzoneId) {
       // In production, we'd use a join or composite filter. 
       // For now, we assume subzone assignment is part of the driver's metadata or assignment table
    }
    
    const driversRes = await fetch(`${INSFORGE_URL}/api/database/records/drivers?${driverQuery}`, { headers: HEADERS });
    const drivers = await driversRes.json();

    // 4. Calculate distances and filter by zone configuration (pickup_radius_km)
    // Pickup distance logic...
    return drivers; // Placeholder for ranked results
  });

export const processManualAssignment = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    orderId: z.string(),
    riderId: z.string(),
    adminId: z.string(),
    reason: z.string(),
  }))
  .handler(async ({ data }) => {
    // 1. Update Order
    await fetch(`${INSFORGE_URL}/api/database/records/orders?id=eq.${data.orderId}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ 
        driver_id: data.riderId,
        status: "ACCEPTED" // Or specific dispatch status
      })
    });

    // 2. Log to Audit
    await fetch(`${INSFORGE_URL}/api/database/records/delivery_assignment_logs`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        order_id: data.orderId,
        rider_id: data.riderId,
        action: "MANUAL_OVERRIDE",
        reason: data.reason,
        metadata: { admin_id: data.adminId }
      })
    });

    return { success: true };
  });
