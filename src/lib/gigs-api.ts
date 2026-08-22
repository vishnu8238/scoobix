import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";
import { publishTableChange } from "./realtime-bus";
import { newUuid } from "./orders-api";
import { insforge } from "./insforge";
import { publishRiderRefresh } from "./delivery-sync";

export type Gig = {
  id: string;
  driver_id?: string;
  order_id?: string;
  gig_type: string;
  status: string;
  pickup_location?: string;
  dropoff_location?: string;
  distance_km?: number;
  estimated_time_minutes?: number;
  payout: number;
  tips?: number;
  zone_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  // UI Aliases & Legacy Props (Handled via normalization)
  title?: string;
  description?: string;
  reward_amount?: number;
  target_deliveries?: number;
  start_time?: string;
  end_time?: string;
  capacity?: number;
  city_id?: string;
};

export type GigParticipant = {
  id: string;
  gig_id: string;
  rider_id: string;
  completed_deliveries: number;
  status: "ENROLLED" | "COMPLETED" | "FAILED";
  created_at: string;
};

const AUTHORITATIVE_TABLE = "gigs";

export async function fetchGigs(params?: Record<string, any>) {
  const { id, ...rest } = params || {};

  try {
    let rows: any[] = [];
    if (id) {
      const { data } = await insforge.database.from(AUTHORITATIVE_TABLE).select("*").eq("id", id);
      rows = data || [];
    } else {
      const data = await listTable<any>(AUTHORITATIVE_TABLE, rest, { fresh: true, ttl: 0 });
      rows = Array.isArray(data) ? data : [];
    }
    
    // Normalize mapping for UI
    return rows.map(r => ({
      ...r,
      // Priority: Root column > Metadata > Fallback
      title: r.title || r.metadata?.title || r.gig_type || "Unavailable Gig",
      description: r.description || r.metadata?.description || "Delivery shift",
      reward_amount: r.payout || r.reward_amount || 0,
      payout: r.payout || r.reward_amount || 0,
      target_deliveries: r.target_deliveries || r.metadata?.target_deliveries || 1,
      start_time: r.start_time || r.metadata?.start_time || r.created_at,
      end_time: r.end_time || r.metadata?.end_time || r.created_at,
      capacity: r.capacity || r.metadata?.capacity || 50,
      city_id: r.city_id || r.metadata?.city_id || "unknown",
      status: r.status
    }));
  } catch (err: any) {
    console.error(`[GIGS_API] Fetch failed for ${AUTHORITATIVE_TABLE}:`, err.message);
    throw err;
  }
}

export async function createGig(gig: Partial<Gig>) {
  const id = gig.id || newUuid();
  
  // Map UI fields to database columns based on 'gigs' table schema
  const record = {
    id,
    payout: gig.payout || gig.reward_amount || 0,
    status: gig.status?.toLowerCase() || "pending",
    zone_id: gig.zone_id,
    gig_type: gig.gig_type || "delivery",
    pickup_location: gig.pickup_location || "",
    dropoff_location: gig.dropoff_location || "",
    // Extra fields stored in metadata for schema compatibility
    metadata: {
      ...gig.metadata,
      title: gig.title,
      description: gig.description,
      target_deliveries: gig.target_deliveries,
      start_time: gig.start_time,
      end_time: gig.end_time,
      capacity: gig.capacity,
      city_id: gig.city_id
    }
  };

  try {
    const res = await createRecord<Gig>(AUTHORITATIVE_TABLE, record);
    if (res) {
      publishTableChange(AUTHORITATIVE_TABLE, "insert", res as any);
      publishRiderRefresh();
      return res;
    }
    throw new Error(`Failed to create gig in ${AUTHORITATIVE_TABLE}`);
  } catch (error: any) {
    console.error(`[GIGS_API] Create failed for ${AUTHORITATIVE_TABLE}:`, error.message);
    throw error;
  }
}

export async function updateGig(id: string, patch: Partial<Gig>) {
  try {
    const dbPatch: any = { ...patch };
    
    if (patch.reward_amount !== undefined) dbPatch.payout = patch.reward_amount;
    if (patch.payout !== undefined) dbPatch.reward_amount = patch.payout;
    
    const metadataUpdate: any = {};
    if (patch.title !== undefined) metadataUpdate.title = patch.title;
    if (patch.description !== undefined) metadataUpdate.description = patch.description;
    if (patch.target_deliveries !== undefined) metadataUpdate.target_deliveries = patch.target_deliveries;
    if (patch.start_time !== undefined) metadataUpdate.start_time = patch.start_time;
    if (patch.end_time !== undefined) metadataUpdate.end_time = patch.end_time;
    if (patch.capacity !== undefined) metadataUpdate.capacity = patch.capacity;
    if (patch.city_id !== undefined) metadataUpdate.city_id = patch.city_id;
    
    if (Object.keys(metadataUpdate).length > 0) {
      dbPatch.metadata = metadataUpdate;
    }

    const res = await patchRecord<Gig>(AUTHORITATIVE_TABLE, id, dbPatch);
    if (res) {
      publishRiderRefresh();
      return res;
    }
    throw new Error(`Gig ${id} not found in ${AUTHORITATIVE_TABLE}`);
  } catch (error: any) {
    console.error(`[GIGS_API] Update failed for ${AUTHORITATIVE_TABLE}:`, error.message);
    throw error;
  }
}

