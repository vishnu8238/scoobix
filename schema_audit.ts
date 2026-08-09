import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function raw(path: string) {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    headers: { apikey: INSFORGE_ANON_KEY, Authorization: `Bearer ${INSFORGE_ANON_KEY}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

async function schemaAudit() {
  const email = "kumarp83975@gmail.com";
  const canonical = "0e7e0d13-5047-4e87-9ae6-9bafb793e587";
  const knownFragmented = [
    "24ac5fec-ec76-44a8-8abe-c86fd9bac8e2",
    "06bccf81-91f2-4786-88f4-5e94182c3520",
    "9b92f964-b743-4c7f-b11d-352157bf770c",
    "2bc83695-05f5-494d-94bd-4755613c94a0",
    "5229959d-02a2-4dac-85a4-2520c209f7b3"
  ];

  // 1. Discover all UUIDs for this email
  const allUsers = await raw(`/api/database/records/users?email=eq.${encodeURIComponent(email)}`);
  const allUuids = Array.from(new Set([...allUsers.map((u: any) => u.id), ...knownFragmented]));
  
  console.log(`TOTAL DUPLICATE USERS FOR EMAIL: ${allUsers.length}`);
  console.log(`TOTAL UNIQUE UUIDS IN AUDIT SCOPE: ${allUuids.length}`);

  // 2. Define tables and columns to inspect
  const targetTables = [
    { table: "users", cols: ["id"] },
    { table: "drivers", cols: ["user_id"] },
    { table: "merchant_managers", cols: ["user_id"] },
    { table: "restaurants", cols: ["owner_id", "manager_id"] },
    { table: "orders", cols: ["customer_id", "driver_id"] },
    { table: "order_items", cols: [] }, // Usually via order_id
    { table: "payments", cols: ["user_id"] },
    { table: "driver_tracking", cols: ["driver_id"] },
    { table: "reviews", cols: ["user_id", "customer_id"] },
    { table: "favorites", cols: ["user_id"] },
    { table: "wallet_transactions", cols: ["user_id"] },
    { table: "support_tickets", cols: ["user_id", "assigned_to"] },
    { table: "support_ticket_messages", cols: ["author_id"] },
    { table: "notifications", cols: ["user_id"] },
    { table: "meal_subscriptions", cols: ["customer_id"] },
    { table: "bulk_requests", cols: ["customer_id"] },
    { table: "coupons", cols: ["created_by"] },
    { table: "coupon_usage", cols: ["user_id"] },
    { table: "scratch_cards", cols: ["user_id"] }
  ];

  console.log("\n--- DEPENDENCY MATRIX ---");
  console.log("TABLE | COLUMN | FRAGMENTED UUID | RECORD COUNT | PURPOSE");
  
  let affectedTables = 0;
  let affectedRecords = 0;

  for (const t of targetTables) {
    let tableHasHits = false;
    for (const col of t.cols) {
      for (const uuid of allUuids) {
        const records = await raw(`/api/database/records/${t.table}?${col}=eq.${uuid}`);
        if (records.length > 0) {
          const isCanonical = uuid === canonical;
          const status = isCanonical ? "CANONICAL" : "FRAGMENTED";
          console.log(`${t.table} | ${col} | ${uuid.slice(0,8)}... (${status}) | ${records.length} | ${t.table} reference`);
          affectedRecords += records.length;
          tableHasHits = true;
        }
      }
    }
    if (tableHasHits) affectedTables++;
  }

  // 3. Detailed look at Driver data
  console.log("\n--- ACTIVE DRIVER DATA ---");
  for (const uuid of allUuids) {
    const drivers = await raw(`/api/database/records/drivers?user_id=eq.${uuid}`);
    for (const d of drivers) {
      console.log(`Driver ID: ${d.id} | User ID: ${uuid} | Online: ${d.online} | Status: ${d.status}`);
      // Find orders for this driver
      const orders = await raw(`/api/database/records/orders?driver_id=eq.${d.id}`);
      console.log(`  - Historical Orders: ${orders.length}`);
    }
  }

  // 4. Detailed look at Manager data
  console.log("\n--- ACTIVE MANAGER DATA ---");
  for (const uuid of allUuids) {
    const managers = await raw(`/api/database/records/merchant_managers?user_id=eq.${uuid}`);
    for (const m of managers) {
      console.log(`Manager ID: ${m.id} | User ID: ${uuid} | Status: ${m.status}`);
      // Find restaurants for this manager
      const rests = await raw(`/api/database/records/restaurants?manager_id=eq.${uuid}`);
      console.log(`  - Managed Restaurants: ${rests.length}`);
    }
  }

  // 5. Audit logs / Wallet
  console.log("\n--- FINANCIAL / WALLET DATA ---");
  for (const uuid of allUuids) {
    const txs = await raw(`/api/database/records/wallet_transactions?user_id=eq.${uuid}`);
    if (txs.length > 0) {
      console.log(`UUID ${uuid.slice(0,8)}... has ${txs.length} wallet transactions.`);
    }
  }

  console.log(`\nTOTAL AFFECTED TABLES: ${affectedTables}`);
  console.log(`TOTAL AFFECTED RECORDS: ${affectedRecords}`);
}

schemaAudit();
