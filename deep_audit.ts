import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./src/lib/insforge";

async function raw(path: string) {
  const res = await fetch(`${INSFORGE_URL}${path}`, {
    headers: { apikey: INSFORGE_ANON_KEY, Authorization: `Bearer ${INSFORGE_ANON_KEY}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [data];
}

async function deepAudit() {
  const email = "kumarp83975@gmail.com";
  const users = await raw(`/api/database/records/users?email=eq.${encodeURIComponent(email)}`);
  
  console.log("--- IDENTITY MAPPING ---");
  for (const u of users) {
    const d = await raw(`/api/database/records/drivers?user_id=eq.${u.id}`);
    const m = await raw(`/api/database/records/merchant_managers?user_id=eq.${u.id}`);
    const ro = await raw(`/api/database/records/restaurants?owner_id=eq.${u.id}`);
    const rm = await raw(`/api/database/records/restaurants?manager_id=eq.${u.id}`);
    
    if (d.length || m.length || ro.length || rm.length) {
      console.log(`\nUUID: ${u.id}`);
      console.log(`Email: ${u.email} | Role: ${u.role} | Last Login: ${u.last_login_at}`);
      if (d.length) console.log(`- DRIVER RECORD: YES`);
      if (m.length) console.log(`- MANAGER RECORD: YES`);
      if (ro.length) console.log(`- RESTAURANT OWNER: ${ro.length} rests`);
      if (rm.length) console.log(`- RESTAURANT MANAGER: ${rm.length} rests`);
    }
  }

  const orphan = "5229959d-02a2-4dac-85a4-2520c209f7b3";
  const orphanRests = await raw(`/api/database/records/restaurants?manager_id=eq.${orphan}`);
  console.log(`\n--- ORPHAN UUID: ${orphan} ---`);
  console.log(`References found in restaurants.manager_id: ${orphanRests.length}`);
  orphanRests.forEach((r: any) => console.log(`- ${r.name} (${r.id})`));
}

deepAudit();
