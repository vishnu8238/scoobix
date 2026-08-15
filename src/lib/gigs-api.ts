import { listTable, createRecord, patchRecord, deleteRecord, handleResponse } from "./insforge-crud";
import { publishTableChange } from "./realtime-bus";
import { newUuid } from "./orders-api";
import { insforge } from "./insforge";

export type Gig = {
  id: string;
  title: string;
  description: string;
  reward_amount: number;
  target_deliveries: number;
  start_time: string;
  end_time: string;
  status: "ACTIVE" | "SCHEDULED" | "COMPLETED" | "CANCELLED";
  zone_id?: string;
  subzone_id?: string;
  city_id?: string;
  completion_pct?: number;
  capacity?: number;
  created_at: string;
};

export type GigParticipant = {
  id: string;
  gig_id: string;
  rider_id: string;
  completed_deliveries: number;
  status: "ENROLLED" | "COMPLETED" | "FAILED";
  joined_at: string;
};

export async function fetchGigs(params?: Record<string, any>) {
  // Authoritative Discovery: The production error 'relation "public.gigs" does not exist'
  // suggests the table might be named 'delivery_gigs' or the schema prefix is wrong.
  // We probe 'gigs' first, then 'delivery_gigs'.
  const TABLE_CANDIDATES = ["gigs", "delivery_gigs"]; 
  const GIG_COLUMNS = "id,title,description,reward_amount,target_deliveries,start_time,end_time,status,zone_id,city_id,capacity,created_at";
  const { select, id, ...rest } = params || {};
  
  for (const table of TABLE_CANDIDATES) {
    try {
      console.log(`[GIGS_API] Authoritative probe for table "${table}"...`);
      
      // If an ID is provided, perform a direct SELECT by ID for authoritative verification
      if (id) {
        const query = insforge.database.from(table).select(select || GIG_COLUMNS).eq("id", id);
        const rows = await handleResponse<Gig[]>(query, "GET", table);
        if (Array.isArray(rows) && rows.length > 0) return rows;
        if (id && rows.length === 0) continue; // Try next candidate if not found
      }

      // Standard list fetch
      let data = await listTable<Gig>(table, { 
        order: "start_time.asc", 
        ...rest 
      }, { 
        fresh: true, 
        ttl: 0,
        select: select || GIG_COLUMNS
      });
      
      if (Array.isArray(data)) return data;
    } catch (err: any) {
      console.warn(`[GIGS_API] Probe failed for "${table}":`, err.message);
      
      // If it's a relation error (404), continue to next candidate
      if (err.status === 404 || err.isRelationError) {
        continue;
      }
      
      // If it's a 406 (Not Acceptable) or 401, it might be the column list. Try SELECT * once.
      if (err.status === 406 || err.status === 401) {
        console.warn(`[GIGS_API] Retrying "${table}" with SELECT * fallback...`);
        try {
          const fallback = await listTable<Gig>(table, { limit: 1000 }, { fresh: true, ttl: 0, select: "*" });
          if (Array.isArray(fallback)) return fallback;
        } catch (retryErr) {
          // ignore retry err, throw original if this was the last candidate
        }
      }
      
      // If this is the last candidate, throw the error
      if (table === TABLE_CANDIDATES[TABLE_CANDIDATES.length - 1]) {
        throw err;
      }
    }
  }
  
  return [];
}


export async function createGig(gig: Omit<Gig, "id" | "created_at">) {
  const TABLE = "gigs";
  const id = newUuid();
  try {
    const res = await createRecord<Gig>(TABLE, { ...gig, id });
    if (res) {
      publishTableChange(TABLE, "insert", res as any);
      return res;
    }
    throw new Error(`Insert into "${TABLE}" returned null`);
  } catch (error: any) {
    throw error;
  }
}

export async function updateGig(id: string, patch: Partial<Gig>) {
  return patchRecord<Gig>("gigs", id, patch as any);
}

export async function fetchGigParticipants(gigId: string) {
  return listTable<GigParticipant>("gig_participants", { gig_id: `eq.${gigId}`, order: "completed_deliveries.desc" });
}

export async function enrollInGig(gigId: string, riderId: string) {
  const TABLE = "gig_participants";
  
  // Check if already enrolled
  const existing = await listTable<GigParticipant>(TABLE, {
    gig_id: `eq.${gigId}`,
    rider_id: `eq.${riderId}`
  });
  
  if (existing && existing.length > 0) return existing[0];

  const id = newUuid();
  const participant: Omit<GigParticipant, "id" | "joined_at"> = {
    gig_id: gigId,
    rider_id: riderId,
    completed_deliveries: 0,
    status: "ENROLLED"
  };
  
  return createRecord<GigParticipant>(TABLE, { ...participant, id });
}

export async function cancelGigEnrollment(gigId: string, riderId: string) {
  const TABLE = "gig_participants";
  const existing = await listTable<GigParticipant>(TABLE, {
    gig_id: `eq.${gigId}`,
    rider_id: `eq.${riderId}`
  });
  
  if (existing && existing.length > 0) {
    return deleteRecord(TABLE, existing[0].id);
  }
  return null;
}

export async function fetchRiderGigs(riderId: string) {
  const participations = await listTable<GigParticipant>("gig_participants", {
    rider_id: `eq.${riderId}`
  });
  
  if (!participations.length) return [];
  
  const gigIds = participations.map(p => p.gig_id);
  // Ideally use .in filter if SDK supports it, or individual fetches
  const gigs = await Promise.all(
    gigIds.map(id => listTable<Gig>("gigs", { id: `eq.${id}`, limit: 1 }).then(rows => rows[0]))
  );
  
  return gigs.filter(Boolean).map(g => {
    const p = participations.find(pp => pp.gig_id === g.id);
    return { ...g, enrollment: p };
  });
}
