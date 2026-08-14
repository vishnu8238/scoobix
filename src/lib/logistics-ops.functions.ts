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
    const [restRes, userRes] = await Promise.all([
      fetch(`${INSFORGE_URL}/api/database/records/restaurants?limit=3`, { headers: HEADERS }),
      fetch(`${INSFORGE_URL}/api/database/records/users?role=eq.customer&limit=3`, { headers: HEADERS })
    ]);

    const restaurants = restRes.ok ? await restRes.json() : [];
    const customers = userRes.ok ? await userRes.json() : [];

    if (!restaurants.length || !customers.length) {
      throw new Error("Need at least one restaurant and one customer to seed orders.");
    }

    const statuses = ["PLACED", "ACCEPTED", "ON_THE_WAY", "DELIVERED", "CANCELLED"];
    const orders = [];

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
        total_price: Math.floor(Math.random() * 1000) + 200,
        created_at: new Date().toISOString(),
        metadata: { is_demo: true, demo_tag: "logistics_test_v1" },
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
      }
    }

    return { seeded: orders.length };
  });
