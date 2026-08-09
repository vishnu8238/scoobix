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

async function fixManagers() {
  const canonical = "0e7e0d13-5047-4e87-9ae6-9bafb793e587";
  const old = "2bc83695-05f5-494d-94bd-4755613c94a0";

  console.log("Inspecting merchant_managers records...");
  const canonRecs = await raw(`/api/database/records/merchant_managers?user_id=eq.${canonical}`);
  const oldRecs = await raw(`/api/database/records/merchant_managers?user_id=eq.${old}`);

  console.log(`Canonical (${canonical}) count: ${canonRecs.length}`);
  console.log(`Old (${old}) count: ${oldRecs.length}`);

  if (oldRecs.length > 0) {
    for (const rec of oldRecs) {
      console.log(`Found duplicate/fragmented manager record ID: ${rec.id} for user ${old}`);
      // Check if canonical already has a record. If it does, and this one is just a duplicate, we delete it.
      // If canonical DOESN'T have one, we repoint this one.
      if (canonRecs.length > 0) {
        console.log(`Canonical already has a record. Deleting duplicate record ${rec.id}`);
        await raw(`/api/database/records/merchant_managers?id=eq.${rec.id}`, "DELETE");
      } else {
        console.log(`Canonical missing record. Repointing ${rec.id} to ${canonical}`);
        await raw(`/api/database/records/merchant_managers?id=eq.${rec.id}`, "PATCH", { user_id: canonical });
      }
    }
  }

  // Final verification of user row for 'old' just in case it wasn't deleted in previous turn
  const oldUser = await raw(`/api/database/records/users?id=eq.${old}`);
  if (oldUser.length > 0) {
    console.log(`Old user row ${old} still exists. Checking dependencies before deletion...`);
    const d = await raw(`/api/database/records/drivers?user_id=eq.${old}`);
    const m = await raw(`/api/database/records/merchant_managers?user_id=eq.${old}`);
    const r = await raw(`/api/database/records/restaurants?or=(owner_id.eq.${old},manager_id.eq.${old})`);
    if (d.length === 0 && m.length === 0 && r.length === 0) {
      console.log(`Deleting user row ${old}`);
      await raw(`/api/database/records/users?id=eq.${old}`, "DELETE");
    }
  }

  console.log("Verification:");
  const finalOld = await raw(`/api/database/records/merchant_managers?user_id=eq.${old}`);
  console.log(`Remaining records for ${old}: ${finalOld.length}`);
}

fixManagers().catch(console.error);
