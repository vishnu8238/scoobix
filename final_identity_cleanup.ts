import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function raw(path: string, method: string = "GET", body?: any) {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    method,
    headers: {
      apikey: INSFORGE_ANON_KEY,
      Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

async function verify() {
  const canonical = "0e7e0d13-5047-4e87-9ae6-9bafb793e587";
  const email = "kumarp83975@gmail.com";
  
  const users = await raw(`/api/database/records/users?email=eq.${encodeURIComponent(email)}`);
  const managers = await raw(`/api/database/records/merchant_managers?user_id=eq.${canonical}`);
  const rests = await raw(`/api/database/records/restaurants?manager_id=eq.${canonical}`);
  
  console.log("FINAL_VERIFY_USERS_COUNT:" + users.length);
  console.log("FINAL_VERIFY_CANONICAL_ID:" + (users.find((u: any) => u.id === canonical)?.id || "MISSING"));
  console.log("FINAL_VERIFY_MANAGER_COUNT:" + managers.length);
  console.log("FINAL_VERIFY_REST_COUNT:" + rests.length);
}

verify().catch(console.error);
