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
  const old = "2bc83695-05f5-494d-94bd-4755613c94a0";
  
  console.log("--- FINAL AUTH IDENTITY VERIFICATION ---");
  
  const users = await raw(`/api/database/records/users?email=eq.${encodeURIComponent(email)}`);
  const managers = await raw(`/api/database/records/merchant_managers?user_id=eq.${canonical}`);
  const oldManagers = await raw(`/api/database/records/merchant_managers?user_id=eq.${old}`);
  const rests = await raw(`/api/database/records/restaurants?manager_id=eq.${canonical}`);

  console.log("USERS FOR EMAIL:", users.length);
  console.log("CANONICAL USERS ID:", users.find((u: any) => u.id === canonical)?.id || "MISSING");
  console.log("DUPLICATE USERS REMAINING:", users.filter((u: any) => u.id !== canonical).length);
  
  console.log("\n--- MEMBERSHIP CHECK ---");
  console.log("MANAGER USER_ID:", canonical, `(Count: ${managers.length})`);
  console.log("MANAGER REFERENCES TO OLD UUID:", oldManagers.length);
  console.log("RESTAURANT REFERENCES TO CANONICAL:", rests.length);

  console.log("\n--- CODE AUDIT SEARCH ---");
}

verify().catch(console.error);