export async function deleteGig(gigId: string, enrollmentCount: number) {
  try {
    if (enrollmentCount === 0) {
      const res = await deleteRecord(AUTHORITATIVE_TABLE, gigId);
      publishTableChange(AUTHORITATIVE_TABLE, "delete", { id: gigId });
      publishRiderRefresh();
      return res;
    } else {
      const res = await patchRecord(AUTHORITATIVE_TABLE, gigId, { status: "CANCELLED" });
      if (res) {
        publishTableChange(AUTHORITATIVE_TABLE, "update", res as any);
        publishRiderRefresh();
      }
      return res;
    }
  } catch (error: any) {
    console.error(`[GIGS_API] Delete/Cancel failed for ${AUTHORITATIVE_TABLE}:`, error.message);
    throw error;
  }
}

export async function bulkDeleteGigs(gigIds: string[]) {
  try {
    const results = await Promise.all(
      gigIds.map(id => deleteRecord(AUTHORITATIVE_TABLE, id))
    );
    publishTableChange(AUTHORITATIVE_TABLE, "delete", { ids: gigIds } as any);
    publishRiderRefresh();
    return results;
  } catch (error: any) {
    console.error(`[GIGS_API] Bulk delete failed:`, error.message);
    throw error;
  }
}

export async function bulkCancelGigs(gigIds: string[]) {
  try {
    const results = await Promise.all(
      gigIds.map(id => patchRecord(AUTHORITATIVE_TABLE, id, { status: "CANCELLED" }))
    );
    publishTableChange(AUTHORITATIVE_TABLE, "update", { ids: gigIds, status: "CANCELLED" } as any);
    publishRiderRefresh();
    return results;
  } catch (error: any) {
    console.error(`[GIGS_API] Bulk cancel failed:`, error.message);
    throw error;
  }
}

export async function fetchGigParticipants(gigId: string) {
  try {
    const data = await listTable<GigParticipant>("rider_gig_enrollments", { 
      gig_id: `eq.${gigId}`, 
      order: "completed_deliveries.desc" 
    }, { fresh: true, ttl: 0 });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function fetchGigEnrollmentCounts(gigIds: string[]): Promise<Record<string, number>> {
  if (!gigIds.length) return {};
  try {
    const enrollments = await listTable<GigParticipant>("rider_gig_enrollments", {
      gig_id: `in.(${gigIds.join(",")})`
    }, { fresh: true, ttl: 0 });
    
    const counts: Record<string, number> = {};
    enrollments.forEach(e => {
      counts[e.gig_id] = (counts[e.gig_id] || 0) + 1;
    });
    return counts;
  } catch (e) {
    console.error("[GIGS_API] Failed to fetch enrollment counts:", e);
    return {};
  }
}

export async function enrollInGig(gigId: string, riderId: string) {
  const TABLE = "rider_gig_enrollments";
  
  const [gigRows] = await Promise.all([
    fetchGigs({ id: gigId })
  ]);

  const gig = gigRows[0];
  if (!gig) throw new Error("Gig not found");
  if (gig.status.toUpperCase() !== "ACTIVE" && gig.status.toUpperCase() !== "SCHEDULED") throw new Error("Gig is not active for booking");
  
  try {
    const existing = await listTable<GigParticipant>(TABLE, { gig_id: `eq.${gigId}`, rider_id: `eq.${riderId}` });
    if (existing && existing.length > 0) return existing[0];
    
    const participants = await listTable<GigParticipant>(TABLE, { gig_id: `eq.${gigId}` });
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
  } catch (e) {
    console.warn("[GIGS_API] Enrollment failed (likely missing table):", e);
    throw new Error("Enrollment system is currently unavailable.");
  }
}

export async function cancelGigEnrollment(gigId: string, riderId: string) {
  const TABLE = "rider_gig_enrollments";
  try {
    const existing = await listTable<GigParticipant>(TABLE, {
      gig_id: `eq.${gigId}`,
      rider_id: `eq.${riderId}`
    });
    
    if (existing && existing.length > 0) {
      return deleteRecord(TABLE, existing[0].id);
    }
  } catch (e) {
    console.warn("[GIGS_API] Cancel enrollment failed:", e);
  }
  return null;
}

export async function fetchRiderGigs(riderId: string) {
  try {
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
  } catch {
    return [];
  }
}