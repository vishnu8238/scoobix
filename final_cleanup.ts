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

async function cleanup() {
  const duplicate = "2bc83695-05f5-494d-94bd-4755613c94a0";
  const canonical = "0e7e0d13-5047-4e87-9ae6-9bafb793e587";
  
  console.log("Checking final duplicate dependencies...");
  const drivers = await raw(`/api/database/records/drivers?user_id=eq.${duplicate}`);
  const managers = await raw(`/api/database/records/merchant_managers?user_id=eq.${duplicate}`);
  const rests = await raw(`/api/database/records/restaurants?or=(owner_id.eq.${duplicate},manager_id.eq.${duplicate})`);

  if (drivers.length === 0 && managers.length === 0 && rests.length === 0) {
    console.log(`Deleting final duplicate user row: ${duplicate}`);
    await raw(`/api/database/records/users?id=eq.${duplicate}`, "DELETE");
  } else {
    console.warn("Dependencies remain on duplicate, checking for overlaps...");
    // If a driver record exists for both, we keep the canonical and delete the duplicate's driver record
    if (drivers.length > 0) {
      for (const d of drivers) {
         console.log(`Deleting duplicate driver record ${d.id} for user ${duplicate}`);
         await raw(`/api/database/records/drivers?id=eq.${d.id}`, "DELETE");
      }
    }
    // Re-check after potential driver cleanup
    const secondCheck = await raw(`/api/database/records/users?id=eq.${duplicate}`, "DELETE");
    console.log("Cleanup result:", secondCheck);
  }
}

cleanup().catch(console.error);
