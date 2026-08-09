import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function raw(path: string) {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    headers: { apikey: INSFORGE_ANON_KEY, Authorization: `Bearer ${INSFORGE_ANON_KEY}` }
  });
  return res.json();
}

async function verify() {
  const canonical = "0e7e0d13-5047-4e87-9ae6-9bafb793e587";
  const email = "kumarp83975@gmail.com";
  
  console.log("--- FINAL AUTH INTEGRITY REPORT ---");
  
  const userRows = await raw(`/api/database/records/users?email=eq.${encodeURIComponent(email)}`);
  const drivers = await raw(`/api/database/records/drivers?user_id=eq.${canonical}`);
  const managers = await raw(`/api/database/records/merchant_managers?user_id=eq.${canonical}`);
  const restaurants = await raw(`/api/database/records/restaurants?manager_id=eq.${canonical}`);
  
  console.log("CANONICAL AUTH UUID:", canonical);
  console.log("CANONICAL USERS ROW:", userRows.find((u: any) => u.id === canonical) ? "EXISTS" : "MISSING");
  console.log("DUPLICATE USERS REMAINING:", userRows.filter((u: any) => u.id !== canonical).length);
  
  console.log("\n--- RESOLVED ROLES ---");
  console.log("DRIVER USER_ID:", canonical, `(Count: ${drivers.length})`);
  console.log("MANAGER USER_ID:", canonical, `(Count: ${managers.length})`);
  console.log("RESTAURANT MANAGER REFS:", canonical, `(Count: ${restaurants.length})`);
  
  console.log("\n--- DATABASE REFERENCES CHECK ---");
  if (userRows.length === 1 && userRows[0].id === canonical) {
    console.log("IDENTITY HARDENING: SUCCESS (Single User Row)");
  } else {
    console.warn("IDENTITY HARDENING: PENDING (Duplicates remain or canonical missing)");
  }
}

verify().catch(console.error);
