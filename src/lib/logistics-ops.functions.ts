import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { publishTableChange } from "./realtime-bus";
import { newUuid } from "./orders-api";
import { requireInsForgeAuth } from "@/integrations/insforge/auth-middleware";
import type { OrderStatus } from "./types";

/**
 * Idempotently seeds City 1 and Zone 1 prerequisites for Gig creation.
 * Uses hardcoded authoritative UUIDs to ensure selector stability.
 * Authenticated via per-request SDK client.
 */
export const seedLogisticsPrerequisites = createServerFn({ method: "POST" })
  .middleware([requireInsForgeAuth])
  .handler(async ({ context }) => {
    const { insforge } = context;
    console.log("[SEED_PREREQ] Starting authoritative logistics seed...");
    
    const result = { 
      success: false,
      errors: [] as string[],
      diagnostics: [] as any[],
      schema: [] as any[]
    };

    const CITY_1_ID = "c1110000-0000-0000-0000-000000000001";
    const ZONE_1_ID = "z1110000-0000-0000-0000-000000000001";

    try {
      // Step 0: Authoritative schema discovery
      const tables = ["gigs", "cities", "zones", "logistics_zones", "delivery_zones", "subzones", "restaurants", "orders", "users"];
      for (const table of tables) {
        try {
          // Check for relation existence
          const { status, error } = await insforge.database.from(table).select("count").limit(1);
          result.schema.push({ 
            table, 
            status: status || 0, 
            exists: status === 200 || status === 206 || status === 406, 
            error: error?.message 
          });
        } catch (err: any) {
          result.schema.push({ table, status: 500, exists: false, error: err.message });
        }
      }

      // Step 1: Discover valid city names from restaurants for fallback
      let fallbackCityName = "Vadodara";
      try {
        const { data: restaurants } = await insforge.database
          .from("restaurants")
          .select("city")
          .limit(10);
        
        if (restaurants && restaurants.length > 0) {
          const found = restaurants.find(r => r.city);
          if (found) fallbackCityName = found.city;
        }
      } catch (e) {
        console.warn("[SEED_PREREQ] Restaurant probe failed, using Vadodara fallback.");
      }

      // Step 2: Idempotent seed for cities and zones
      // We probe for the writable table
      const cityTableCandidates = ["cities", "logistics_cities", "delivery_cities"];
      const zoneTableCandidates = ["zones", "logistics_zones", "delivery_zones"];
      
      for (const table of cityTableCandidates) {
        try {
          const { status, error } = await insforge.database.from(table).upsert({
            id: CITY_1_ID,
            name: fallbackCityName,
            status: "ACTIVE",
            metadata: { demo_tag: "logistics_test_v5" }
          }, { onConflict: 'id' });
          
          result.diagnostics.push({ 
            table, 
            op: "upsert_city", 
            status, 
            success: status === 200 || status === 201 || status === 204 || status === 409 || status === 406,
            error: error?.message 
          });
        } catch (e: any) {
          result.diagnostics.push({ table, op: "upsert_city", status: 500, error: e.message });
        }
      }

      for (const table of zoneTableCandidates) {
        try {
          const { status, error } = await insforge.database.from(table).upsert({
            id: ZONE_1_ID,
            city_id: CITY_1_ID,
            name: "Main Zone",
            status: "ACTIVE",
            metadata: { demo_tag: "logistics_test_v5" }
          }, { onConflict: 'id' });
          
          result.diagnostics.push({ 
            table, 
            op: "upsert_zone", 
            status, 
            success: status === 200 || status === 201 || status === 204 || status === 409 || status === 406,
            error: error?.message 
          });
        } catch (e: any) {
          result.diagnostics.push({ table, op: "upsert_zone", status: 500, error: e.message });
        }
      }
      
      result.success = true;

    } catch (e: any) {
      console.error("[SEED_PREREQ] Critical error:", e);
      result.errors.push(e.message);
    }

    return result;
  });

export const performProductionGigTest = createServerFn({ method: "POST" })
  .middleware([requireInsForgeAuth])
  .handler(async ({ context }) => {
    const { insforge } = context;
    const TABLE = "gigs";
    const testId = newUuid();
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log(`[GIG_TEST] Starting production test on "${TABLE}"...`);
    
    try {
      // 1. Discover auth context
      const authUser = await insforge.auth.getCurrentUser();
      
      // 2. Insert test record
      const gig = {
        id: testId,
        title: `Production Verification Gig - ${now.toISOString()}`,
        description: "Automated verification record for production persistence check",
        reward_amount: 1,
        target_deliveries: 1,
        start_time: now.toISOString(),
        end_time: tomorrow.toISOString(),
        status: "ACTIVE",
        city_id: "c1110000-0000-0000-0000-000000000001",
        zone_id: "z1110000-0000-0000-0000-000000000001",
        capacity: 1,
        metadata: { is_test: true, timestamp: now.toISOString() }
      };

      console.log(`[GIG_TEST] Inserting into "${TABLE}"...`);
      const { data: inserted, error: insertError } = await insforge.database
        .from(TABLE)
        .insert([gig])
        .select()
        .single();

      if (insertError) throw insertError;
      
      // 3. Immediate read-back
      console.log(`[GIG_TEST] Verifying read-back for ${testId}...`);
      const { data: readBack, error: readError } = await insforge.database
        .from(TABLE)
        .select("*")
        .eq("id", testId)
        .single();

      if (readError) throw readError;

      // 4. List check
      const { data: list } = await insforge.database
        .from(TABLE)
        .select("id")
        .limit(10);

      return {
        success: true,
        userId: authUser.data?.user?.id,
        testRecordId: testId,
        inserted: !!inserted,
        readBack: !!readBack,
        listCount: list?.length || 0,
        errors: []
      };
    } catch (err: any) {
      console.error("[GIG_TEST] FAILED:", err);
      return {
        success: false,
        error: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code
      };
    }
  });

