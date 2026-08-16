import { listTable, createRecord, patchRecord, deleteRecord, handleResponse } from "./insforge-crud";
import { publishTableChange } from "./realtime-bus";
import { newUuid } from "./orders-api";
import { insforge } from "./insforge";

export type Gig = {
  id: string;
  title?: string;
  description?: string;
  payout: number;
  reward_amount?: number; // UI alias
  target_deliveries?: number;
  start_time?: string;
  end_time?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled" | "ACTIVE" | "SCHEDULED" | string;
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
  const { id, ...rest } = params || {};

  try {
    let rows: any[] = [];
    if (id) {
      // PROBE: try 'gigs' first, then 'delivery_gigs'
      const { data, error, status } = await insforge.database.from(TABLE).select("*").eq("id", id);
      if (error && (status === 404 || error.message.includes("does not exist"))) {
        console.warn(`[GIGS_API] Table "gigs" missing, probing "delivery_gigs"...`);
        const alt = await insforge.database.from("delivery_gigs").select("*").eq("id", id);
        rows = alt.data || [];
      } else {
        rows = data || [];
      }
    } else {
      // For lists, we use the candidate discovery in listTable if we had it, 
      // but here we'll just try 'gigs' and handle the error.
      try {
        const data = await listTable<any>(TABLE, rest, { fresh: true, ttl: 0 });
        rows = Array.isArray(data) ? data : [];
      } catch (e: any) {
        if (e.message.includes("does not exist")) {
           const altData = await listTable<any>("delivery_gigs", rest, { fresh: true, ttl: 0 });
           rows = Array.isArray(altData) ? altData : [];
        } else {
          throw e;
        }
      }
    }
    
    // Normalize mapping for UI
    return rows.map(r => ({
      ...r,
      title: r.metadata?.title || r.title || r.gig_type || `Gig ${r.id.substring(0,8)}`,
      description: r.metadata?.description || r.description || "Delivery shift",
      reward_amount: r.payout || r.reward_amount || 0,
      payout: r.payout || r.reward_amount || 0,
      target_deliveries: r.metadata?.target_deliveries || r.target_deliveries || 1,
      start_time: r.metadata?.start_time || r.start_time || r.created_at,
      end_time: r.metadata?.end_time || r.end_time || r.created_at,
      capacity: r.metadata?.capacity || r.capacity || 1,
      status: r.status
    }));
  } catch (err: any) {
    console.error(`[GIGS_API] Fetch failed:`, err.message);
    throw err;
  }
}

export async function createGig(gig: Omit<Gig, "id" | "created_at">) {
  const id = newUuid();
  
  // Map UI fields to database columns
  const record = {
    id,
    payout: gig.payout || gig.reward_amount || 0,
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
    // Probe candidates
    const CANDIDATES = ["gigs", "delivery_gigs"];
    let lastErr: any = null;
    
    for (const table of CANDIDATES) {
      try {
        const res = await createRecord<Gig>(table, record);
        if (res) {
          publishTableChange(table, "insert", res as any);
          return res;
        }
      } catch (e: any) {
        lastErr = e;
        if (e.message.includes("does not exist") || e.status === 404) continue;
        throw e;
      }
    }
    throw lastErr || new Error("No valid gig table found");
  } catch (error: any) {
    console.error(`[GIGS_API] Create failed:`, error.message);
    throw error;
  }
}


export async function updateGig(id: string, patch: Partial<Gig>) {
  const CANDIDATES = ["gigs", "delivery_gigs"];
  let lastErr: any = null;
  for (const table of CANDIDATES) {
    try {
      const res = await patchRecord<Gig>(table, id, patch as any);
      if (res) return res;
    } catch (e: any) {
      lastErr = e;
      if (e.message.includes("does not exist") || e.status === 404) continue;
      throw e;
    }
  }
  throw lastErr || new Error("Gig not found in any candidate table");
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

