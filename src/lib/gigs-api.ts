import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";
import { publishTableChange } from "./realtime-bus";
import { newUuid } from "./orders-api";

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
    const data = await listTable<Gig>(TABLE, { 
      select: "*",
      order: "created_at.desc", 
      ...params 
    }, { fresh: true });
    return data;
  } catch (err: any) {
    console.error(`[GIGS_API] Fetch failed from "${TABLE}":`, err.message);
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

/**
 * Rider Gig enrollment
 */
export async function enrollInGig(gigId: string, riderId: string) {
  const TABLE = "gig_participants";
  const id = newUuid();
  const participant: Omit<GigParticipant, "id" | "joined_at"> = {
    gig_id: gigId,
    rider_id: riderId,
    completed_deliveries: 0,
    status: "ENROLLED"
  };
  
  return createRecord<GigParticipant>(TABLE, { ...participant, id });
}
