import { listTable, createRecord, patchRecord, deleteRecord, handleResponse } from "./insforge-crud";
import { publishTableChange } from "./realtime-bus";
import { newUuid } from "./orders-api";
import { insforge } from "./insforge";

export type Gig = {
  id: string;
  title?: string;
  description?: string;
  payout: number;
  reward_amount?: number; // legacy alias
  target_deliveries: number;
  start_time: string;
  end_time: string;
  status: "pending" | "in_progress" | "completed" | "cancelled" | "ACTIVE" | "SCHEDULED";
  zone_id?: string;
  city_id?: string;
  capacity?: number;
  metadata?: Record<string, any>;
  created_at: string;
  driver_id?: string;
  order_id?: string;
};

export type GigParticipant = {
  id: string;
  gig_id: string;
  rider_id: string;
  completed_deliveries: number;
  status: "ENROLLED" | "COMPLETED" | "FAILED";
  created_at: string;
};

export async function fetchGigs(params?: Record<string, any>) {
  const TABLE = "gigs";
  const GIG_COLUMNS = "*";
  const { id, ...rest } = params || {};

  
  try {
    let rows: any[] = [];
    if (id) {
      const query = insforge.database.from(TABLE).select(GIG_COLUMNS).eq("id", id);
      const res = await handleResponse<any[]>(query, "GET", TABLE);
      rows = Array.isArray(res) ? res : [];
    } else {
      const data = await listTable<any>(TABLE, { 
        order: "created_at.desc", 
        ...rest 
      }, { 
        fresh: true, 
        ttl: 0,
        select: GIG_COLUMNS
      });
      rows = Array.isArray(data) ? data : [];
    }
    
    // Normalize mapping for UI
    return rows.map(r => ({
      ...r,
      title: r.title || r.metadata?.title || `Gig ${r.id.substring(0,8)}`,
      description: r.description || r.metadata?.description || "Delivery shift",
      reward_amount: r.payout || r.reward_amount || 0,
      payout: r.payout || 0,
      target_deliveries: r.target_deliveries || r.metadata?.target_deliveries || 1,
      start_time: r.start_time || r.metadata?.start_time || r.created_at,
      end_time: r.end_time || r.metadata?.end_time || r.created_at,
      capacity: r.capacity || r.metadata?.capacity || 1,
      status: r.status
    }));
  } catch (err: any) {
    console.error(`[GIGS_API] Fetch failed:`, err.message);
    throw err;
  }
}



export async function createGig(gig: Omit<Gig, "id" | "created_at">) {
  const TABLE = "gigs";
  const id = newUuid();
  
  // Map UI fields to database columns
  const record = {
    id,
    payout: gig.reward_amount || 0,
    status: gig.status?.toLowerCase() || "pending",
    zone_id: gig.zone_id,
    gig_type: "delivery",
    metadata: {
      ...gig.metadata,
      title: gig.title,
      description: gig.description,
      target_deliveries: gig.target_deliveries,
      start_time: gig.start_time,
      end_time: gig.end_time,
      capacity: gig.capacity
    }
  };

  try {
    const res = await createRecord<Gig>(TABLE, record);
    if (res) {
      publishTableChange(TABLE, "insert", res as any);
      return res;
    }
    return null;
  } catch (error: any) {
    console.error(`[GIGS_API] Create failed:`, error.message);
    throw error;
  }
}


export async function updateGig(id: string, patch: Partial<Gig>) {
  return patchRecord<Gig>("gigs", id, patch as any);
}

export async function fetchGigParticipants(gigId: string) {
  return listTable<GigParticipant>("rider_gig_enrollments", { gig_id: `eq.${gigId}`, order: "completed_deliveries.desc" });
}

export async function enrollInGig(gigId: string, riderId: string) {
  const TABLE = "rider_gig_enrollments";
  
  // 1. Authoritative checks
  const [gigRows, existing, participants] = await Promise.all([
    fetchGigs({ id: gigId }),
    listTable<GigParticipant>(TABLE, { gig_id: `eq.${gigId}`, rider_id: `eq.${riderId}` }),
    listTable<GigParticipant>(TABLE, { gig_id: `eq.${gigId}` })
  ]);

  const gig = gigRows[0];
  if (!gig) throw new Error("Gig not found");
  if (gig.status !== "ACTIVE" && gig.status !== "SCHEDULED") throw new Error("Gig is not active for booking");
  if (existing && existing.length > 0) return existing[0];
  
  const currentCount = participants?.length || 0;
  if (gig.capacity && currentCount >= gig.capacity) {
    throw new Error("Gig is at full capacity");
  }

  const id = newUuid();
  const participant: Omit<GigParticipant, "id" | "created_at"> = {
    gig_id: gigId,
    rider_id: riderId,
    completed_deliveries: 0,
    status: "ENROLLED"
  };
  
  const res = await createRecord<GigParticipant>(TABLE, { ...participant, id });
  if (res) publishTableChange(TABLE, "insert", res as any);
  return res;
}

export async function cancelGigEnrollment(gigId: string, riderId: string) {
  const TABLE = "rider_gig_enrollments";
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
  const participations = await listTable<GigParticipant>("rider_gig_enrollments", {
    rider_id: `eq.${riderId}`
  });
  
  if (!participations.length) return [];
  
  const gigIds = participations.map(p => p.gig_id);
  const gigs = await Promise.all(
    gigIds.map(id => fetchGigs({ id }).then(rows => rows[0]))
  );
  
  return gigs.filter(Boolean).map(g => {
    const p = participations.find(pp => pp.gig_id === g.id);
    return { ...g, enrollment: p };
  });
}

