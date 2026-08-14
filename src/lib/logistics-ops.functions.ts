import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { publishTableChange } from "./realtime-bus";
import { newUuid } from "./orders-api";

const HEADERS = {
  apikey: INSFORGE_ANON_KEY,
  Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
  "Content-Type": "application/json",
};

/**
 * Idempotently seeds City 1, City 2 and Zone 1 prerequisites for Gig creation.
 * Uses hardcoded authoritative UUIDs to ensure selector stability.
 */
export const seedLogisticsPrerequisites = createServerFn({ method: "POST" })
  .handler(async () => {
    console.log("[SEED_PREREQ] Starting authoritative idempotent city/zone seeding...");
    
    // c1110000-0000-0000-0000-000000000001
    const city1Id = "c1110000-0000-0000-0000-000000000001";
    const zone1Id = "z1110000-0000-0000-0000-000000000001";
    
    const tables = ["logistics_zones", "delivery_zones"];
    let result = { cities: 0, zones: 0, errors: [] as string[] };

    const zonePayload = {
      id: zone1Id,
      name: "Zone 1",
      city: "City 1",
      city_id: city1Id,
      status: "ACTIVE",
      boundary: { type: "Polygon", coordinates: [[[73.1, 22.3], [73.2, 22.3], [73.2, 22.4], [73.1, 22.4], [73.1, 22.3]]] },
      center_lat: 22.3072,
      center_lng: 73.1812,
      pickup_radius_km: 5,
      max_delivery_distance_km: 10,
      max_orders_per_rider: 3,
      assignment_timeout_sec: 30,
      metadata: { is_demo: true, demo_tag: "logistics_test_v2" }
    };

    for (const table of tables) {
      try {
        console.log(`[SEED_PREREQ] Probing ${table}...`);
        const check = await fetch(`${INSFORGE_URL}/api/database/records/${table}?id=eq.${zone1Id}`, { headers: HEADERS });
        
        if (!check.ok) {
          const errStatus = check.status;
          const errText = await check.text();
          console.warn(`[SEED_PREREQ] Probe failed for ${table} (${errStatus}):`, errText);
          result.errors.push(`${table} probe failed: ${errStatus}`);
          continue;
        }

        const found = await check.json();
        if (found && found.length > 0) {
          console.log(`[SEED_PREREQ] Record exists in ${table}.`);
          continue;
        }

        console.log(`[SEED_PREREQ] Inserting into ${table}...`);
        const insert = await fetch(`${INSFORGE_URL}/api/database/records/${table}`, {
          method: "POST",
          headers: { ...HEADERS, "Prefer": "return=minimal" },
          body: JSON.stringify(zonePayload)
        });

        if (insert.ok) {
          console.log(`[SEED_PREREQ] Success for ${table}`);
          result.zones++;
          publishTableChange(table, "insert", zonePayload);
        } else {
          const errText = await insert.text();
          console.warn(`[SEED_PREREQ] Insert failed for ${table}:`, errText);
          result.errors.push(`${table} insert failed: ${errText}`);
        }
      } catch (e: any) {
        console.error(`[SEED_PREREQ] Critical error for ${table}:`, e);
        result.errors.push(`${table} exception: ${e.message}`);
      }
    }

    return result;
  });

