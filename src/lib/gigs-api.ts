import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";

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
  return listTable<Gig>("gigs", { order: "created_at.desc", ...params });
}

export async function createGig(gig: Omit<Gig, "id" | "created_at">) {
  return createRecord<Gig>("gigs", gig as any);
}

export async function updateGig(id: string, patch: Partial<Gig>) {
  return patchRecord<Gig>("gigs", id, patch as any);
}

export async function fetchGigParticipants(gigId: string) {
  return listTable<GigParticipant>("gig_participants", { gig_id: `eq.${gigId}`, order: "completed_deliveries.desc" });
}
