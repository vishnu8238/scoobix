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
  return listTable<Gig>("gigs", { 
    order: "created_at.desc", 
    ...params 
  });
}

export async function createGig(gig: Omit<Gig, "id" | "created_at">) {
  const id = newUuid();
  // InsForge SDK typically expects an object, not an array for single inserts in createRecord helper
  const res = await createRecord<Gig>("gigs", { ...gig, id });
  if (res) {
    publishTableChange("gigs", "insert", res as any);
  } else {
    // createRecord returns null on error without throwing, but we want to know if it failed
    console.error("[GIGS_API] Gig creation returned null. Check table permissions/RLS.");
  }
  return res;
}

export async function updateGig(id: string, patch: Partial<Gig>) {
  return patchRecord<Gig>("gigs", id, patch as any);
}

export async function fetchGigParticipants(gigId: string) {
  return listTable<GigParticipant>("gig_participants", { gig_id: `eq.${gigId}`, order: "completed_deliveries.desc" });
}
