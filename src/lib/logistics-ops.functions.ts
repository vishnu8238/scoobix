import { createServerFn } from "@tanstack/react-start";
import { newUuid } from "./orders-api";
import { requireInsForgeAuth } from "@/integrations/insforge/auth-middleware";

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
      const tables = ["gigs", "cities", "zones", "subzones", "restaurants", "orders", "users"];
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
      const cityTableCandidates = ["cities"];
      const zoneTableCandidates = ["zones"];
      
      for (const table of cityTableCandidates) {
        try {
          const { status, error } = await insforge.database.from(table).upsert({
            id: CITY_1_ID,
            name: fallbackCityName,
            status: "ACTIVE",
            // metadata removed
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
            // metadata removed
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
        // metadata removed
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

export const getLogisticsDemoData = createServerFn({ method: "GET" })
  .handler(async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const city1Id = "c1110000-0000-0000-0000-000000000001";
    const zone1Id = "z1110000-0000-0000-0000-000000000001";
    const restId = "r1110000-0000-0000-0000-000000000001";
    const custId = "u1110000-0000-0000-0000-000000000001";

    const demoGigs = [
      {
        id: "demo-gig-1",
        title: "Morning Shift - Vadodara Central",
        description: "Standard morning peak shift. Clearly marked DEMO DATA.",
        reward_amount: 500,
        target_deliveries: 15,
        start_time: `${todayStr}T08:00:00Z`,
        end_time: `${todayStr}T12:00:00Z`,
        status: "ACTIVE",
        city_id: city1Id,
        zone_id: zone1Id,
        capacity: 10,
        // metadata removed
        created_at: new Date().toISOString()
      },
      {
        id: "demo-gig-2",
        title: "Lunch Peak Express",
        description: "High volume lunch shift. Clearly marked DEMO DATA.",
        reward_amount: 350,
        target_deliveries: 10,
        start_time: `${todayStr}T12:00:00Z`,
        end_time: `${todayStr}T15:00:00Z`,
        status: "ACTIVE",
        city_id: city1Id,
        zone_id: zone1Id,
        capacity: 15,
        // metadata removed
        created_at: new Date().toISOString()
      },
      {
        id: "demo-gig-3",
        title: "Evening Logistics Surge",
        description: "Late night delivery surge incentive. Clearly marked DEMO DATA.",
        reward_amount: 600,
        target_deliveries: 20,
        start_time: `${todayStr}T18:00:00Z`,
        end_time: `${todayStr}T22:00:00Z`,
        status: "ACTIVE",
        city_id: city1Id,
        zone_id: zone1Id,
        capacity: 8,
        // metadata removed
        created_at: new Date().toISOString()
      }
    ];

    const demoOrders = [
      {
        id: "e433da54-560c-4c50-bf0b-7cd68acf11e6",
        customer_id: custId,
        restaurant_id: restId,
        status: "ON_THE_WAY",
        total_price: 450,
        created_at: new Date().toISOString(),
        delivery_address: "123 Demo St, Central Vadodara",
        items: { lines: [{ name: "Demo Pizza", qty: 1, price: 400 }] },
        payment_status: "PAID",
        pickup_address: "Scoobix Demo Kitchen, Vadodara",
        // metadata removed
      },
      {
        id: "d922ca54-450b-4b50-af0a-6cd58acf00d5",
        customer_id: custId,
        restaurant_id: restId,
        status: "PREPARING",
        total_price: 320,
        created_at: new Date().toISOString(),
        delivery_address: "456 Tech Park, Alkapuri",
        items: { lines: [{ name: "Demo Burger Meal", qty: 2, price: 160 }] },
        payment_status: "PAID",
        pickup_address: "Scoobix Demo Kitchen, Vadodara",
        // metadata removed
      },
      {
        id: "c811ba54-340a-3a50-bf0b-5cd48acf99c4",
        customer_id: custId,
        restaurant_id: restId,
        status: "PLACED",
        total_price: 890,
        created_at: new Date().toISOString(),
        delivery_address: "789 Residential View, Gotri",
        items: { lines: [{ name: "Demo Family Pack", qty: 1, price: 850 }] },
        payment_status: "PENDING",
        pickup_address: "Scoobix Demo Kitchen, Vadodara",
        // metadata removed
      }
    ];

    return { gigs: demoGigs, orders: demoOrders };
  });