export const seedDemoOrders = createServerFn({ method: "POST" })
  .handler(async () => {
    console.log("[SEED] Starting idempotent demo seeding...");
    
    const city1Id = "c1110000-0000-0000-0000-000000000001";
    const zone1Id = "z1110000-0000-0000-0000-000000000001";

    // 1. Ensure a demo restaurant exists
    const restSearch = await fetch(`${INSFORGE_URL}/api/database/records/restaurants?metadata->>demo_tag=eq.logistics_test_v2&limit=1`, { headers: HEADERS });
    let restaurants = restSearch.ok ? await restSearch.json() : [];
    
    if (!restaurants.length) {
      console.log("[SEED] Creating demo restaurant...");
      const demoRest = {
        id: newUuid(),
        name: "Scoobix Demo Kitchen",
        address: "123 Logistics Hub, Vadodara",
        status: "ACTIVE",
        zone_id: zone1Id,
        city_id: city1Id,
        metadata: { is_demo: true, demo_tag: "logistics_test_v2" }
      };
      const createRest = await fetch(`${INSFORGE_URL}/api/database/records/restaurants`, {
        method: "POST", 
        headers: { ...HEADERS, "Prefer": "return=representation" }, 
        body: JSON.stringify(demoRest)
      });
      if (createRest.ok) {
        const created = await createRest.json();
        restaurants = Array.isArray(created) ? created : [created];
        if (restaurants.length === 0) restaurants = [demoRest];
      }
    }

    // 2. Ensure a demo customer exists
    const userSearch = await fetch(`${INSFORGE_URL}/api/database/records/users?metadata->>demo_tag=eq.logistics_test_v2&limit=1`, { headers: HEADERS });
    let customers = userSearch.ok ? await userSearch.json() : [];
    
    if (!customers.length) {
      console.log("[SEED] Creating demo customer...");
      const demoCust = {
        id: newUuid(),
        name: "Demo Customer",
        role: "customer",
        email: "demo.customer@scoobix.test",
        metadata: { is_demo: true, demo_tag: "logistics_test_v2" }
      };
      const createCust = await fetch(`${INSFORGE_URL}/api/database/records/users`, {
        method: "POST", 
        headers: { ...HEADERS, "Prefer": "return=representation" }, 
        body: JSON.stringify(demoCust)
      });
      if (createCust.ok) {
        const created = await createCust.json();
        customers = Array.isArray(created) ? created : [created];
        if (customers.length === 0) customers = [demoCust];
      }
    }

    // 3. Get a zone (prefer the one we seeded)
    const zonesRes = await fetch(`${INSFORGE_URL}/api/database/records/logistics_zones?id=eq.${zone1Id}`, { headers: HEADERS });
    let zones = zonesRes.ok ? await zonesRes.json() : [];
    if (!zones.length) {
      const allZones = await fetch(`${INSFORGE_URL}/api/database/records/logistics_zones?limit=1`, { headers: HEADERS });
      zones = allZones.ok ? await allZones.json() : [];
    }
    const zoneId = zones[0]?.id;

    if (!restaurants.length || !customers.length) {
      throw new Error("Failed to create prerequisite demo data (restaurant/customer)");
    }

    const statuses = ["PLACED", "ACCEPTED", "ON_THE_WAY", "DELIVERED", "CANCELLED"];
    let seeded = 0;
    let existing = 0;

    for (let i = 0; i < 5; i++) {
      const demoRef = `demo_order_v2_${i}`;
      
      // Idempotency check
      const checkRes = await fetch(`${INSFORGE_URL}/api/database/records/orders?metadata->>demo_ref=eq.${demoRef}&limit=1`, { headers: HEADERS });
      const found = checkRes.ok ? await checkRes.json() : [];
      
      if (found.length > 0) {
        existing++;
        continue;
      }

      const order = {
        id: newUuid(),
        customer_id: customers[0].id,
        restaurant_id: restaurants[0].id,
        status: statuses[i % statuses.length],
        zone_id: zoneId,
        total_price: 250 + (i * 50),
        created_at: new Date().toISOString(),
        metadata: { is_demo: true, demo_tag: "logistics_test_v2", demo_ref: demoRef },
        items: {
          lines: [{ id: "item1", name: "Demo Meal", price: 200, qty: 1 }],
          meta: { restaurantName: restaurants[0].name, addressLine: "123 Demo St" }
        },
        delivery_address: "123 Demo Street, Vadodara",
        payment_method: "CASH",
        payment_status: i % 2 === 0 ? "COMPLETED" : "PENDING"
      };

      const res = await fetch(`${INSFORGE_URL}/api/database/records/orders`, {
        method: "POST",
        headers: { ...HEADERS, "Prefer": "return=representation" },
        body: JSON.stringify(order)
      });

      if (res.ok) {
        seeded++;
        publishTableChange("orders", "insert", order);
      } else {
        const errText = await res.text();
        console.error(`[SEED] Failed to insert order ${demoRef}:`, errText);
        throw new Error(`Database error: ${errText}`);
      }
    }

    return { seeded, existing, total: seeded + existing };
  });
