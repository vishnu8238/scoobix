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
  console.log("[GIGS_API] Fetching authoritative gigs...", JSON.stringify(params));
  try {
    const data = await listTable<Gig>("gigs", { 
      select: "id,title,description,reward_amount,target_deliveries,start_time,end_time,status,zone_id,subzone_id,city_id,capacity,completion_pct,created_at",
      order: "created_at.desc", 
      ...params 
    }, { fresh: true });
    
    // Diagnostic log for production visibility
    console.log(`[GIGS_API] Fetch success. Found ${data.length} gigs. First 2 ids:`, 
      data.slice(0, 2).map(g => g.id).join(", "));
    
    return data;
  } catch (err: any) {
    console.error("[GIGS_API] Fetch failed:", err.message, err.status);
    throw err;
  }
}

export async function createGig(gig: Omit<Gig, "id" | "created_at">) {
  const id = newUuid();
  console.log("[GIGS_API] Attempting Gig creation...", JSON.stringify({ id, ...gig }));
  try {
    const res = await createRecord<Gig>("gigs", { ...gig, id });
    if (res) {
      console.log("[GIGS_API] Create SUCCESS. Authoritative response:", JSON.stringify(res));
      publishTableChange("gigs", "insert", res as any);
      return res;
    }
    console.error("[GIGS_API] Create returned null/empty. This usually means an RLS failure on SELECT-back.");
    // We return the input as a "optimistic" success if createRecord didn't throw
    return { ...gig, id, created_at: new Date().toISOString() } as unknown as Gig;
  } catch (error: any) {
    console.error("[GIGS_API] Create FATAL ERROR:", error.message, "Status:", error.status);
    throw error;
  }
}

export async function updateGig(id: string, patch: Partial<Gig>) {
  return patchRecord<Gig>("gigs", id, patch as any);
}

export async function fetchGigParticipants(gigId: string) {
  return listTable<GigParticipant>("gig_participants", { gig_id: `eq.${gigId}`, order: "completed_deliveries.desc" });
}
