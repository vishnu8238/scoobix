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
  // DISCOVERY: Try to find the correct table name
  const TABLE = "gigs"; 
  console.log(`[GIGS_API] Fetching authoritative data from "${TABLE}"...`, JSON.stringify(params));
  
  try {
    const data = await listTable<Gig>(TABLE, { 
      select: "*",
      order: "created_at.desc", 
      ...params 
    }, { fresh: true });
    
    // Diagnostic log for production visibility
    console.log(`[GIGS_API] Fetch success from "${TABLE}". Found ${data.length} rows. Project: ${import.meta.env.VITE_SUPABASE_URL || 'Lovable Cloud'}`);
    if (data.length > 0) {
      console.log(`[GIGS_API] First row diagnostic: ID=${data[0].id} Title="${data[0].title}" Start="${data[0].start_time}"`);
    }
    
    return data;
  } catch (err: any) {
    console.error(`[GIGS_API] Fetch failed from "${TABLE}":`, err.message, "Status:", err.status);
    throw err;
  }
}

export async function createGig(gig: Omit<Gig, "id" | "created_at">) {
  const TABLE = "gigs";
  const id = newUuid();
  console.log(`[GIGS_API] Attempting INSERT into "${TABLE}"...`, JSON.stringify({ id, ...gig }));
  
  try {
    const res = await createRecord<Gig>(TABLE, { ...gig, id });
    if (res) {
      console.log(`[GIGS_API] Authoritative INSERT success into "${TABLE}". Response:`, JSON.stringify(res));
      // Read-back is already handled in createRecord, so if we're here, it's verified.
      publishTableChange(TABLE, "insert", res as any);
      return res;
    }
    throw new Error(`Insert into "${TABLE}" returned null without throwing - check RLS/Table Existence`);
  } catch (error: any) {
    console.error(`[GIGS_API] Create FATAL ERROR on "${TABLE}":`, error.message, "Status:", error.status);
    throw error;
  }
}

export async function updateGig(id: string, patch: Partial<Gig>) {
  return patchRecord<Gig>("gigs", id, patch as any);
}

export async function fetchGigParticipants(gigId: string) {
  return listTable<GigParticipant>("gig_participants", { gig_id: `eq.${gigId}`, order: "completed_deliveries.desc" });
}
