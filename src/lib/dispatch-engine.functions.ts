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
    subzoneId: z.string().optional().nullable(),
    pickupLat: z.number(),
    pickupLng: z.number(),
  }))
  .handler(async ({ data }) => {
    // 1. Fetch zone configuration
    const zoneRes = await fetch(`${INSFORGE_URL}/api/database/records/delivery_zones?id=eq.${data.zoneId}`, { headers: HEADERS });
    const zones = await zoneRes.json();
    const zone = zones?.[0];
    if (!zone || zone.status !== "ACTIVE") return [];

    // 2. Fetch Subzone status if provided
    if (data.subzoneId) {
      const szRes = await fetch(`${INSFORGE_URL}/api/database/records/delivery_subzones?id=eq.${data.subzoneId}`, { headers: HEADERS });
      const subzones = await szRes.json();
      const subzone = subzones?.[0];
      if (!subzone || subzone.status !== "ACTIVE") return [];
    }

    // 3. Fetch ONLINE eligible drivers
    // Conditions: online, kyc approved, account active, assigned to zone, NO current order
    let driverQuery = `online_status=eq.true&zone_id=eq.${data.zoneId}&kyc_approved=eq.true&account_active=eq.true&current_order_id=is.null`;
    
    const driversRes = await fetch(`${INSFORGE_URL}/api/database/records/drivers?${driverQuery}`, { headers: HEADERS });
    const drivers = await driversRes.json();

    if (!Array.isArray(drivers)) return [];

    // 4. Ranking
    // - Subzone match
    // - Distance
    const pickupLoc = { lat: data.pickupLat, lng: data.pickupLng };
    const radius = zone.pickup_radius_km ?? 1.0;

    const ranked = drivers.map(d => {
      // In a real environment we'd fetch latest tracking, here we assume it's on the driver row for the ranking
      const dLoc = { lat: Number(d.current_lat), lng: Number(d.current_lng) };
      const dist = (d.current_lat && d.current_lng) ? haversineKm(pickupLoc, dLoc) : 999;
      
      let score = dist;
      if (data.subzoneId && d.subzone_id === data.subzoneId) score -= 10;
      
      return { ...d, dist, score };
    }).filter(d => d.dist <= radius);

    ranked.sort((a, b) => a.score - b.score);
    return ranked;
  });

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

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
