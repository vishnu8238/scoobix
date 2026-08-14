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
    // 1. Get a few restaurants and users to link to
    const [restRes, userRes, zonesRes] = await Promise.all([
      fetch(`${INSFORGE_URL}/api/database/records/restaurants?limit=3`, { headers: HEADERS }),
      fetch(`${INSFORGE_URL}/api/database/records/users?role=eq.customer&limit=3`, { headers: HEADERS }),
      fetch(`${INSFORGE_URL}/api/database/records/logistics_zones?limit=1`, { headers: HEADERS })
    ]);

    let restaurants = restRes.ok ? await restRes.json() : [];
    let customers = userRes.ok ? await userRes.json() : [];
    const zones = zonesRes.ok ? await zonesRes.json() : [];

    // Fallback: If no restaurants or customers, create demo ones
    if (!restaurants.length) {
      console.log("[SEED] No restaurants found, creating demo restaurant...");
      const demoRest = {
        id: newUuid(),
        name: "Demo Kitchen",
        status: "ACTIVE",
        metadata: { is_demo: true, demo_tag: "logistics_test_v2" }
      };
      await fetch(`${INSFORGE_URL}/api/database/records/restaurants`, {
        method: "POST", headers: HEADERS, body: JSON.stringify(demoRest)
      });
      restaurants = [demoRest];
    }
    
    if (!customers.length) {
      console.log("[SEED] No customers found, creating demo customer...");
      const demoCust = {
        id: newUuid(),
        name: "Demo Customer",
        role: "customer",
        metadata: { is_demo: true, demo_tag: "logistics_test_v2" }
      };
      await fetch(`${INSFORGE_URL}/api/database/records/users`, {
        method: "POST", headers: HEADERS, body: JSON.stringify(demoCust)
      });
      customers = [demoCust];
    }

    const zoneId = zones[0]?.id;
    const statuses = ["PLACED", "ACCEPTED", "ON_THE_WAY", "DELIVERED", "CANCELLED"];
    const orders = [];

    // Check for existing demo orders to ensure idempotency
    const existingDemoRes = await fetch(`${INSFORGE_URL}/api/database/records/orders?metadata->>demo_tag=eq.logistics_test_v2&limit=1`, { headers: HEADERS });
    const existingDemo = existingDemoRes.ok ? await existingDemoRes.json() : [];
    
    if (existingDemo.length > 0) {
      console.log("[SEED] Demo orders already exist, skipping creation.");
      return { seeded: 0, message: "Demo orders already exist" };
    }

    for (let i = 0; i < 5; i++) {
      const id = newUuid();
      const restaurant = restaurants[i % restaurants.length];
      const customer = customers[i % customers.length];
      const status = statuses[i % statuses.length];
      
      const order = {
        id,
        customer_id: customer.id,
        restaurant_id: restaurant.id,
        status,
        zone_id: zoneId,
        total_price: Math.floor(Math.random() * 1000) + 200,
        created_at: new Date().toISOString(),
        metadata: { is_demo: true, demo_tag: "logistics_test_v2" },
        items: {
          lines: [{ id: "item1", name: "Demo Burger", price: 150, qty: 1 }],
          meta: { restaurantName: restaurant.name, addressLabel: "Home", addressLine: "Demo Street 123" }
        },
        delivery_address: "Demo Street 123, Vadodara",
        payment_method: "CASH",
        payment_status: status === "DELIVERED" ? "COMPLETED" : "PENDING"
      };

      const res = await fetch(`${INSFORGE_URL}/api/database/records/orders`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(order)
      });

      if (res.ok) {
        orders.push(order);
        publishTableChange("orders", "insert", order);
      } else {
        const err = await res.text();
        console.error(`[SEED] Failed to insert order ${i}:`, err);
      }
    }

    return { seeded: orders.length };
  });
