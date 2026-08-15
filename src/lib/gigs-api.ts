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
  const TABLE = "gigs"; 
  try {
    const GIG_COLUMNS = "id,title,description,reward_amount,target_deliveries,start_time,end_time,status,zone_id,city_id,capacity,created_at";
    const { select, id, ...rest } = params || {};
    
    // If an ID is provided, perform a direct SELECT by ID for authoritative verification
    if (id) {
      console.log(`[GIGS_API] Authoritative SELECT by ID for "${TABLE}:${id}"`);
      const query = insforge.database.from(TABLE).select(select || GIG_COLUMNS).eq("id", id);
      const rows = await handleResponse<Gig[]>(query, "GET", TABLE);
      return Array.isArray(rows) ? rows : [];
    }

    // Standard list fetch
    let data = await listTable<Gig>(TABLE, { 
      order: "start_time.asc", 
      ...rest 
    }, { 
      fresh: true, 
      ttl: 0,
      select: select || GIG_COLUMNS
    });
    
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.error(`[GIGS_API] Fetch failed from "${TABLE}":`, err.message, "Status:", err.status);
    
    if (err.status === 406 || err.status === 401) {
      console.warn(`[GIGS_API] Retrying "${TABLE}" with SELECT * fallback...`);
      try {
        const fallback = await listTable<Gig>(TABLE, { limit: 1000 }, { fresh: true, ttl: 0, select: "*" });
        return Array.isArray(fallback) ? fallback : [];
      } catch (retryErr) {
        throw err;
      }
    }
    
    throw err;
  }
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
