import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function raw(path: string) {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    headers: { apikey: INSFORGE_ANON_KEY, Authorization: `Bearer ${INSFORGE_ANON_KEY}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

async function reconcile() {
  const targetUuids = [
    "24ac5fec-ec76-44a8-8abe-c86fd9bac8e2",
    "06bccf81-91f2-4786-88f4-5e94182c3520",
    "9b92f964-b743-4c7f-b11d-352157bf770c",
    "2bc83695-05f5-494d-94bd-4755613c94a0",
    "5229959d-02a2-4dac-85a4-2520c209f7b3",
    "0e7e0d13-5047-4e87-9ae6-9bafb793e587"
  ];

  console.log("--- 1. DRIVER RECONCILIATION ---");
  for (const uuid of targetUuids) {
    const drivers = await raw(`/api/database/records/drivers?user_id=eq.${uuid}`);
    for (const d of drivers) {
      console.log(`DRIVER UUID: ${uuid} | DRIVER_ID: ${d.id}`);
      console.log(JSON.stringify(d, null, 2));
    }
  }

  console.log("\n--- 2. MANAGER RECONCILIATION ---");
  for (const uuid of targetUuids) {
    const managers = await raw(`/api/database/records/merchant_managers?user_id=eq.${uuid}`);
    for (const m of managers) {
      console.log(`MANAGER UUID: ${uuid} | MANAGER_ID: ${m.id}`);
      console.log(JSON.stringify(m, null, 2));
    }
  }

  console.log("\n--- 3. ORPHAN MANAGER SEARCH (5229959d...) ---");
  const orphan = "5229959d-02a2-4dac-85a4-2520c209f7b3";
  // Search in other tables for this UUID as a value
  const tables = ["orders", "payments", "notifications", "wallet_transactions", "drivers", "merchant_managers", "users"];
  for (const t of tables) {
    const hits = await raw(`/api/database/records/${t}?or=(id.eq.${orphan},user_id.eq.${orphan},driver_id.eq.${orphan},customer_id.eq.${orphan})`);
    if (hits.length > 0) console.log(`Orphan UUID found in ${t}: ${hits.length} records`);
  }

  console.log("\n--- 4. RESTAURANT ANALYSIS ---");
  const rests = await raw(`/api/database/records/restaurants?manager_id=eq.${orphan}`);
  for (const r of rests) {
    console.log(`REST: ${r.name} (${r.id}) | OWNER: ${r.owner_id} | MANAGER: ${r.manager_id} | STATUS: ${r.status}`);
  }

  console.log("\n--- 10. UNIQUE EMAIL AUDIT ---");
  const allUsers = await raw(`/api/database/records/users?select=email`);
  const counts: Record<string, number> = {};
  allUsers.forEach((u: any) => { if (u.email) counts[u.email] = (counts[u.email] || 0) + 1; });
  const duplicates = Object.entries(counts).filter(([_, c]) => c > 1);
  console.log(`TOTAL USERS: ${allUsers.length}`);
  console.log(`TOTAL UNIQUE EMAILS: ${Object.keys(counts).length}`);
  console.log(`DUPLICATE EMAIL COUNT: ${duplicates.length}`);
  console.log(`DUPLICATES:`, JSON.stringify(duplicates, null, 2));
}

reconcile();