export const seedDemoOrders = createServerFn({ method: "POST" })
  .middleware([requireInsForgeAuth])
  .handler(async ({ context }) => {
    const { insforge } = context;
    console.log("[SEED] Starting idempotent demo seeding via SDK...");
    
    const city1Id = "c1110000-0000-0000-0000-000000000001";
    const zone1Id = "z1110000-0000-0000-0000-000000000001";

    // 1. Ensure a demo restaurant exists
    const { data: restaurantsFound } = await insforge.database
      .from("restaurants")
      .select("*")
      .filter("metadata->>demo_tag", "eq", "logistics_test_v3")
      .limit(1);
    
    let restaurants = restaurantsFound || [];
    
    if (!restaurants.length) {
      console.log("[SEED] Creating demo restaurant...");
      const demoRest = {
        id: newUuid(),
        name: "Scoobix Demo Kitchen",
        address: "123 Logistics Hub, Vadodara",
        status: "ACTIVE",
        zone_id: zone1Id,
        city_id: city1Id,
        metadata: { is_demo: true, demo_tag: "logistics_test_v3" }
      };
      const { data: created } = await insforge.database
        .from("restaurants")
        .insert([demoRest])
        .select()
        .single();
      
      if (created) restaurants = [created];
      else restaurants = [demoRest];
    }

    // 2. Ensure a demo customer exists
    const { data: usersFound } = await insforge.database
      .from("users")
      .select("*")
      .filter("metadata->>demo_tag", "eq", "logistics_test_v3")
      .limit(1);
    
    let customers = usersFound || [];
    
    if (!customers.length) {
      console.log("[SEED] Creating demo customer...");
      const demoCust = {
        id: newUuid(),
        name: "Demo Customer",
        role: "customer",
        email: "demo.customer@scoobix.test",
        metadata: { is_demo: true, demo_tag: "logistics_test_v3" }
      };
      const { data: created } = await insforge.database
        .from("users")
        .insert([demoCust])
        .select()
        .single();
      
      if (created) customers = [created];
      else customers = [demoCust];
    }

    // 3. Get a zone (prefer the one we seeded)
    const { data: zonesFound } = await insforge.database
      .from("logistics_zones")
      .select("id")
      .eq("id", zone1Id)
      .limit(1);
    
    let zones = zonesFound || [];
    if (!zones.length) {
      const { data: allZones } = await insforge.database
        .from("logistics_zones")
        .select("id")
        .limit(1);
      zones = allZones || [];
    }
    const zoneId = zones[0]?.id;

    if (!restaurants.length || !customers.length) {
      throw new Error("Failed to create prerequisite demo data (restaurant/customer)");
    }

    const statuses: OrderStatus[] = ["PLACED", "ACCEPTED", "ON_THE_WAY", "DELIVERED", "CANCELLED"];
    let seeded = 0;
    let existing = 0;

    for (let i = 0; i < 5; i++) {
      const demoRef = `demo_order_v4_${i}`;
      
      const { data: found } = await insforge.database
        .from("orders")
        .select("id")
        .filter("metadata->>demo_ref", "eq", demoRef)
        .limit(1);
      
      if (found && found.length > 0) {
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
        metadata: { is_demo: true, demo_tag: "logistics_test_v4", demo_ref: demoRef },
        items: {
          lines: [{ id: "item1", name: "Demo Meal", price: 200, qty: 1 }],
          meta: { restaurantName: restaurants[0].name, addressLine: "123 Demo St" }
        },
        delivery_address: "123 Demo Street, Vadodara",
        payment_method: "CASH",
        payment_status: i % 2 === 0 ? "PAID" : "PENDING"
      };

      const { data: inserted, error: insertError } = await insforge.database
        .from("orders")
        .insert([order])
        .select()
        .single();

      if (!insertError && inserted) {
        seeded++;
        publishTableChange("orders", "insert", inserted);
      } else {
        console.error(`[SEED] Failed to insert order ${demoRef}:`, insertError?.message);
      }
    }

    return { seeded, existing, total: seeded + existing };
  });