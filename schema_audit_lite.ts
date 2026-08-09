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
  const allUsers = await raw(`/api/database/records/users?email=eq.${encodeURIComponent(email)}`);
  const fragmented = [
    "24ac5fec-ec76-44a8-8abe-c86fd9bac8e2",
    "06bccf81-91f2-4786-88f4-5e94182c3520",
    "9b92f964-b743-4c7f-b11d-352157bf770c",
    "2bc83695-05f5-494d-94bd-4755613c94a0",
    "5229959d-02a2-4dac-85a4-2520c209f7b3"
  ];
  const allUuids = Array.from(new Set([...allUsers.map((u: any) => u.id), ...fragmented]));
  
  const tables = [
    { table: "drivers", col: "user_id" },
    { table: "merchant_managers", col: "user_id" },
    { table: "restaurants", col: "owner_id" },
    { table: "restaurants", col: "manager_id" },
    { table: "orders", col: "customer_id" },
    { table: "orders", col: "driver_id" },
    { table: "wallet_transactions", col: "user_id" }
  ];

  console.log("TABLE | COLUMN | UUID | COUNT");
  for (const t of tables) {
    for (const uuid of allUuids) {
      const records = await raw(`/api/database/records/${t.table}?${t.col}=eq.${uuid}`);
      if (records.length > 0) {
        console.log(`${t.table} | ${t.col} | ${uuid} | ${records.length}`);
      }
    }
  }
}

schemaAudit();
