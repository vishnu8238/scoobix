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
        method: "POST", headers: HEADERS, body: JSON.stringify(demoRest)
      });
      if (createRest.ok) restaurants = [demoRest];
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
        method: "POST", headers: HEADERS, body: JSON.stringify(demoCust)
      });
      if (createCust.ok) customers = [demoCust];
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
        headers: HEADERS,
        body: JSON.stringify(order)
      });

      if (res.ok) {
        seeded++;
        publishTableChange("orders", "insert", order);
      }
    }

    return { seeded, existing, total: seeded + existing };
  });
