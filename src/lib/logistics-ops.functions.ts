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
    console.log("[SEED_PREREQ] Starting idempotent city/zone seeding...");
    
    const city1Id = "c1111111-1111-4111-a111-111111111111";
    const zone1Id = "z1111111-1111-4111-a111-111111111111";
    
    const tables = ["logistics_zones", "delivery_zones"];
    let result = { cities: 0, zones: 0 };

    for (const table of tables) {
      try {
        // 1. Check if Zone 1 exists in this table
        const check = await fetch(`${INSFORGE_URL}/api/database/records/${table}?id=eq.${zone1Id}`, { headers: HEADERS });
        const found = check.ok ? await check.json() : [];
        
        if (found && found.length > 0) {
          console.log(`[SEED_PREREQ] Zone 1 already exists in ${table}.`);
          continue;
        }

        // 2. Insert Zone 1 (which includes the city name)
        const zone = {
          id: zone1Id,
          name: "Zone 1",
          city: "City 1",
          city_id: city1Id,
          status: "ACTIVE",
          boundary: { type: "Polygon", coordinates: [[[0,0], [0,1], [1,1], [1,0], [0,0]]] },
          center_lat: 22.3072,
          center_lng: 73.1812,
          metadata: { is_demo: true, demo_tag: "logistics_test_v2" }
        };

        const insert = await fetch(`${INSFORGE_URL}/api/database/records/${table}`, {
          method: "POST",
          headers: { ...HEADERS, "Prefer": "return=minimal" },
          body: JSON.stringify(zone)
        });

        if (insert.ok) {
          console.log(`[SEED_PREREQ] Successfully seeded Zone 1 to ${table}.`);
          result.zones++;
          publishTableChange(table, "insert", zone);
        } else {
          const err = await insert.text();
          console.warn(`[SEED_PREREQ] Failed to seed ${table}:`, err);
        }
      } catch (e) {
        console.error(`[SEED_PREREQ] Error seeding ${table}:`, e);
      }
    }

    return result;
  });

export const seedDemoOrders = createServerFn({ method: "POST" })
  .handler(async () => {
    console.log("[SEED] Starting idempotent demo seeding...");
    
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

    // 3. Get a zone
    const zonesRes = await fetch(`${INSFORGE_URL}/api/database/records/logistics_zones?limit=1`, { headers: HEADERS });
    const zones = zonesRes.ok ? await zonesRes.json() : [];
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
