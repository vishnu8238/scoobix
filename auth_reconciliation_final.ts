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
  if (!res.ok) {
    const text = await res.text();
    console.error(`Error ${res.status} on ${path}:`, text);
    return null;
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data ? [data] : []);
}

async function executeReconciliation() {
  const email = "kumarp83975@gmail.com";
  const canonical = "0e7e0d13-5047-4e87-9ae6-9bafb793e587";
  const orphan = "5229959d-02a2-4dac-85a4-2520c209f7b3";
  
  // Phase 1: Backup/Export
  console.log("--- PHASE 1: BACKUP ---");
  const users = await raw(`/api/database/records/users?email=eq.${encodeURIComponent(email)}`);
  console.log(`Exported ${users?.length} user rows.`);
  
  const fragmentedUuids = users?.map((u: any) => u.id).filter((id: string) => id !== canonical) || [];
  fragmentedUuids.push(orphan);

  // Phase 3 & 4: Membership Migration
  console.log("\n--- PHASE 3 & 4: MEMBERSHIP MIGRATION ---");
  
  // Repoint drivers
  for (const uuid of fragmentedUuids) {
    const drivers = await raw(`/api/database/records/drivers?user_id=eq.${uuid}`);
    if (drivers && drivers.length > 0) {
      for (const d of drivers) {
        console.log(`Repointing Driver ${d.id} from ${uuid} to ${canonical}`);
        await raw(`/api/database/records/drivers?id=eq.${d.id}`, "PATCH", { user_id: canonical });
      }
    }
  }

  // Repoint merchant_managers
  for (const uuid of fragmentedUuids) {
    const managers = await raw(`/api/database/records/merchant_managers?user_id=eq.${uuid}`);
    if (managers && managers.length > 0) {
      for (const m of managers) {
        console.log(`Repointing Manager ${m.id} from ${uuid} to ${canonical}`);
        await raw(`/api/database/records/merchant_managers?id=eq.${m.id}`, "PATCH", { user_id: canonical });
      }
    }
  }

  // Phase 5: Orphan Restaurant Repointing
  console.log("\n--- PHASE 5: ORPHAN REPAIR ---");
  const rests = await raw(`/api/database/records/restaurants?manager_id=eq.${orphan}`);
  if (rests && rests.length > 0) {
    for (const r of rests) {
      console.log(`Repointing Restaurant ${r.name} manager from ${orphan} to ${canonical}`);
      await raw(`/api/database/records/restaurants?id=eq.${r.id}`, "PATCH", { manager_id: canonical });
    }
  }

  // Verification
  console.log("\n--- VERIFICATION ---");
  const finalDrivers = await raw(`/api/database/records/drivers?user_id=eq.${canonical}`);
  const finalManagers = await raw(`/api/database/records/merchant_managers?user_id=eq.${canonical}`);
  const finalRests = await raw(`/api/database/records/restaurants?manager_id=eq.${canonical}`);
  
  console.log(`Canonical UUID ${canonical} now has:`);
  console.log(`- Drivers: ${finalDrivers?.length}`);
  console.log(`- Managers: ${finalManagers?.length}`);
  console.log(`- Managed Restaurants: ${finalRests?.length}`);

  // Final Cleanup: Duplicate Users
  console.log("\n--- PHASE 6: USER CLEANUP ---");
  for (const uuid of fragmentedUuids) {
    if (uuid === orphan) continue;
    // Check for any remaining dependencies before deleting
    const dCheck = await raw(`/api/database/records/drivers?user_id=eq.${uuid}`);
    const mCheck = await raw(`/api/database/records/merchant_managers?user_id=eq.${uuid}`);
    const rCheck = await raw(`/api/database/records/restaurants?or=(owner_id.eq.${uuid},manager_id.eq.${uuid})`);
    
    if (dCheck?.length === 0 && mCheck?.length === 0 && rCheck?.length === 0) {
      console.log(`Deleting fragmented user row: ${uuid}`);
      await raw(`/api/database/records/users?id=eq.${uuid}`, "DELETE");
    } else {
      console.warn(`SKIPPING deletion of ${uuid} - dependencies still exist!`);
    }
  }
}

executeReconciliation().catch(console.error);
